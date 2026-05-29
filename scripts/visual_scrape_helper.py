"""
Helper for the visual-scrape workflow (Step 1 — build the work-list).

One mode:

  list    Fetch all active, scrape-enabled venues and, for each, the set of
          events already pending in `venue_events_staging` (non-manual rows),
          and print them as a JSON array on stdout (or to --out). The canonical
          workflow script `scripts/visual-scrape.workflow.js` reads this file so
          each sub-agent gets its own venue + that venue's already-staged keys,
          without the orchestrator re-running SQL inside the workflow sandbox.

Usage:
    python3 scripts/visual_scrape_helper.py list
    python3 scripts/visual_scrape_helper.py list --out /tmp/visual_scrape_venues.json

Output shape — one object per active venue:
    {
      "venue_id":       "uuid",
      "name":           "Venue name",
      "website_events": "https://…",
      "staged_keys":    [["2026-05-30", "normalized title"], ...]
    }

`staged_keys` mirrors the importer's dedup key: (date, normalize_title(title))
for every non-manual staging row of that venue. A sub-agent skips any event
whose (date, normalized_title) is already in its venue's set, so a re-run within
the same week doesn't re-fetch detail pages for events still pending review.
"""

import argparse
import json
import os
import sys
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

# Reuse the importer's staged-key logic so the dedup keys the workflow hands to
# sub-agents are normalized exactly like the importer normalizes them.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrape_helpers import fetch_existing_staged_keys_by_venue  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in scripts/.env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def cmd_list(args):
    c = client()
    # Step 1a — active venues with an events URL to scrape.
    venues = (
        c.table("venues")
        .select("id,name,website_events")
        .eq("scrape_enabled", True)
        .not_.is_("website_events", "null")
        .order("name")
        .execute()
        .data
    ) or []

    # Step 1b — events already pending review, keyed + normalized like the importer.
    staged = fetch_existing_staged_keys_by_venue(c)

    out_list: list[dict[str, Any]] = []
    for v in venues:
        vid = v.get("id")
        url = (v.get("website_events") or "").strip()
        if not vid or not url:
            continue
        keys = sorted([d, t] for (d, t) in staged.get(vid, set()))
        out_list.append({
            "venue_id":       vid,
            "name":           v.get("name"),
            "website_events": url,
            "staged_keys":    keys,
        })

    out = json.dumps(out_list, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"Wrote {len(out_list)} active venues to {args.out}", file=sys.stderr)
    else:
        print(out)


def parse_args():
    p = argparse.ArgumentParser(description="Visual-scrape workflow helper (Step 1 work-list).")
    sub = p.add_subparsers(dest="cmd", required=True)

    pl = sub.add_parser("list", help="Print active venues + their staged keys as JSON.")
    pl.add_argument("--out", help="Write JSON to this path instead of stdout.")
    pl.set_defaults(func=cmd_list)

    return p.parse_args()


def main():
    args = parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
