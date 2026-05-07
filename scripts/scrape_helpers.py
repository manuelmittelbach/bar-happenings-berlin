"""
Shared helpers for the venue-event scraping pipeline.

Used by:
- scrape_venue_events.py (Ollama auto-scraper)
- import_visual_events.py (visual-workflow importer)
- stage_visual_placeholder.py (placeholder for zero-event scrapes)

Pure utility module: no env vars, no Supabase client construction. DB
functions take a `client` argument so each consumer manages its own
auth/session.
"""

import re
from datetime import date, datetime, timedelta


TODAY        = date.today()
TODAY_ISO    = TODAY.isoformat()
# Hard upper bound for accepted events. 2 weeks matches the typical user
# planning horizon and keeps each scrape focused on what's actionable now.
MAX_DATE     = TODAY + timedelta(weeks=2)


# Allowed event categories: enabled rows in the public.categories table.
# Loaded fresh from the DB at the start of each consumer's main() — toggling
# `enabled` in the DB flows through on the next run without a code change.
#
# Mapping is label -> slug-id. The LLM gets shown labels (human-readable, easier
# to match against website text), but we INSERT the slug-id into the staging
# row because that's what the events table and UI expect (category badges, icons,
# filters all index by slug-id like "live-music", not by label "Live Music").
_FALLBACK_CATEGORIES: dict[str, str] = {
    "Live Music": "live-music",
    "Open Mic":   "open-mic",
    "Comedy":     "comedy",
    "DJ":         "dj-music",
    "Quiz":       "pub-quiz",
    "Karaoke":    "karaoke",
    "Drag":       "drag-cabaret",
    "Screening":  "screening",
    "Dating":     "singles",
    "Other":      "other",
}


def load_enabled_categories(client) -> dict[str, str]:
    """Fetch enabled categories as {label: slug_id}. Falls back to a hardcoded
    map if the query fails (offline, RLS issue, etc.) so the scraper never
    runs with an empty allowed-categories set."""
    try:
        result = client.table("categories").select("id, label").eq("enabled", True).execute()
        m = {row["label"]: row["id"] for row in (result.data or []) if row.get("label") and row.get("id")}
        if not m:
            print("⚠ No enabled categories returned from DB. Falling back to defaults.")
            return dict(_FALLBACK_CATEGORIES)
        return m
    except Exception as e:
        print(f"⚠ Could not load categories from DB: {e}. Falling back to defaults.")
        return dict(_FALLBACK_CATEGORIES)


# Populated by consumers in main() once the supabase client is available.
# Mutated via .clear()+.update() so all importers see the same dict object —
# normalize_category closes over THIS dict, so a reassignment would silently
# break callers that already imported `CATEGORIES`.
CATEGORIES: dict[str, str] = dict(_FALLBACK_CATEGORIES)


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


def normalize_category(value: str | None) -> str:
    """Map LLM-returned category text to its slug-id (e.g. "Live Music" → "live-music").
    Falls back to "other" so staging rows always carry a valid slug-id — even
    if "Other" was disabled in the categories table (the literal string "other"
    is safe because it's the canonical fallback id everywhere in the UI)."""
    if value:
        s = value.strip().lower()
        # Primary path: LLM returned a label (e.g. "Live Music")
        for label, slug in CATEGORIES.items():
            if label.lower() == s:
                return slug
        # Defensive: LLM returned the slug-id directly (e.g. "live-music")
        for slug in CATEGORIES.values():
            if slug.lower() == s:
                return slug
    return CATEGORIES.get("Other") or "other"


def normalize_language(value: str | None) -> str:
    """Pass through if it looks like a real language; else empty string.
    The full validation is the admin reviewer + the LANGUAGES list in the UI."""
    if not value or not isinstance(value, str):
        return ""
    cleaned = value.strip()
    if not cleaned or cleaned.lower() in {"null", "none", "n/a"}:
        return ""
    return cleaned


# Capture the integer part and optional ",50" so we can rebuild the canonical
# "N €" / "N,50 €" format with the exact spacing the admin dropdown uses.
_PRICE_RE = re.compile(r"^(\d+)(,50)?\s*€$")


_ENTRY_INFO_MAX_LEN = 80


def normalize_entry_info(value: str | None) -> str:
    """Normalize against the admin UI's entry_info options, with a free-text
    fallback for pricing info that doesn't fit the canonical formats.

    Hierarchy:
      1. 'Free' / 'Pay what you want' — passed through.
      2. 'N €' / 'N,50 €' — rebuilt to canonical format (with the space) so
         they match ENTRY_AMOUNTS in the dropdown, even if the source returns
         '8€' or '8  €'.
      3. Other non-empty pricing wording (e.g. 'Donation suggested',
         'Tickets via Eventim') — kept as-is, sanitized to a single line and
         capped at _ENTRY_INFO_MAX_LEN. The admin UI auto-detects these and
         shows them via Custom…, so they round-trip cleanly.
      4. Empty / placeholder strings ('null', 'none', 'n/a', 'no entry info')
         — collapse to '' so the admin UI's 'No entry info' pre-selects."""
    if not value or not isinstance(value, str):
        return ""
    cleaned = value.strip()
    if not cleaned:
        return ""
    if cleaned.lower() in {"null", "none", "n/a", "no entry info"}:
        return ""
    if cleaned in {"Free", "Pay what you want"}:
        return cleaned
    m = _PRICE_RE.match(cleaned)
    if m:
        return f"{m.group(1)},50 €" if m.group(2) else f"{m.group(1)} €"
    collapsed = re.sub(r"\s+", " ", cleaned)
    if len(collapsed) > _ENTRY_INFO_MAX_LEN:
        collapsed = collapsed[:_ENTRY_INFO_MAX_LEN].rstrip()
    return collapsed


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


def normalize_title(s: str | None) -> str:
    """Normalize an event title for matching: lowercase, trim, collapse runs
    of internal whitespace to single spaces. Used to key live-event lookups
    so re-scrapes match the existing event despite minor whitespace quirks."""
    if not s:
        return ""
    return re.sub(r"\s+", " ", s.strip().lower())


# Fields whose differences between a re-scraped event and an existing live
# event count as a meaningful update (admin gets a diff card to review).
# category/language are LLM-inferred (noisier than the rest) but the admin
# wants to see and apply those diffs too — modal renders checkboxes for
# them like any other field.
_COMPARE_FIELDS = ("start_time", "end_time", "doors_time", "description", "entry_info", "source_url", "category", "language")


def _norm_for_compare(field: str, value) -> str:
    """Normalize a field value into a comparable string. Treats None / '' /
    'null'-ish strings as the same so an LLM swing between null and empty
    string doesn't trigger a phantom update."""
    if value is None:
        return ""
    s = str(value).strip()
    if s.lower() in ("null", "none", "n/a"):
        return ""
    if field in ("start_time", "end_time", "doors_time"):
        return _trim_time(s) or ""
    if field == "description":
        return re.sub(r"\s+", " ", s)
    if field == "source_url":
        return s.lower()
    return s


def compare_event_fields(scraped: dict, live: dict) -> dict[str, tuple[str, str]]:
    """Return {field: (live_value, scraped_value)} for fields whose normalized
    values differ. Empty dict means the events are equivalent for our purposes.

    `scraped` uses the LLM's keys (start_time, etc.). `live` comes from the
    events table with the same column names. All fields in `_COMPARE_FIELDS`
    participate, including category and language — admin wants the diff card
    to surface those too."""
    diff: dict[str, tuple[str, str]] = {}
    for field in _COMPARE_FIELDS:
        live_v = _norm_for_compare(field, live.get(field))
        scraped_v = _norm_for_compare(field, scraped.get(field))
        if live_v != scraped_v:
            diff[field] = (str(live.get(field) or ""), str(scraped.get(field) or ""))
    return diff


def fetch_existing_events_by_venue_for_match(client) -> dict[str, dict[tuple[str, str], dict]]:
    """Map venue_id -> { (date, title_normalized): event_row } for live
    (approved/canceled) events in the 14-day scrape window.

    Includes both recurring AND non-recurring rows. The caller distinguishes
    via row['recurrence']: recurring matches trigger silent drop (no analysis),
    non-recurring matches go through compare_event_fields. Field set covers
    everything compare_event_fields needs to do its job.

    Children of recurring series (rows with parent_id set, recurrence='')
    inherit their parent's recurrence so the silent-drop check fires for
    every materialized instance of the series, not just the parent's date."""
    result = (
        client.table("events")
        .select(
            "id, parent_id, venue_id, date, title, start_time, end_time, doors_time, "
            "description, entry_info, category, language, url, recurrence"
        )
        .in_("status", ["approved", "canceled"])
        .gte("date", TODAY_ISO)
        .lte("date", MAX_DATE.isoformat())
        .execute()
    )
    # Look up recurrence for every parent referenced by a child in the window.
    # The extend_recurring_series cron writes children with recurrence=''; without
    # this lookup we'd treat them as standalone events and stage scraped diffs
    # as updates instead of silent-dropping them.
    parent_ids_needed = {
        row["parent_id"]
        for row in result.data
        if row.get("parent_id") and not (row.get("recurrence") or "")
    }
    parent_recurrence: dict[str, str] = {}
    if parent_ids_needed:
        parents = (
            client.table("events")
            .select("id, recurrence")
            .in_("id", list(parent_ids_needed))
            .execute()
        )
        parent_recurrence = {
            p["id"]: (p.get("recurrence") or "") for p in parents.data
        }
    out: dict[str, dict[tuple[str, str], dict]] = {}
    for row in result.data:
        vid = row.get("venue_id")
        d = row.get("date")
        title_key = normalize_title(row.get("title"))
        if not (vid and d and title_key):
            continue
        # The events table calls the field `url`; rest of our scraper code
        # talks about `source_url`. Normalize on the way out so consumers
        # don't need to know about the column-name mismatch.
        normalized_row = dict(row)
        normalized_row["source_url"] = row.get("url")
        if not (row.get("recurrence") or "") and row.get("parent_id"):
            inherited = parent_recurrence.get(row["parent_id"], "")
            if inherited:
                normalized_row["recurrence"] = inherited
        out.setdefault(vid, {})[(d, title_key)] = normalized_row
    return out


def fetch_existing_staged_keys_by_venue(client) -> dict[str, set[tuple[str, str]]]:
    """Map venue_id -> {(date, title_normalized), ...} for non-manual rows
    already in venue_events_staging. Title is normalized via normalize_title()
    so case/whitespace variations don't slip a duplicate past the dedup."""
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
        t = normalize_title(row.get("title"))
        if vid and d and t:
            out.setdefault(vid, set()).add((d, t))
    return out
