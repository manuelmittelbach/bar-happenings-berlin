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
    python3 scrape_venue_events.py --clear    # wipe ALL rows from venue_events_staging and exit
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
# Hard upper bound for accepted events. The LLM expands recurring events 4 weeks
# out; we accept up to 8 weeks to give a safety margin without admitting random
# far-future entries.
MAX_DATE     = TODAY + timedelta(weeks=8)

# Allowed event categories — must match labels in the `categories` table
CATEGORIES = [
    "Live Music",
    "Pub Quiz",
    "Quiz Night",
    "Comedy",
    "Open Mic",
    "DJ / Music Night",
    "Language Exchange",
    "Social / Networking",
    "Singles & Dating",
    "Promo / Date Night",
    "Screening",
    "Sport / Games",
    "Other",
]

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


def fetch_page_text(url: str, max_chars: int = 4000) -> tuple[str | None, str | None]:
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
4. EXCLUDE events clearly later than {max_iso} (~8 weeks from today).
5. For recurring events ("every Friday"), only include occurrences that are EXPLICITLY listed on the page. Do NOT generate or expand a series of dates yourself unless the page itself lists each date.

For each future event return a JSON object with these exact keys:
- title (string): event title
- date (string): YYYY-MM-DD format, MUST be between {TODAY_ISO} and {max_iso}
- start_time (string): HH:MM (24h), or null
- end_time (string): HH:MM (24h), or null
- category (string): MUST be EXACTLY one of these values, or null if no good fit: {categories_str}
- language (string): the spoken language of the event, prefer one of these common values: {languages_str}. Use "English / German" for bilingual events. null if unclear.
- entry_info (string): pricing info. Use ONE of these formats so app filters work:
    * "Free" — for events with no entry charge of any kind
    * "Pay what you want" — for donation-based / sliding-scale events
    * "X €" or "X,50 €" — for fixed prices, e.g. "5 €", "8 €", "12,50 €"
      (exactly: integer or integer,50 + space + €)
    * Free-text fallback only if none above fit, e.g. "Booking required"
    * null if no pricing info found
- description (string): one short sentence describing the event, or null
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
            timeout=180,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "[]")
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            return [], None
        return json.loads(match.group()), None
    except requests.exceptions.Timeout:
        return [], "Ollama timeout (180s)"
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
    """Insert an empty pending placeholder row for a venue when no events were
    extracted, so it still shows up in the admin review for manual entry.
    Skips insertion if a pending placeholder already exists for this venue.
    Returns True if a new placeholder was created."""
    try:
        existing = (
            client.table("venue_events_staging")
            .select("id")
            .eq("venue_id", venue_id)
            .eq("status", "pending")
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
                "status": "pending",
            }
        ).execute()
        return True
    except Exception as e:
        print(f"  ⚠ Placeholder insert error: {e}")
        return False


def normalize_category(value: str | None) -> str | None:
    """Ensure category matches an allowed value, else None."""
    if not value:
        return None
    for c in CATEGORIES:
        if c.lower() == value.strip().lower():
            return c
    return None


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
    """Trim and drop placeholder values; admin review filters bad output."""
    if not value or not isinstance(value, str):
        return ""
    cleaned = value.strip()
    if not cleaned or cleaned.lower() in {"null", "none", "n/a"}:
        return ""
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


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env")

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
            total_errors += 1
            continue

        events, ollama_error = extract_events_with_ollama(venue_name, url, text)

        if ollama_error:
            print(f"  ✗ Ollama error: {ollama_error}")
            log_scrape(client, venue_id, "timeout", ollama_error)
            total_errors += 1
            continue

        if not events:
            print("  – No events found")
            log_scrape(client, venue_id, "no_events")
            if ensure_placeholder(client, venue_id, url):
                print("  + placeholder created for manual entry")
            continue

        inserted = 0
        skipped_past = 0
        skipped_invalid = 0
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

                row = {
                    "venue_id":    venue_id,
                    "title":       title,
                    "date":        parsed.isoformat(),
                    "start_time":  ev.get("start_time"),
                    "end_time":    ev.get("end_time"),
                    "category":    normalize_category(ev.get("category")),
                    "language":    normalize_language(ev.get("language")),
                    "description": ev.get("description") or "",
                    "entry_info":  normalize_entry_info(ev.get("entry_info")),
                    "source_url":  ev.get("source_url") or url,
                }
                # ignore_duplicates so re-scraping doesn't reset approved/rejected status
                client.table("venue_events_staging").upsert(
                    row, on_conflict="venue_id,date,title", ignore_duplicates=True
                ).execute()
                inserted += 1
            except Exception as e:
                print(f"  ⚠ Insert error: {e}")
                total_errors += 1

        if inserted or skipped_past or skipped_invalid:
            extras = []
            if skipped_past:
                extras.append(f"{skipped_past} past/out-of-range")
            if skipped_invalid:
                extras.append(f"{skipped_invalid} invalid")
            extra_str = f" ({', '.join(extras)} skipped)" if extras else ""
            print(f"  ✓ {inserted} event(s) staged{extra_str}")
            if inserted:
                log_scrape(client, venue_id, "success")
            total_events += inserted

        # If nothing landed in staging (all extracted events were filtered out),
        # still create a placeholder so the venue shows up for manual review.
        if inserted == 0:
            log_scrape(client, venue_id, "no_events")
            if ensure_placeholder(client, venue_id, url):
                print("  + placeholder created for manual entry")

    print(f"\n{'=' * 50}")
    print(f"Done! {total_scanned} venues scanned, {total_events} events staged, {total_errors} errors.")


if __name__ == "__main__":
    main()
