"""apply_events_page_urls.py — write discovered events-page URLs onto venues.

The venue-events-page discovery workflow visits each venue's website, finds the
canonical page that lists the venue's events, and writes one
`events_page_url` per venue to a JSON array. This script is the ONLY DB-writing
piece of that flow:

  For each candidate with a non-empty `events_page_url`, set

      UPDATE venues SET website_events = <url>
      WHERE id = <venue id> AND (website_events IS NULL OR website_events = '')

  Non-destructive (never overwrites an existing/admin-set events page) and
  idempotent (re-runs are no-ops for rows that already have the same URL).
  Candidates with a null/empty `events_page_url` (workflow found no events page)
  are left untouched — per the runbook decision, website_events stays NULL.

Reads project credentials from scripts/.env (service-role key, project
uybvrxqleutguucrifuf) — same pattern as apply_recurring_images.py.

Usage:
    python3 scripts/apply_events_page_urls.py /tmp/venue_events_page_candidates.json
    cat candidates.json | python3 scripts/apply_events_page_urls.py -

Input: JSON array of objects with at least `id` (the venue id) and
`events_page_url` (string or null). Extra keys (name, has_events, evidence, ...)
are ignored.
"""

import json
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in scripts/.env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def load_candidates(path: str):
    raw = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
    data = json.loads(raw)
    if not isinstance(data, list):
        raise SystemExit("Input must be a JSON array of candidate objects.")
    return data


def apply_one(c, venue_id: str, url: str) -> int:
    """Set website_events on the venue, only where currently NULL/empty.
    Returns the number of rows updated (0 or 1)."""
    res = (
        c.table("venues")
        .update({"website_events": url})
        .eq("id", venue_id)
        .or_("website_events.is.null,website_events.eq.")
        .execute()
    )
    return len(res.data or [])


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: apply_events_page_urls.py <candidates.json | ->")
    candidates = load_candidates(sys.argv[1])
    c = client()

    total = len(candidates)
    applied = 0   # venues that got an events page written
    skipped = 0   # no events_page_url supplied (workflow found none)
    already = 0   # already had a website_events set (non-destructive)
    failed = 0    # missing venue id

    for cand in candidates:
        venue_id = (cand.get("id") or "").strip()
        url = (cand.get("events_page_url") or "").strip()
        name = cand.get("name") or "(unnamed)"
        if not venue_id:
            failed += 1
            print(f"  ! missing venue id, skipping: {name}", file=sys.stderr)
            continue
        if not url:
            skipped += 1
            print(f"  - no events page for: {name}", file=sys.stderr)
            continue

        rows = apply_one(c, venue_id, url)
        if rows == 0:
            already += 1
            print(f"  = already has events page: {name}", file=sys.stderr)
        else:
            applied += 1
            print(f"  + {name}  →  {url}", file=sys.stderr)

    print(
        f"{total} venues · {applied} events pages applied · "
        f"{skipped} no-events · {already} already-set · {failed} bad-id."
    )


if __name__ == "__main__":
    main()
