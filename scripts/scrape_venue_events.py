"""
Venue Event Scraper
===================
Scrapes event websites listed in `venues.website_events` (where `online='yes'`)
using a local Ollama LLM, and writes extracted events into `venue_events_staging`
for admin review.

SETUP:
    brew install ollama && ollama pull gemma3:12b
    brew services start ollama
    pip3 install -r requirements.txt
    cp .env.example .env   # then fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

RUN:
    python3 scrape_venue_events.py            # normal scrape
    python3 scrape_venue_events.py --clear    # wipe scraped + manual rows from venue_events_staging (keeps recurring) and exit
"""

import argparse
import json
import os
import re
from datetime import date, datetime, timedelta

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "gemma3:12b"
TODAY        = date.today()
TODAY_ISO    = TODAY.isoformat()
# Hard upper bound for accepted events. 2 weeks matches the typical user
# planning horizon and keeps each scrape focused on what's actionable now.
MAX_DATE     = TODAY + timedelta(weeks=2)

# Allowed event categories: enabled rows in the public.categories table.
# Loaded fresh from the DB at the start of main() — toggling `enabled` in the
# DB flows through on the next scrape without a code change.
_FALLBACK_CATEGORIES = [
    "Live Music", "Open Mic", "Comedy", "DJ", "Quiz",
    "Karaoke", "Drag", "Screening", "Dating", "Other",
]


def load_enabled_categories(client) -> list[str]:
    """Fetch enabled category labels from Supabase. Falls back to a hardcoded
    list if the query fails (offline, RLS issue, etc.) so the scraper never
    runs with an empty allowed-categories set."""
    try:
        result = client.table("categories").select("label").eq("enabled", True).execute()
        labels = [row["label"] for row in (result.data or [])]
        if not labels:
            print("⚠ No enabled categories returned from DB. Falling back to defaults.")
            return _FALLBACK_CATEGORIES
        return labels
    except Exception as e:
        print(f"⚠ Could not load categories from DB: {e}. Falling back to defaults.")
        return _FALLBACK_CATEGORIES


# Populated in main() once the supabase client is available.
CATEGORIES: list[str] = list(_FALLBACK_CATEGORIES)

# Most common language values for Berlin bar events.
# Full list is in src/data/languages.ts — admin can pick any of the 58 in the UI.
# We give the LLM a focused list so it doesn't hallucinate exotic options.
COMMON_LANGUAGES = [
    "English",
    "German",
    "English / German",
    "Spanish",
    "French",
    "Italian",
    "Portuguese",
    "Russian",
    "Turkish",
    "Polish",
]


def fetch_page_text(url: str, max_chars: int = 16000) -> tuple[str | None, str | None]:
    """Fetch a website and return (cleaned_text, error_message)."""
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "head"]):
            tag.decompose()
        text = re.sub(r"\s+", " ", soup.get_text(separator=" ")).strip()
        return text[:max_chars], None
    except requests.exceptions.Timeout:
        return None, "Connection timeout (10s)"
    except requests.exceptions.HTTPError as e:
        return None, f"HTTP {e.response.status_code}"
    except requests.exceptions.ConnectionError as e:
        return None, f"Connection error: {str(e)[:80]}"
    except Exception as e:
        return None, str(e)[:100]


def extract_events_with_ollama(venue_name: str, website: str, text: str) -> tuple[list[dict], str | None]:
    """Ask Ollama to extract events. Returns (events, error_message)."""
    categories_str = ", ".join(f'"{c}"' for c in CATEGORIES)
    languages_str = ", ".join(f'"{l}"' for l in COMMON_LANGUAGES)
    max_iso = MAX_DATE.isoformat()
    prompt = f"""You are extracting event data from a bar/venue website. Today is {TODAY_ISO}.

Venue: {venue_name}
Website: {website}

Website text:
{text}

CRITICAL RULES — read carefully:
1. Only extract events that are explicitly listed on the website. Do not invent events, do not guess events from generic text like "we host live music sometimes".
2. EXCLUDE events that you can clearly identify as being before {TODAY_ISO} (past events).
   - "Last Friday's gig was great" → past, exclude.
   - "Quiz Night, March 5, 2025" while today is {TODAY_ISO} → past, exclude.
3. INCLUDE events whose date is ambiguous but COULD be in the future. A human admin reviews each event afterwards, so it's fine to include uncertain candidates.
   - "March 15" with no year → use the next future March 15 (>= {TODAY_ISO}).
   - "this Friday" / "tonight" → compute from today ({TODAY_ISO}).
4. EXCLUDE events clearly later than {max_iso} (~2 weeks from today).
5. For recurring events ("every Friday"), only include occurrences that are EXPLICITLY listed on the page. Do NOT generate or expand a series of dates yourself unless the page itself lists each date.

For each future event return a JSON object with these exact keys:
- title (string): event title
- date (string): YYYY-MM-DD format, MUST be between {TODAY_ISO} and {max_iso}
- start_time (string): HH:MM (24h), or null
- end_time (string): HH:MM (24h), or null
- category (string): MUST be EXACTLY one of these values: {categories_str}. Use "Other" if no specific category fits — do NOT return null.
- language (string): the spoken language of the event, prefer one of these common values: {languages_str}. Use "English / German" for bilingual events. null if unclear.
- entry_info (string): pricing info. Use ONE of these formats so app filters work:
    * "Free" — for events with no entry charge of any kind
    * "Pay what you want" — for donation-based / sliding-scale events
    * "X €" or "X,50 €" — for fixed prices, e.g. "5 €", "8 €", "12,50 €"
      (exactly: integer or integer,50 + space + €)
    * Free-text fallback only if none above fit, e.g. "Booking required"
    * null if no pricing info found
- description (string): the full event description as written on the page (preserve all details — line-up, themes, hosts, special notes). Do not summarize or shorten. null only if the page has no descriptive text for this event.
- source_url (string): the website URL where the event was found

Return ONLY a valid JSON array. If no upcoming events found, return [].
Do not include any explanation, just the JSON array."""

    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
            },
            timeout=240,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "[]")
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            return [], None
        return json.loads(match.group()), None
    except requests.exceptions.Timeout:
        return [], "Ollama timeout (240s)"
    except Exception as e:
        return [], str(e)[:100]


def log_scrape(client, venue_id: str, status: str, error_message: str | None = None):
    """Write a row to scrape_logs (using new venue_id column)."""
    try:
        client.table("scrape_logs").insert(
            {"venue_id": venue_id, "status": status, "error_message": error_message}
        ).execute()
    except Exception:
        pass  # Don't let logging failures break the main loop


def ensure_placeholder(client, venue_id: str, source_url: str) -> bool:
    """Insert an empty placeholder row for a venue when no events were
    extracted, so it still shows up in the admin review for manual entry.
    Skips insertion if a placeholder already exists for this venue.
    All staging rows are pending by definition (approved live in `events`,
    rejected get deleted), so there is no `status` column to filter on.
    Returns True if a new placeholder was created."""
    try:
        existing = (
            client.table("venue_events_staging")
            .select("id")
            .eq("venue_id", venue_id)
            .is_("title", "null")
            .limit(1)
            .execute()
        )
        if existing.data:
            return False
        client.table("venue_events_staging").insert(
            {
                "venue_id": venue_id,
                "title": None,
                "date": None,
                "source_url": source_url,
                "is_manual": True,
            }
        ).execute()
        return True
    except Exception as e:
        print(f"  ⚠ Placeholder insert error: {e}")
        return False


def normalize_category(value: str | None) -> str | None:
    """Ensure category matches an allowed value. Falls back to 'Other' so admin
    sees a labeled card instead of an empty one — only returns None if 'Other'
    itself was disabled in the categories table."""
    other = next((c for c in CATEGORIES if c.lower() == "other"), None)
    if not value:
        return other
    for c in CATEGORIES:
        if c.lower() == value.strip().lower():
            return c
    return other


def normalize_language(value: str | None) -> str:
    """Pass through if it looks like a real language; else empty string.
    The full validation is the admin reviewer + the LANGUAGES list in the UI."""
    if not value or not isinstance(value, str):
        return ""
    cleaned = value.strip()
    if not cleaned or cleaned.lower() in {"null", "none", "n/a"}:
        return ""
    return cleaned


def normalize_entry_info(value: str | None) -> str:
    """Trim and drop placeholder values; mark unknown as 'No entry info'
    so admin sees a clear marker on the staging card."""
    if not value or not isinstance(value, str):
        return "No entry info"
    cleaned = value.strip()
    if not cleaned or cleaned.lower() in {"null", "none", "n/a"}:
        return "No entry info"
    return cleaned


def parse_event_date(value: str | None) -> date | None:
    """Parse YYYY-MM-DD into a date object. Returns None if invalid."""
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def is_acceptable_date(d: date) -> bool:
    """Reject past dates and dates further out than MAX_DATE."""
    return TODAY <= d <= MAX_DATE


def _trim_time(t: str | None) -> str | None:
    """Normalize a time string to HH:MM, or None if not parseable.
    Handles LLM quirks: literal 'null'/'none' strings and single-digit hours
    (e.g. '9:00' -> '09:00')."""
    if not t or not isinstance(t, str):
        return None
    s = t.strip()
    if not s or s.lower() in {"null", "none", "n/a"}:
        return None
    m = re.match(r"^(\d{1,2}):(\d{2})(?::\d{2})?$", s)
    if not m:
        return None
    return f"{int(m.group(1)):02d}:{m.group(2)}"


def fetch_existing_event_keys_by_venue(client) -> dict[str, set[str]]:
    """Map venue_id -> {f"{date}T{HH:MM}", ...} for events publicly visible
    (status approved/canceled, future dates). Used to skip scraped events that
    already exist as live events for the same (venue, date, start_time)."""
    result = (
        client.table("events")
        .select("venue_id, date, start_time")
        .in_("status", ["approved", "canceled"])
        .gte("date", TODAY_ISO)
        .execute()
    )
    out: dict[str, set[str]] = {}
    for row in result.data:
        vid = row.get("venue_id")
        d = row.get("date")
        t = _trim_time(row.get("start_time"))
        if vid and d and t:
            out.setdefault(vid, set()).add(f"{d}T{t}")
    return out


def fetch_existing_staged_keys_by_venue(client) -> dict[str, set[tuple[str, str]]]:
    """Map venue_id -> {(date, title), ...} for non-manual rows already in
    venue_events_staging. Mirrors the partial unique index
    (venue_id, date, title) WHERE is_manual = false so we can skip duplicates
    without relying on Postgres ON CONFLICT (which can't target a partial index
    via the supabase-py client)."""
    result = (
        client.table("venue_events_staging")
        .select("venue_id, date, title, is_manual")
        .eq("is_manual", False)
        .execute()
    )
    out: dict[str, set[tuple[str, str]]] = {}
    for row in result.data:
        vid = row.get("venue_id")
        d = row.get("date")
        t = (row.get("title") or "").strip()
        if vid and d and t:
            out.setdefault(vid, set()).add((d, t))
    return out


def clear_staging(client) -> int:
    """Delete scraped + manual rows from venue_events_staging, keeping recurring ones.
    Recurring rows are admin-curated (is_manual=true with a non-empty recurrence)
    and must survive a --clear so the recurring tab stays intact between scrapes."""
    # "Not recurring" = is_manual=false OR recurrence=''. PostgREST `or` filter.
    not_recurring = "is_manual.eq.false,recurrence.eq."
    count_res = (
        client.table("venue_events_staging")
        .select("id", count="exact")
        .or_(not_recurring)
        .execute()
    )
    count = count_res.count or 0
    if count == 0:
        return 0
    client.table("venue_events_staging").delete().or_(not_recurring).execute()
    return count


def purge_past_staging(client) -> int:
    """Delete non-recurring staging rows whose date is already in the past.
    Recurring rows (is_manual=true with non-empty recurrence) are preserved —
    their `date` is the series anchor, not a single occurrence, and may legitimately
    sit in the past while the series stays active."""
    not_recurring = "is_manual.eq.false,recurrence.eq."
    count_res = (
        client.table("venue_events_staging")
        .select("id", count="exact")
        .lt("date", TODAY_ISO)
        .or_(not_recurring)
        .execute()
    )
    count = count_res.count or 0
    if count == 0:
        return 0
    (
        client.table("venue_events_staging")
        .delete()
        .lt("date", TODAY_ISO)
        .or_(not_recurring)
        .execute()
    )
    return count


def parse_args():
    p = argparse.ArgumentParser(
        description="Scrape venue website_events into venue_events_staging."
    )
    p.add_argument(
        "--clear",
        action="store_true",
        help="Delete scraped + manual rows from venue_events_staging and exit (no scraping). "
             "Recurring rows are kept. Use this to start a fresh review batch.",
    )
    return p.parse_args()


def main():
    args = parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env")

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    if args.clear:
        deleted = clear_staging(client)
        print(f"Cleared venue_events_staging (recurring kept): {deleted} row(s) deleted.")
        return

    global CATEGORIES
    CATEGORIES = load_enabled_categories(client)
    print(f"Allowed categories ({len(CATEGORIES)}): {', '.join(CATEGORIES)}\n")

    print("Purging past events from venue_events_staging (recurring kept)...")
    purged = purge_past_staging(client)
    print(f"  {purged} past row(s) removed\n")

    print("Fetching venues with website_events and online='yes'...")
    result = (
        client.table("venues")
        .select("id, name, address, neighborhood, website_events")
        .not_.is_("website_events", "null")
        .neq("website_events", "")
        .eq("online", "yes")
        .order("name", desc=False)
        .execute()
    )
    venues = result.data
    print(f"  {len(venues)} venues found (sorted A→Z by name)\n")

    print("Fetching existing event (venue, date, start_time) keys for dedup...")
    existing_keys_map = fetch_existing_event_keys_by_venue(client)
    total_live = sum(len(s) for s in existing_keys_map.values())
    print(f"  {total_live} live events known across {len(existing_keys_map)} venues\n")

    print("Fetching already staged (venue, date, title) keys for dedup...")
    staged_keys_map = fetch_existing_staged_keys_by_venue(client)
    total_staged = sum(len(s) for s in staged_keys_map.values())
    print(f"  {total_staged} staged events known across {len(staged_keys_map)} venues\n")

    total_scanned = 0
    total_events = 0
    total_errors = 0

    for venue in venues:
        venue_id = venue["id"]
        venue_name = venue["name"]
        url = venue["website_events"]

        total_scanned += 1
        print(f"[{total_scanned}/{len(venues)}] {venue_name} — {url}")

        text, fetch_error = fetch_page_text(url)
        if not text:
            print(f"  ✗ Could not fetch page: {fetch_error}")
            log_scrape(client, venue_id, "fetch_error", fetch_error)
            if ensure_placeholder(client, venue_id, url):
                print("  + placeholder created (fetch error)")
            total_errors += 1
            continue

        events, ollama_error = extract_events_with_ollama(venue_name, url, text)

        if ollama_error:
            print(f"  ✗ Ollama error: {ollama_error}")
            log_scrape(client, venue_id, "timeout", ollama_error)
            if ensure_placeholder(client, venue_id, url):
                print("  + placeholder created (LLM error)")
            total_errors += 1
            continue

        if not events:
            print("  – No events found")
            log_scrape(client, venue_id, "no_events")
            if ensure_placeholder(client, venue_id, url):
                print("  + placeholder created for manual entry")
            continue

        existing_keys = existing_keys_map.get(venue_id, set())
        staged_keys = staged_keys_map.setdefault(venue_id, set())
        inserted = 0
        skipped_past = 0
        skipped_invalid = 0
        skipped_already_live = 0
        skipped_already_staged = 0
        for ev in events:
            try:
                title = (ev.get("title") or "").strip()
                parsed = parse_event_date(ev.get("date"))
                if not title or parsed is None:
                    skipped_invalid += 1
                    continue
                if not is_acceptable_date(parsed):
                    skipped_past += 1
                    continue
                date_iso = parsed.isoformat()
                ev_start = _trim_time(ev.get("start_time"))
                ev_end   = _trim_time(ev.get("end_time"))
                if ev_start and f"{date_iso}T{ev_start}" in existing_keys:
                    skipped_already_live += 1
                    continue
                if (date_iso, title) in staged_keys:
                    skipped_already_staged += 1
                    continue

                row = {
                    "venue_id":    venue_id,
                    "title":       title,
                    "date":        date_iso,
                    "start_time":  ev_start,
                    "end_time":    ev_end,
                    "category":    normalize_category(ev.get("category")),
                    "language":    normalize_language(ev.get("language")),
                    "description": ev.get("description") or "",
                    "entry_info":  normalize_entry_info(ev.get("entry_info")),
                    "source_url":  ev.get("source_url") or url,
                }
                client.table("venue_events_staging").insert(row).execute()
                staged_keys.add((date_iso, title))
                inserted += 1
            except Exception as e:
                print(f"  ⚠ Insert error: {e}")
                total_errors += 1

        # Summary line
        if inserted or skipped_past or skipped_invalid or skipped_already_live or skipped_already_staged:
            extras = []
            if skipped_past:
                extras.append(f"{skipped_past} past/out-of-range")
            if skipped_invalid:
                extras.append(f"{skipped_invalid} invalid")
            if skipped_already_live:
                extras.append(f"{skipped_already_live} already live")
            if skipped_already_staged:
                extras.append(f"{skipped_already_staged} already staged")
            extra_str = f" ({', '.join(extras)} skipped)" if extras else ""
            print(f"  ✓ {inserted} event(s) staged{extra_str}")
            total_events += inserted

        # Log status by outcome
        if inserted > 0:
            log_scrape(client, venue_id, "success")
        elif skipped_already_live > 0 and skipped_invalid == 0 and skipped_past == 0:
            log_scrape(client, venue_id, "all_already_live")  # Fall 5
        elif skipped_invalid > 0:
            log_scrape(client, venue_id, "invalid_output")    # Fall 7
        else:
            log_scrape(client, venue_id, "no_future_events")  # Fall 4

        # Placeholder only if LLM produced unparseable rows (Fall 7).
        # All other "no inserted" cases are deliberate skips, no admin attention needed.
        if skipped_invalid > 0:
            if ensure_placeholder(client, venue_id, url):
                print("  + placeholder created (LLM produced unparseable rows)")

    print(f"\n{'=' * 50}")
    print(f"Done! {total_scanned} venues scanned, {total_events} events staged, {total_errors} errors.")


if __name__ == "__main__":
    main()
