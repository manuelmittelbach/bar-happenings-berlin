#!/usr/bin/env python3
"""scrape_venue_og_images.py — bulk-fill venues.image from each bar's website.

For every venue without an image but with a website, fetch the homepage, pick
the best meta-image (og:image > twitter:image > apple-touch > big favicon),
normalize it to JPEG, upload to the `venue-images` bucket under
`og/{venue_id}.jpg`, and update venues.image with the public URL.

Manual override is expected afterwards for whichever results look generic —
this is the bulk-fill pass, not the final state.

Usage:
    python scripts/scrape_venue_og_images.py [--dry-run] [--limit N]
                                              [--venue-id UUID] [--overwrite]

Env (loaded from scripts/.env):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from collections import Counter
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

# Generic image fetch/normalize lives in image_utils so this scraper and the
# event-cover scraper can't drift on size caps, UA, or JPEG settings.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from image_utils import (  # noqa: E402
    USER_AGENT,
    fetch_image,
    normalize_to_jpeg,
)

BUCKET = "venue-images"
STORAGE_PREFIX = "og"
HTML_TIMEOUT = 15
MAX_HTML_BYTES = 1_000_000
RATE_LIMIT_SECONDS = 1.0


@dataclass
class Outcome:
    venue_id: str
    name: str
    status: str  # one of the keys in SUMMARY_KEYS below
    detail: str = ""


SUMMARY_KEYS = [
    "ok",
    "no_og_image",
    "fetch_error",
    "image_too_small",
    "unsupported_format",
    "upload_error",
    "skipped_has_image",
]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true",
                   help="log what would happen; no upload, no DB write")
    p.add_argument("--limit", type=int, default=None,
                   help="max venues to process this run")
    p.add_argument("--venue-id", type=str, default=None,
                   help="process only this single venue id")
    p.add_argument("--overwrite", action="store_true",
                   help="re-scrape even when venues.image is already set")
    return p.parse_args()


def load_env() -> tuple[str, str]:
    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, ".env"))
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in scripts/.env")
    return url, key


def fetch_html(url: str) -> Optional[str]:
    """GET the homepage, return decoded HTML or None on any failure."""
    try:
        r = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"},
            timeout=HTML_TIMEOUT,
            allow_redirects=True,
            stream=True,
        )
        r.raise_for_status()
        ct = r.headers.get("content-type", "").lower()
        if "html" not in ct and "xml" not in ct:
            return None
        # Bound the read so a giant page can't OOM us.
        raw = r.raw.read(MAX_HTML_BYTES, decode_content=True)
        return raw.decode(r.encoding or "utf-8", errors="replace")
    except (requests.RequestException, OSError):
        return None


def pick_image_url(html: str, base_url: str) -> Optional[str]:
    """Return the best candidate URL for a hero image, or None."""
    soup = BeautifulSoup(html, "html.parser")

    # 1. og:image / og:image:secure_url
    for prop in ("og:image:secure_url", "og:image"):
        tag = soup.find("meta", attrs={"property": prop})
        if tag and tag.get("content"):
            return urljoin(base_url, tag["content"].strip())

    # 2. twitter:image
    for attr in ({"name": "twitter:image"}, {"property": "twitter:image"}):
        tag = soup.find("meta", attrs=attr)
        if tag and tag.get("content"):
            return urljoin(base_url, tag["content"].strip())

    # 3. apple-touch-icon — usually 180×180, big enough to read as a logo card
    tag = soup.find("link", rel=lambda v: v and "apple-touch-icon" in v)
    if tag and tag.get("href"):
        return urljoin(base_url, tag["href"].strip())

    # 4. Largest declared icon
    best = None
    best_px = 0
    for tag in soup.find_all("link", rel=lambda v: v and "icon" in v):
        href = tag.get("href")
        if not href:
            continue
        sizes = (tag.get("sizes") or "").lower()
        px = 0
        for part in sizes.replace(",", " ").split():
            if "x" in part:
                try:
                    px = max(px, int(part.split("x", 1)[0]))
                except ValueError:
                    pass
        if px > best_px:
            best_px = px
            best = href
    if best and best_px >= 192:
        return urljoin(base_url, best.strip())

    return None


def process_venue(venue: dict, sb, *, dry_run: bool) -> Outcome:
    vid = venue["id"]
    name = venue["name"]
    website = venue["website"]

    parsed = urlparse(website)
    if not parsed.scheme:
        website = "https://" + website

    html = fetch_html(website)
    if html is None:
        return Outcome(vid, name, "fetch_error", f"html fetch failed for {website}")

    img_url = pick_image_url(html, website)
    if not img_url:
        return Outcome(vid, name, "no_og_image", "no og/twitter/apple-touch/icon found")

    raw = fetch_image(img_url)
    if raw is None:
        return Outcome(vid, name, "unsupported_format", f"image fetch failed or unsupported ({img_url})")

    jpeg = normalize_to_jpeg(raw)
    if jpeg is None:
        return Outcome(vid, name, "image_too_small", f"rejected by Pillow ({img_url})")

    storage_path = f"{STORAGE_PREFIX}/{vid}.jpg"
    if dry_run:
        return Outcome(vid, name, "ok", f"would upload {len(jpeg)} bytes from {img_url}")

    try:
        sb.storage.from_(BUCKET).upload(
            path=storage_path,
            file=jpeg,
            file_options={
                "content-type": "image/jpeg",
                "cache-control": "public, max-age=31536000",
                "upsert": "true",
            },
        )
    except Exception as e:
        return Outcome(vid, name, "upload_error", f"storage upload failed: {e}")

    public_url = sb.storage.from_(BUCKET).get_public_url(storage_path)
    # The python client appends a trailing '?' on some versions — strip it so
    # the value is clean in the DB.
    public_url = public_url.rstrip("?")

    try:
        # Write to both `image` (the active/visible URL) AND `image_og`
        # (the per-source archive). Admins can later swap between og and
        # google versions by promoting `image_og` or `image_google` into
        # `image` via the bar admin UI.
        sb.table("venues").update(
            {"image": public_url, "image_og": public_url, "updated_at": "now()"}
        ).eq("id", vid).execute()
    except Exception as e:
        return Outcome(vid, name, "upload_error", f"db update failed: {e}")

    return Outcome(vid, name, "ok", f"source={img_url} -> {public_url}")


def main():
    args = parse_args()
    url, key = load_env()
    sb = create_client(url, key)

    q = sb.table("venues").select("id, name, website, image").order("name")
    if args.venue_id:
        q = q.eq("id", args.venue_id)
    rows = q.execute().data or []

    targets: list[dict] = []
    skipped = 0
    for v in rows:
        if not (v.get("website") or "").strip():
            continue
        has_image = bool((v.get("image") or "").strip())
        if has_image and not args.overwrite:
            skipped += 1
            continue
        targets.append(v)

    if args.limit is not None:
        targets = targets[: args.limit]

    print(f"[plan] scanning {len(rows)} venues — {len(targets)} will be processed, "
          f"{skipped} already have an image (use --overwrite to re-scrape)")
    print(f"[plan] dry_run={args.dry_run} overwrite={args.overwrite} limit={args.limit}\n")

    counts: Counter[str] = Counter()
    if skipped:
        counts["skipped_has_image"] = skipped

    for i, v in enumerate(targets, 1):
        t0 = time.monotonic()
        outcome = process_venue(v, sb, dry_run=args.dry_run)
        counts[outcome.status] += 1
        print(f"[{i:>3}/{len(targets)}] {outcome.status:<20} {outcome.name[:40]:<40} {outcome.detail}")
        elapsed = time.monotonic() - t0
        if i < len(targets) and elapsed < RATE_LIMIT_SECONDS:
            time.sleep(RATE_LIMIT_SECONDS - elapsed)

    print("\n[summary]")
    for k in SUMMARY_KEYS:
        if counts[k]:
            print(f"  {k:<22} {counts[k]}")


if __name__ == "__main__":
    main()
