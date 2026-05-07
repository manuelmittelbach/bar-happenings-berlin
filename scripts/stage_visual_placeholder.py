"""
Stage an empty placeholder row in `venue_events_staging` for a venue whose
event page was reached during the visual-scrape workflow but where no events
could be extracted (iframe empty, image-OCR misslungen, anti-bot block,
layout unparseable).

Why: the placeholder shows up in the Admin "Manual" tab as a soft reminder
to enter events by hand later, when the page can't be parsed automatically.

Idempotent: skips if a placeholder (title IS NULL) already exists for the
venue. Reuses `ensure_placeholder` from the auto-scraper so behavior stays
in sync.

Usage:
    python3 scripts/stage_visual_placeholder.py VENUE_ID SOURCE_URL
"""

import argparse
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrape_venue_events import ensure_placeholder  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in scripts/.env")

    p = argparse.ArgumentParser(
        description="Stage an empty placeholder row when visual-scrape extraction fails."
    )
    p.add_argument("venue_id", help="UUID of the venue")
    p.add_argument("source_url", help="URL that was attempted (admin context)")
    args = p.parse_args()

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    created = ensure_placeholder(client, args.venue_id, args.source_url)
    if created:
        print(f"+ placeholder created for venue {args.venue_id}")
    else:
        print(f"– placeholder already exists for venue {args.venue_id}, skipped")


if __name__ == "__main__":
    main()
