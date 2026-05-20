#!/usr/bin/env python3
"""scrape_venue_google_places.py — fill venues.image via Google Places photos.

Same shape as scrape_venue_og_images.py: for every venue without an image,
look the place up by name + address via the Google Places API, fetch its
first photo, normalize to JPEG, upload to the `venue-images` bucket under
`google/{venue_id}.jpg`, and update venues.image.

This is the *opt-in* successor to the og:image scraper: og only works when
the bar's own site exposes a hero meta tag; Places works when the place
exists on Google Maps (which it almost always does for a public-facing bar).

Note: caching photo URLs technically violates Google's TOS — they expect
on-demand resolution via the API. Acceptable for a personal/small project,
but if traffic grows the proper solution is a streaming edge function that
returns place photos via photo_reference on each request.

Usage:
    python scripts/scrape_venue_google_places.py [--dry-run] [--limit N]
                                                 [--venue-id UUID] [--overwrite]

Env (loaded from scripts/.env):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    GOOGLE_PLACES_API_KEY
"""

from __future__ import annotations

import argparse
import io
import os
import sys
import time
from collections import Counter
from dataclasses import dataclass
from typing import Optional

import requests
from dotenv import load_dotenv
from PIL import Image
from supabase import create_client

BUCKET = "venue-images"
STORAGE_PREFIX = "google"

PLACES_FIND_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
PLACES_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"

HTTP_TIMEOUT = 20
MAX_IMG_BYTES = 10_000_000
MIN_W, MIN_H = 400, 250
# Tuned for /bars card thumbnails (~300-400px display width). 900px + q=75
# produces ~50-100 KB files vs ~200-500 KB at 1600/85, with no perceptible
# quality drop at card sizes.
TARGET_LONG_SIDE = 900
JPEG_QUALITY = 75
PHOTO_MAX_WIDTH = 1600
RATE_LIMIT_SECONDS = 0.5  # Places API quota is generous; light throttle just to be polite


@dataclass
class Outcome:
    venue_id: str
    name: str
    status: str
    detail: str = ""


SUMMARY_KEYS = [
    "ok",
    "no_place_match",
    "no_photos",
    "places_api_error",
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


def load_env() -> tuple[str, str, str]:
    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, ".env"))
    sb_url = os.environ.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    gp_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not sb_url or not sb_key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in scripts/.env")
    if not gp_key:
        sys.exit("GOOGLE_PLACES_API_KEY must be set in scripts/.env")
    return sb_url, sb_key, gp_key


def find_place_id(query: str, api_key: str) -> tuple[Optional[str], Optional[str]]:
    """Return (place_id, error_detail). Both None on success.

    Uses Find Place from Text — cheapest endpoint that returns a place_id
    for a free-text query. Restricts results to Berlin for safety.
    """
    try:
        r = requests.get(
            PLACES_FIND_URL,
            params={
                "input": query,
                "inputtype": "textquery",
                "fields": "place_id,name",
                "locationbias": "circle:8000@52.520008,13.404954",  # Berlin center, 8km radius
                "key": api_key,
            },
            timeout=HTTP_TIMEOUT,
        )
        r.raise_for_status()
        data = r.json()
    except (requests.RequestException, ValueError) as e:
        return None, f"find_place http error: {e}"

    status = data.get("status")
    if status == "ZERO_RESULTS":
        return None, "no place match"
    if status != "OK":
        return None, f"find_place status={status} {data.get('error_message', '')}"
    candidates = data.get("candidates") or []
    if not candidates:
        return None, "empty candidates"
    return candidates[0].get("place_id"), None


def fetch_photo_reference(place_id: str, api_key: str) -> tuple[Optional[str], Optional[str]]:
    """Return (photo_reference, error_detail) for the first photo of the place."""
    try:
        r = requests.get(
            PLACES_DETAILS_URL,
            params={
                "place_id": place_id,
                "fields": "photos",
                "key": api_key,
            },
            timeout=HTTP_TIMEOUT,
        )
        r.raise_for_status()
        data = r.json()
    except (requests.RequestException, ValueError) as e:
        return None, f"details http error: {e}"

    status = data.get("status")
    if status != "OK":
        return None, f"details status={status} {data.get('error_message', '')}"
    photos = (data.get("result") or {}).get("photos") or []
    if not photos:
        return None, "no photos"
    return photos[0].get("photo_reference"), None


def fetch_photo_bytes(photo_reference: str, api_key: str) -> Optional[bytes]:
    """Stream the photo bytes via the Place Photo endpoint."""
    try:
        r = requests.get(
            PLACES_PHOTO_URL,
            params={
                "photoreference": photo_reference,
                "maxwidth": PHOTO_MAX_WIDTH,
                "key": api_key,
            },
            timeout=HTTP_TIMEOUT,
            allow_redirects=True,
            stream=True,
        )
        r.raise_for_status()
        ct = r.headers.get("content-type", "").lower()
        if not ct.startswith("image/"):
            return None
        buf = io.BytesIO()
        total = 0
        for chunk in r.iter_content(64 * 1024):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_IMG_BYTES:
                return None
            buf.write(chunk)
        return buf.getvalue()
    except (requests.RequestException, OSError):
        return None


def normalize_to_jpeg(raw: bytes) -> Optional[bytes]:
    """Decode, reject if too small, resize to TARGET_LONG_SIDE, re-encode JPEG."""
    try:
        im = Image.open(io.BytesIO(raw))
        im.load()
    except Exception:
        return None
    if im.width < MIN_W or im.height < MIN_H:
        return None
    if im.mode != "RGB":
        im = im.convert("RGB")
    long_side = max(im.width, im.height)
    if long_side > TARGET_LONG_SIDE:
        scale = TARGET_LONG_SIDE / long_side
        im = im.resize(
            (int(im.width * scale), int(im.height * scale)),
            Image.LANCZOS,
        )
    out = io.BytesIO()
    im.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue()


def process_venue(venue: dict, sb, api_key: str, *, dry_run: bool) -> Outcome:
    vid = venue["id"]
    name = venue["name"]
    address = (venue.get("address") or "").strip()

    # Strip ", Germany" / ", Deutschland" tails — Google handles Berlin
    # implicitly via the location bias and these tails confuse partial matches.
    addr_clean = address.replace(", Germany", "").replace(", Deutschland", "")
    query = f"{name}, {addr_clean}" if addr_clean else f"{name}, Berlin"

    place_id, err = find_place_id(query, api_key)
    if not place_id:
        return Outcome(vid, name, "no_place_match", err or "no place id")

    photo_ref, err = fetch_photo_reference(place_id, api_key)
    if not photo_ref:
        status = "no_photos" if err == "no photos" else "places_api_error"
        return Outcome(vid, name, status, err or "no photo_reference")

    raw = fetch_photo_bytes(photo_ref, api_key)
    if raw is None:
        return Outcome(vid, name, "unsupported_format", "photo fetch failed")

    jpeg = normalize_to_jpeg(raw)
    if jpeg is None:
        return Outcome(vid, name, "image_too_small", "rejected by Pillow")

    storage_path = f"{STORAGE_PREFIX}/{vid}.jpg"
    if dry_run:
        return Outcome(vid, name, "ok", f"would upload {len(jpeg)} bytes (place_id={place_id})")

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
    public_url = public_url.rstrip("?")

    try:
        # Write to both `image` (the active/visible URL) AND `image_google`
        # (the per-source archive). Admins can later swap between og and
        # google versions by promoting `image_og` or `image_google` into
        # `image` via the bar admin UI.
        sb.table("venues").update(
            {"image": public_url, "image_google": public_url, "updated_at": "now()"}
        ).eq("id", vid).execute()
    except Exception as e:
        return Outcome(vid, name, "upload_error", f"db update failed: {e}")

    return Outcome(vid, name, "ok", f"place_id={place_id} -> {public_url}")


def main():
    args = parse_args()
    sb_url, sb_key, gp_key = load_env()
    sb = create_client(sb_url, sb_key)

    q = sb.table("venues").select("id, name, address, image").order("name")
    if args.venue_id:
        q = q.eq("id", args.venue_id)
    rows = q.execute().data or []

    targets: list[dict] = []
    skipped = 0
    for v in rows:
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
        outcome = process_venue(v, sb, gp_key, dry_run=args.dry_run)
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
