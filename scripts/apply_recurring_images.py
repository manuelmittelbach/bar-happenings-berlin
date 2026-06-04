"""apply_recurring_images.py — rehost scraped covers onto recurring series.

The recurring-images workflow scrapes one `image_source_url` per recurring series
root from its source page and writes them to a JSON array. This script is the
ONLY DB-writing piece of that flow:

  1. For each candidate, rehost the source image into the `event-images` bucket
     via the existing `event_image.ingest_event_image` (download → normalize →
     idempotent upload → public URL). Best-effort: a failed/empty source skips
     the series.
  2. Write the resulting public URL onto the WHOLE series — the root AND its
     materialized child occurrences — but ONLY where no image exists yet:

         UPDATE events SET image = <url>, image_position = '50% 50%'
         WHERE (id = <root> OR parent_id = <root>) AND image IS NULL

     Non-destructive (never overwrites an existing/admin-set cover) and
     idempotent (re-runs are no-ops for already-filled rows; the sha256 storage
     path upserts the same object).

Reads project credentials from scripts/.env (service-role key, project
uybvrxqleutguucrifuf) — same pattern as verify_recurring_helper.py.

Usage:
    python3 scripts/apply_recurring_images.py /tmp/recurring_image_candidates.json
    cat candidates.json | python3 scripts/apply_recurring_images.py -

Input: JSON array of objects with at least `id` (the series root id) and
`image_source_url` (string or null). Extra keys (title, venue, ...) are ignored.
"""

import json
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

# Run as `python3 scripts/apply_recurring_images.py` → sys.path[0] is scripts/,
# so the sibling rehoster imports cleanly (same as import_visual_events.py).
from event_image import ingest_event_image

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


def apply_one(c, root_id: str, public_url: str) -> int:
    """Fill `image` on the root + its children, only where currently NULL.
    Returns the number of rows updated."""
    payload = {"image": public_url, "image_position": "50% 50%"}
    rows = 0
    # Root row.
    res = c.table("events").update(payload).eq("id", root_id).is_("image", "null").execute()
    rows += len(res.data or [])
    # Materialized child occurrences.
    res = c.table("events").update(payload).eq("parent_id", root_id).is_("image", "null").execute()
    rows += len(res.data or [])
    return rows


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: apply_recurring_images.py <candidates.json | ->")
    candidates = load_candidates(sys.argv[1])
    c = client()

    total = len(candidates)
    applied = 0      # series that got a cover written to >= 1 row
    rows_total = 0   # total events rows updated (root + children)
    skipped = 0      # no image_source_url supplied
    failed = 0       # had a source URL but rehost or update wrote nothing

    for cand in candidates:
        root_id = (cand.get("id") or "").strip()
        src = (cand.get("image_source_url") or "").strip()
        title = cand.get("title") or "(untitled)"
        venue = cand.get("venue") or "?"
        if not root_id:
            failed += 1
            print(f"  ! missing root id, skipping: {title} @ {venue}", file=sys.stderr)
            continue
        if not src:
            skipped += 1
            print(f"  - no image for: {title} @ {venue}", file=sys.stderr)
            continue

        public_url = ingest_event_image(c, src)
        if not public_url:
            failed += 1
            print(f"  x rehost failed: {title} @ {venue}  ({src})", file=sys.stderr)
            continue

        rows = apply_one(c, root_id, public_url)
        if rows == 0:
            # Source rehosted fine, but every row already had an image (non-destructive).
            print(f"  = already has cover: {title} @ {venue}", file=sys.stderr)
        else:
            applied += 1
            rows_total += rows
            print(f"  + {title} @ {venue}  →  {rows} rows", file=sys.stderr)

    print(
        f"{total} series · {applied} covers applied ({rows_total} rows) · "
        f"{skipped} no-image · {failed} fetch-failed."
    )


if __name__ == "__main__":
    main()
