"""
Venue Event Scraper
===================
Scrapes event websites listed in `venues.website_events` (where `scrape_enabled=true`)
using a local Ollama LLM, and writes extracted events into `venue_events_staging`
for admin review.

SETUP:
    brew install ollama && ollama pull qwen3:14b
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
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

# Shared with import_visual_events.py and stage_visual_placeholder.py.
# Date window, category map, normalizers, compare logic, dedup fetches,
# and ensure_placeholder all live in scrape_helpers — this file only
# contains the auto-scraper-specific bits (Ollama, HTML crawling, CLI).
from scrape_helpers import (
    CATEGORIES,
    MAX_DATE,
    TODAY_ISO,
    _trim_time,
    compare_event_fields,
    ensure_placeholder,
    fetch_existing_events_by_venue_for_match,
    fetch_existing_staged_keys_by_venue,
    is_acceptable_date,
    load_enabled_categories,
    normalize_category,
    normalize_entry_info,
    normalize_language,
    normalize_title,
    parse_event_date,
)

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "gemma3:12b"

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


# Whitelist: URL paths that look like event-detail pages by keyword.
# Matches:
#   /events/quiz-night            (single-slug, e.g. Crack Bellmer)
#   /program/2026/5/31/some-slug  (Squarespace YYYY/M/D/slug, e.g. 8MM Bar)
#   /programm/foo, /shows/bar/, etc.
# Case-insensitive on the keyword segment.
_EVENT_PATH_RE = re.compile(
    r"^/(events?|programm?|veranstaltungen?|kalender|calendar|shows?)(?:/\d{4}/\d{1,2}/\d{1,2})?/[^/?#]+/?$",
    re.IGNORECASE,
)

# Blacklist for fallback mode: paths that are clearly NOT event details.
# Used only when the whitelist found nothing — then we follow any same-domain
# slug-like path EXCEPT these. False positives (following a non-event page) are
# harmless (LLM ignores it); false negatives (missing a real event) are not.
_NON_EVENT_PATH_RE = re.compile(
    r"^/("
    r"about|contact|imprint|impressum|privacy|datenschutz|menu|karte|kontakt|"
    r"jobs|team|history|gallery|photos|press|media|"
    r"store|shop|cart|checkout|account|login|signin|signup|register|"
    r"reservation|reservations|booking|book|"
    r"search|tag|tags|category|categories|author|authors|page|"
    r"wp-admin|wp-content|wp-includes|sitemap|feed|rss|"
    r"newsletter|subscribe|donate|support|membership|faq|help|"
    r"terms|tos|legal|gdpr|cookies|cookie-policy|agb|"
    r"home|index|main|start|"
    r"de|en|fr|es|it|nl|sv|tr|"
    r"location|locations|directions|map|"
    r"social|instagram|facebook|twitter|youtube|tiktok|spotify|"
    r"giftcard|giftcards|gift|"
    r"playlist|playlists|"
    r"download|downloads"
    r")(?:/|$)",
    re.IGNORECASE,
)

# Static asset extensions to skip in fallback mode.
_STATIC_EXT_RE = re.compile(
    r"\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|mp3|mp4|webm|mov|css|js|json|xml|txt)(\?|$)",
    re.IGNORECASE,
)

# Hard stop list of canonical paths to never follow.
_STOP_PATHS = {
    "/", "/about", "/contact", "/imprint", "/privacy", "/menu", "/karte",
    "/kontakt", "/impressum", "/jobs", "/team", "/instagram", "/facebook",
}

# Slugs that look like calendar/list navigation rather than a specific event.
# We check these against the LAST path segment, case-insensitive. Catches
# Squarespace's /program/this-month-style pagination as well as common
# archive/upcoming/past links.
_NAV_SLUGS = {
    "this-month", "next-month", "previous-month", "prev-month", "last-month",
    "this-week", "next-week", "previous-week", "prev-week", "last-week",
    "this-year", "next-year", "previous-year", "prev-year", "last-year",
    "today", "tomorrow", "yesterday",
    "archive", "archives", "past", "past-events", "upcoming", "all", "all-events",
    "calendar", "kalender",
}


def _looks_like_slug(path: str) -> bool:
    """True if the path's last segment looks like a content slug (not a page
    number, not a single character, not empty)."""
    parts = [p for p in path.strip("/").split("/") if p]
    if not parts:
        return False
    last = parts[-1]
    if len(last) < 3:
        return False
    if re.fullmatch(r"\d+", last):  # /page/2, /archive/2026
        return False
    return True


def extract_event_sublinks(soup, base_url: str, max_links: int = 30) -> list[str]:
    """Find candidate event-detail URLs from anchors. Two-pass:
    1. Whitelist: paths matching _EVENT_PATH_RE — high precision.
    2. Fallback: any same-domain slug-like path NOT in the blacklist —
       high recall, used only when the whitelist found nothing.

    The whitelist is preferred because event-keyword paths are reliably
    event details. The fallback fires only on bars with non-standard URL
    schemes ('/event-list/<slug>', '/p/<slug>', '/<slug>' direct, etc.) —
    we'd rather over-fetch and let the LLM filter than miss real events."""
    base = urlparse(base_url)
    whitelist_seen: set[str] = set()
    whitelist_out: list[str] = []
    fallback_seen: set[str] = set()
    fallback_out: list[str] = []

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("mailto:", "tel:", "#")):
            continue
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if not parsed.scheme.startswith("http"):
            continue
        # Same domain (allow subdomains of base).
        if not (parsed.netloc == base.netloc or parsed.netloc.endswith("." + base.netloc)):
            continue
        if _STATIC_EXT_RE.search(parsed.path):
            continue
        path_normalized = parsed.path.rstrip("/").lower() or "/"
        if path_normalized in _STOP_PATHS:
            continue
        # Drop calendar/archive navigation URLs (last segment matches a known
        # nav slug like "this-month", "next-week", "archive", etc.).
        last_segment = path_normalized.rsplit("/", 1)[-1]
        if last_segment in _NAV_SLUGS:
            continue
        canonical = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

        # Pass 1: whitelist by keyword.
        if _EVENT_PATH_RE.match(parsed.path):
            if canonical not in whitelist_seen:
                whitelist_seen.add(canonical)
                whitelist_out.append(canonical)
            continue

        # Pass 2: fallback candidate (collected but only used if whitelist empty).
        if _NON_EVENT_PATH_RE.match(parsed.path):
            continue
        if not _looks_like_slug(parsed.path):
            continue
        if canonical in fallback_seen:
            continue
        fallback_seen.add(canonical)
        fallback_out.append(canonical)

    if whitelist_out:
        return whitelist_out[:max_links]
    return fallback_out[:max_links]


# Lines that are pure navigation/site chrome with no event content. Matched
# case-insensitively as exact line content (after surrounding whitespace strip).
_NAV_LINE_EXACT = {
    "back to all events", "back to events", "back to program", "back to programm",
    "all events", "view all events", "see all events",
    "(map)", "map", "directions",
    "google calendar", "ics", "add to calendar", "export",
    "share", "facebook", "twitter", "instagram",
    "tickets",
}
# Lines starting with these prefixes are nav to NEIGHBORING events and must be
# dropped together with the line immediately after (the neighbor's title).
_NAV_LINE_PREFIXES = ("earlier event:", "later event:", "previous event:", "next event:")
# Generic venue footer line patterns (regex, case-insensitive).
_VENUE_FOOTER_RE = re.compile(
    r"^(serving|since|copyright|©|all rights reserved|imprint|impressum|privacy|datenschutz)\b",
    re.IGNORECASE,
)


def _remove_nav_cruft(lines: list[str]) -> list[str]:
    """Drop Squarespace-style event-page navigation and site chrome that the
    LLM tends to mistake for event description (Earlier/Later Event nav,
    Add-to-Calendar buttons, footer copyright, etc.)."""
    out: list[str] = []
    skip_next_nonblank = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            # Pass blanks through; they don't consume the skip flag, so
            # "Earlier Event:" → blank → neighbor-title still drops the title.
            out.append(line)
            continue
        if skip_next_nonblank:
            skip_next_nonblank = False
            continue
        lower = stripped.lower()
        if lower in _NAV_LINE_EXACT:
            continue
        if any(lower.startswith(p) for p in _NAV_LINE_PREFIXES):
            # Drop this line plus the next non-blank line (neighbor's title).
            skip_next_nonblank = True
            continue
        if _VENUE_FOOTER_RE.match(stripped):
            continue
        out.append(line)
    return out


def _strip_html(html: str, max_chars: int) -> str:
    """Strip HTML to plain visible text, capped length. Preserves line/paragraph
    breaks (collapsed to at most one blank line) so the LLM can still see event
    boundaries. Also removes navigation/footer cruft (Earlier/Later Event,
    Calendar exports, copyright lines) — without this the LLM tends to dump
    those into the description field."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "head"]):
        tag.decompose()
    raw = soup.get_text(separator="\n")
    # Collapse intra-line whitespace, keep newlines as block separators.
    cleaned_lines = [re.sub(r"[ \t]+", " ", line).strip() for line in raw.splitlines()]
    # Drop nav/chrome lines (must happen before blank-collapse so paired lines
    # like "Earlier Event:" + neighbor title sit next to each other).
    cleaned_lines = _remove_nav_cruft(cleaned_lines)
    # Squash runs of blank lines down to a single blank line (paragraph break).
    out_lines: list[str] = []
    prev_blank = False
    for line in cleaned_lines:
        if line:
            out_lines.append(line)
            prev_blank = False
        elif not prev_blank:
            out_lines.append("")
            prev_blank = True
    text = "\n".join(out_lines).strip()
    return text[:max_chars]


def fetch_combined_text(
    url: str,
    max_chars: int = 16000,
    max_sublinks: int = 30,
    per_sublink_chars: int = 4000,
    per_bar_budget_s: float = 60.0,
    min_detail_chars: int = 200,
) -> tuple[str | None, str | None, list[str]]:
    """Fetch overview + crawl event-detail sub-pages whenever any are found.

    Earlier versions skipped the crawl when the overview was 'long enough',
    but that backfired on bars like Crack Bellmer: 6700 chars of teaser text
    with the actual event content sitting behind /events/<slug>. Now we
    always crawl when sub-links are present — caps on count, per-page chars
    and per-bar budget keep the cost bounded.

    Detail blocks are tagged [DETAIL_<n>: <url>] with 1-based n so the LLM
    can return a numeric `source_index` we map back to the real URL — never
    asking the model to echo a URL string (it hallucinates them).

    Returns (combined_text, error_message, kept_sublinks). kept_sublinks[n-1]
    is the URL behind the [DETAIL_<n>: ...] block in combined_text."""
    started = time.monotonic()
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        return None, "Connection timeout (10s)", []
    except requests.exceptions.HTTPError as e:
        return None, f"HTTP {e.response.status_code}", []
    except requests.exceptions.ConnectionError as e:
        return None, f"Connection error: {str(e)[:80]}", []
    except Exception as e:
        return None, str(e)[:100], []

    overview_text = _strip_html(resp.text, max_chars)
    soup = BeautifulSoup(resp.text, "html.parser")
    sublinks = extract_event_sublinks(soup, url, max_links=max_sublinks)

    if not sublinks:
        return overview_text, None, []

    parts = [f"[OVERVIEW]\n{overview_text}"]
    kept: list[str] = []
    for sub_url in sublinks:
        if time.monotonic() - started > per_bar_budget_s:
            break
        try:
            sub_resp = requests.get(sub_url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
            sub_resp.raise_for_status()
        except Exception:
            continue
        sub_text = _strip_html(sub_resp.text, per_sublink_chars)
        # After nav-cruft stripping, many event detail pages on Squarespace
        # collapse to nothing more than title + date + address — content the
        # overview already has. Skip those: they add no signal but feed the
        # LLM repetitive blocks that bleed into description fields.
        if len(sub_text) < min_detail_chars:
            continue
        kept.append(sub_url)
        parts.append(f"[DETAIL_{len(kept)}: {sub_url}]\n{sub_text}")

    combined = "\n\n".join(parts)
    return combined[:max_chars], None, kept


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

The website text above may contain a single block, OR an [OVERVIEW] block followed by one or more [DETAIL_<n>: <url>] blocks (numbered 1, 2, 3, ...). The [OVERVIEW] is the events index page (often only teasers); each [DETAIL_<n>: <url>] is a sub-page describing one specific event in more depth. When both are present, prefer the [DETAIL_<n>: ...] sections as the primary source for description, start_time, end_time, and entry_info, and return that <n> as `source_index` for that event. The [OVERVIEW] tells you which events exist and in what order.

CRITICAL RULES — read carefully:
1. Only extract events that are explicitly listed on the website. Do not invent events, do not guess events from generic text like "we host live music sometimes".
2. DATE PARSING — be precise, prefer omission over guessing. A skipped event is always better than an event with the wrong date.
   - European format DD.MM.YYYY is the DEFAULT (Berlin/German venues): "14.05." = 14 May, "4.4." = 4 April, "Sa. 4.4." = Saturday 4 April. Only treat MM/DD as American format if the page is clearly American/English-only.
   - Recognize month names in BOTH English AND German: Januar/Jan, Februar/Feb, März/Mär, April/Apr, Mai, Juni/Jun, Juli/Jul, August/Aug, September/Sep, Oktober/Okt, November/Nov, Dezember/Dez.
   - Year missing? Use the next future occurrence (>= {TODAY_ISO}). "March 15" with no year → next future March 15.
   - Relative dates ("this Friday", "tonight", "Sa. 4.4.") → compute from today ({TODAY_ISO}).
   - If a date is genuinely ambiguous (you can't tell which format applies, or which event it belongs to), OMIT that event entirely. Do NOT guess.
3. EVENT BOUNDARIES — when multiple events appear close together on the page:
   - Each event has its own date, time, and description block. Do NOT mix details from neighboring events.
   - The newlines and blank lines in the website text are meaningful — they often separate one event's block from the next. Use them as boundary hints.
   - If you cannot confidently tell which date, time, or description belongs to which event, OMIT the unclear ones rather than guess.
4. EXCLUDE events that you can clearly identify as being before {TODAY_ISO} (past events).
   - "Last Friday's gig was great" → past, exclude.
   - "Quiz Night, March 5, 2025" while today is {TODAY_ISO} → past, exclude.
5. EXCLUDE events clearly later than {max_iso} (~2 weeks from today).
6. For recurring events ("every Friday"), only include occurrences that are EXPLICITLY listed on the page. Do NOT generate or expand a series of dates yourself unless the page itself lists each date.

For each future event return a JSON object with these exact keys:
- title (string): event title
- date (string): YYYY-MM-DD format, MUST be between {TODAY_ISO} and {max_iso}
- start_time (string): HH:MM (24h), or null. The time the actual program starts (concert begins, DJ starts, quiz first question). NOT the doors/admission time.
- end_time (string): HH:MM (24h), or null
- doors_time (string): HH:MM (24h), or null. Only set when the page EXPLICITLY mentions a separate doors / admission / Einlass time distinct from start_time (common phrasings: "Doors 19:00", "Einlass 20 Uhr", "Doors open at 8pm"). Return null when no separate doors time is given — do NOT copy start_time into doors_time.
- category (string): MUST be EXACTLY one of these values: {categories_str}. Default to "Other". Only use a non-"Other" value if the event title or description EXPLICITLY and unambiguously names that format (e.g. "Live Jazz Band" → "Live Music", "Stand-up Comedy Night" → "Comedy", "DJ Set" → "DJ"). If there is any doubt, use "Other". Do NOT return null.
- language (string): the spoken/performed language of the event ITSELF — NOT the language of the website. STRONG PREFERENCE: null over a guess. A wrong language is worse than no language. Only fill this when the event page text EXPLICITLY states it (e.g. "in English", "auf Deutsch", "bilingual", "spanish-speaking comedy"). When set, prefer one of: {languages_str}. Use "English / German" only when the page explicitly says the event is bilingual. Return null when:
    * no language is stated for the event,
    * the event is language-agnostic (instrumental music, DJ sets, dance events, karaoke without specified language),
    * the only signal is the website's language or the event title — those are NOT sufficient.
  When in doubt, return null. Do NOT default to the website's language.
- entry_info (string): pricing info. Use the most specific that fits — prefer the canonical formats, but keep free-text from the page when stated pricing doesn't fit them. NEVER invent — the value must come from the page text.
    * "Free" — events with no entry charge
    * "Donation" — fully optional payment / "pay what you want" wording. Map common German donation indicators here too: "Spende", "Spendenbasis", "Auf Spendenbasis", "Frei / Spende", "Die Band sammelt am Ende". Do NOT map sliding-scale ranges (e.g. "5–15 €") — those go to free-text.
    * "X €" or "X,50 €" — fixed prices, e.g. "5 €", "8 €", "12,50 €" (integer or integer,50 + space + €)
    * Free-text fallback (string, max 80 chars, single line) — ONLY when pricing IS stated on the page but doesn't fit the canonical formats above. Copy the page's wording verbatim. Examples: "5–15 € sliding scale", "Donations 5–10 €", "Tickets via Eventim", "First drink costs double", "Reservation required".
    * null — ONLY when the page says nothing about pricing at all.
- description (string): COPY VERBATIM — paste the exact text character-for-character as it appears on the page, including punctuation, asterisks, and line breaks. Do NOT rephrase, summarize, or write a single word in your own words. If you find yourself composing a sentence, STOP and paste the original instead. When the event was extracted from a [DETAIL_<n>: ...] block, treat the ENTIRE detail block as content about this one event — include everything (performer/band/DJ bios, set descriptions, themes, ticket/RSVP notes, dress code, accessibility info, etc.). Be exhaustive; the detail page exists for this single event, so err strongly on the side of including more rather than less. CRITICAL: the following are NEVER description content:
    * Navigation to other events ("Earlier Event:", "Later Event:", "Previous/Next Event") — those belong to OTHER events, not this one. Ignore them.
    * Calendar export buttons ("Add to Calendar", "Google Calendar", "ICS"), share buttons, map links, "Back to All Events" links.
    * Generic venue footer text like "Serving Berlin's underground scene since 2002", copyright lines, imprint/privacy links — that's site chrome, not event description.
    * The event's own title, date, time, address — those have their own fields.
  Return null when, after ignoring the above, no event-specific prose remains. A null description is correct and expected for events that only list title+time+place — do NOT pad with title repetition or navigation text.
- source_index (integer or null): the <n> from the [DETAIL_<n>: <url>] block this event was extracted from. MUST be exactly the integer that appears between "DETAIL_" and ":" in that block — do NOT invent or modify URLs, do NOT return a string. Return null when the event was found only in [OVERVIEW] (no matching DETAIL block).

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
    p.add_argument(
        "--venue",
        metavar="NAME",
        help="Run the scraper only for venues whose name matches NAME (case-insensitive substring match). "
             "Useful for debugging a specific bar. Online flag is ignored when this is set.",
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

    # Mutate the helpers' CATEGORIES dict in place — `normalize_category`
    # closes over that exact dict object, so a re-binding here would not be
    # visible to it. clear()+update() preserves the binding.
    CATEGORIES.clear()
    CATEGORIES.update(load_enabled_categories(client))
    print(f"Allowed categories ({len(CATEGORIES)}): {', '.join(CATEGORIES)}\n")

    print("Purging past events from venue_events_staging (recurring kept)...")
    purged = purge_past_staging(client)
    print(f"  {purged} past row(s) removed\n")

    if args.venue:
        print(f"Fetching venues matching '{args.venue}' (scrape_enabled flag ignored)...")
        result = (
            client.table("venues")
            .select("id, name, address, neighborhood, website_events")
            .not_.is_("website_events", "null")
            .neq("website_events", "")
            .ilike("name", f"%{args.venue}%")
            .order("name", desc=False)
            .execute()
        )
    else:
        print("Fetching venues with website_events and scrape_enabled=true...")
        result = (
            client.table("venues")
            .select("id, name, address, neighborhood, website_events")
            .not_.is_("website_events", "null")
            .neq("website_events", "")
            .eq("scrape_enabled", True)
            .order("name", desc=False)
            .execute()
        )
    venues = result.data
    print(f"  {len(venues)} venues found (sorted A→Z by name)\n")

    print("Fetching existing live events for match-and-compare...")
    existing_events_map = fetch_existing_events_by_venue_for_match(client)
    total_live = sum(len(s) for s in existing_events_map.values())
    print(f"  {total_live} live events known across {len(existing_events_map)} venues\n")

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

        text, fetch_error, kept_sublinks = fetch_combined_text(url)
        if not text:
            print(f"  ✗ Could not fetch page: {fetch_error}")
            log_scrape(client, venue_id, "fetch_error", fetch_error)
            if ensure_placeholder(client, venue_id, url):
                print("  + placeholder created (fetch error)")
            total_errors += 1
            continue
        if kept_sublinks:
            print(f"  ↳ followed {len(kept_sublinks)} sub-link(s)")

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

        existing_events = existing_events_map.get(venue_id, {})
        staged_keys = staged_keys_map.setdefault(venue_id, set())
        inserted_new = 0
        inserted_update = 0
        skipped_past = 0
        skipped_invalid = 0
        skipped_unchanged = 0       # match against non-recurring live event, all compare-fields equal
        skipped_recurring = 0       # match against a recurring template (silent drop)
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
                title_key = normalize_title(title)
                ev_start = _trim_time(ev.get("start_time"))
                ev_end   = _trim_time(ev.get("end_time"))
                ev_doors = _trim_time(ev.get("doors_time"))

                if (date_iso, title_key) in staged_keys:
                    skipped_already_staged += 1
                    continue

                # Map LLM's source_index back to the real DETAIL URL we fetched.
                # The LLM never sees URL strings as input/output for this field —
                # it returns only the integer <n> from [DETAIL_<n>: ...]. That
                # makes URL hallucination impossible. When no valid index is
                # returned (event was only in [OVERVIEW]), fall back to the
                # venue's events page — a real URL we just fetched, so still
                # never a hallucinated string.
                idx = ev.get("source_index")
                if isinstance(idx, int) and 1 <= idx <= len(kept_sublinks):
                    source_url = kept_sublinks[idx - 1]
                else:
                    source_url = url

                # Match-and-compare against existing live events. Three paths:
                #   1) no match               → insert as new (replaces_event_id=null)
                #   2) match + recurring      → silent drop (recurring template covers it)
                #   3) match + non-recurring  → compare fields:
                #        - all equal → silent drop (truly unchanged, no admin attention)
                #        - any diff  → insert update (replaces_event_id=<live.id>)
                live_match = existing_events.get((date_iso, title_key))
                replaces_id = None
                if live_match is not None:
                    if (live_match.get("recurrence") or "") != "":
                        skipped_recurring += 1
                        continue
                    scraped_for_compare = {
                        "start_time": ev_start,
                        "end_time": ev_end,
                        "doors_time": ev_doors,
                        "description": ev.get("description") or "",
                        "entry_info": normalize_entry_info(ev.get("entry_info")),
                        "source_url": source_url,
                        "category": normalize_category(ev.get("category")),
                        "language": normalize_language(ev.get("language")),
                    }
                    diff = compare_event_fields(scraped_for_compare, live_match)
                    if not diff:
                        skipped_unchanged += 1
                        continue
                    replaces_id = live_match.get("id")

                row = {
                    "venue_id":    venue_id,
                    "title":       title,
                    "date":        date_iso,
                    "start_time":  ev_start,
                    "end_time":    ev_end,
                    "doors_time":  ev_doors,
                    "category":    normalize_category(ev.get("category")),
                    "language":    normalize_language(ev.get("language")),
                    "description": ev.get("description") or "",
                    "entry_info":  normalize_entry_info(ev.get("entry_info")),
                    "source_url":  source_url,
                    "replaces_event_id": replaces_id,
                }
                client.table("venue_events_staging").insert(row).execute()
                staged_keys.add((date_iso, title_key))
                if replaces_id:
                    inserted_update += 1
                else:
                    inserted_new += 1
            except Exception as e:
                print(f"  ⚠ Insert error: {e}")
                total_errors += 1

        # Summary line
        inserted = inserted_new + inserted_update
        any_activity = (
            inserted or skipped_past or skipped_invalid
            or skipped_unchanged or skipped_recurring or skipped_already_staged
        )
        if any_activity:
            extras = []
            if skipped_past:
                extras.append(f"{skipped_past} past/out-of-range")
            if skipped_invalid:
                extras.append(f"{skipped_invalid} invalid")
            if skipped_unchanged:
                extras.append(f"{skipped_unchanged} unchanged")
            if skipped_recurring:
                extras.append(f"{skipped_recurring} covered by recurring")
            if skipped_already_staged:
                extras.append(f"{skipped_already_staged} already staged")
            extra_str = f" ({', '.join(extras)} skipped)" if extras else ""
            label = f"{inserted_new} new"
            if inserted_update:
                label += f" + {inserted_update} update"
            print(f"  ✓ {label} event(s) staged{extra_str}")
            total_events += inserted

        # Log status by outcome
        if inserted > 0:
            log_scrape(client, venue_id, "success")
        elif skipped_unchanged > 0 and skipped_invalid == 0 and skipped_past == 0:
            log_scrape(client, venue_id, "all_unchanged")     # Fall 5: re-scrape, nothing changed
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
