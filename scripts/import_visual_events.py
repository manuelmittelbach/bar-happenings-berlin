"""
Importer for the visual-scrape workflow.

Reads a JSON list of events that a Claude session extracted via Playwright/MCP
and writes them to `venue_events_staging` with the same normalization and
dedup rules the automated scraper uses, so the rows show up cleanly in the
Admin Dashboard "Scraped" tab.

Usage:
    python3 scripts/import_visual_events.py path/to/events.json
    cat events.json | python3 scripts/import_visual_events.py -

JSON format — array of objects, each with these fields:
    venue_id      (uuid string, required)
    title         (string, required)
    date          (YYYY-MM-DD, required)
    start_time    (HH:MM or null)
    end_time      (HH:MM or null)
    doors_time    (HH:MM or null)            — only when page explicitly mentions a separate doors/Einlass time
    category      (label string or null)     — e.g. "Live Music", "Comedy", "DJ";
                                                normalize_category maps labels (and
                                                slug-ids) to internal IDs. See the
                                                category table in VISUAL_SCRAPE_FIELD_RULES.md.
    language      (string or null)
    description   (string or null)
    entry_info    ("Free" | "Donation" | "X €" | "X,50 €" | free-text ≤80 chars | null)
    source_url    (string, the actual detail-page URL — never invented)

Inserts with `is_manual=false` so events appear in the "Scraped" tab.
"""

import argparse
import json
import os
import sys
from datetime import date
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

# Reuse the existing normalizers + dedup logic from scrape_helpers so this
# helper can't drift out of sync with what the nightly auto-scraper produces.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrape_helpers import (  # noqa: E402
    CATEGORIES,
    MAX_DATE,
    TODAY,
    _trim_time,
    compare_event_fields,
    fetch_existing_events_by_venue_for_match,
    fetch_existing_staged_keys_by_venue,
    load_enabled_categories,
    normalize_category,
    normalize_entry_info,
    normalize_language,
    normalize_title,
)

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def parse_args():
    p = argparse.ArgumentParser(description="Import visually-scraped events into staging.")
    p.add_argument("path", help="Path to events JSON file, or '-' for stdin")
    return p.parse_args()


def load_events(path: str) -> list[dict[str, Any]]:
    raw = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
    data = json.loads(raw)
    if not isinstance(data, list):
        raise SystemExit("Input must be a JSON array of event objects.")
    return data


def is_in_window(date_str: str) -> bool:
    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        return False
    return TODAY <= d <= MAX_DATE


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in scripts/.env")

    args = parse_args()
    events = load_events(args.path)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Refresh the helpers' CATEGORIES dict from DB so slug-IDs match what
    # the UI expects right now. Mutating the same dict object (clear+update,
    # not reassignment) is required — `normalize_category` in scrape_helpers
    # closes over THIS dict.
    CATEGORIES.clear()
    CATEGORIES.update(load_enabled_categories(client))

    existing_events = fetch_existing_events_by_venue_for_match(client)
    staged_keys = fetch_existing_staged_keys_by_venue(client)

    inserted_new = inserted_update = 0
    skipped_unchanged = skipped_recurring = 0
    skipped_staged = skipped_window = skipped_invalid = 0
    insert_errors = 0
    for ev in events:
        title = (ev.get("title") or "").strip()
        date_iso = ev.get("date") or ""
        venue_id = ev.get("venue_id") or ""

        if not title or not date_iso or not venue_id:
            print(f"  ⚠ skipping invalid row (missing required field): {ev}")
            skipped_invalid += 1
            continue

        if not is_in_window(date_iso):
            print(f"  – skipping out-of-window: {date_iso} {title[:60]}")
            skipped_window += 1
            continue

        title_key = normalize_title(title)

        # Staging dedup. Title is normalized so case/whitespace variations of
        # the same event don't slip through. Re-runs within the same week
        # therefore don't duplicate rows still pending review.
        if (date_iso, title_key) in staged_keys.get(venue_id, set()):
            print(f"  – skipping already-staged: {date_iso} {title[:60]}")
            skipped_staged += 1
            continue

        # Live-event match-and-compare (3-way decision; see scrape_venue_events.py
        # for full rationale): no match → new, recurring → silent drop,
        # non-recurring → diff or silent drop.
        ev_start = _trim_time(ev.get("start_time"))
        ev_end = _trim_time(ev.get("end_time"))
        ev_doors = _trim_time(ev.get("doors_time"))
        source_url = (ev.get("source_url") or "").strip() or None

        live_match = existing_events.get(venue_id, {}).get((date_iso, title_key))
        replaces_id = None
        if live_match is not None:
            if (live_match.get("recurrence") or "") != "":
                print(f"  – skipping (covered by recurring): {date_iso} {title[:60]}")
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
                print(f"  – skipping unchanged: {date_iso} {title[:60]}")
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
            "is_manual":   False,
            "replaces_event_id": replaces_id,
        }
        try:
            client.table("venue_events_staging").insert(row).execute()
            label = "↻ update" if replaces_id else "+ new"
            print(f"  ✓ {label}: {date_iso} {title[:60]}")
            if replaces_id:
                inserted_update += 1
            else:
                inserted_new += 1
            # Keep dedup set in sync so a duplicate within the same JSON batch
            # is also skipped instead of double-staged.
            staged_keys.setdefault(venue_id, set()).add((date_iso, title_key))
        except Exception as e:
            print(f"  ✗ insert error for {title[:60]}: {e}")
            insert_errors += 1

    print(
        f"\nDone. {inserted_new} new + {inserted_update} update inserted, "
        f"{skipped_unchanged} unchanged, "
        f"{skipped_recurring} covered-by-recurring, "
        f"{skipped_staged} already-staged, "
        f"{skipped_window} out-of-window, "
        f"{skipped_invalid} invalid, "
        f"{insert_errors} insert-error."
    )


if __name__ == "__main__":
    main()
