"""image_utils.py — shared image fetch + normalization helpers.

Generic, source-agnostic building blocks used by the image-ingesting scrapers
(`scrape_venue_og_images.py` for venue hero images, `event_image.py` for event
covers). Kept in one place so the two callers can't drift on size caps, UA, or
JPEG encoding settings.

No Supabase / storage concerns live here — just bytes in, normalized JPEG bytes
out. Upload + DB-write stay with each caller.
"""

from __future__ import annotations

import io
from typing import Optional

import requests
from PIL import Image

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
IMG_TIMEOUT = 15
MAX_IMG_BYTES = 8_000_000
# Reject anything smaller — filters out logos, icons, tracking pixels.
MIN_W, MIN_H = 400, 250
# Long side cap. 900px + q=75 yields ~50-100 KB JPEGs with no perceptible drop
# at card/hero display sizes.
TARGET_LONG_SIDE = 900
JPEG_QUALITY = 75


def fetch_image(url: str) -> Optional[bytes]:
    """GET image bytes, capped at MAX_IMG_BYTES. None on any failure.

    Rejects SVG and GIF up front (vector logos / animations are never good
    cover material) and anything whose content-type isn't image/*.
    """
    try:
        r = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "image/*"},
            timeout=IMG_TIMEOUT,
            allow_redirects=True,
            stream=True,
        )
        r.raise_for_status()
        ct = r.headers.get("content-type", "").lower()
        if ct.startswith("image/svg") or "gif" in ct:
            return None
        if ct and not ct.startswith("image/"):
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
    """Decode, reject if too small, resize to TARGET_LONG_SIDE, re-encode JPEG.

    None when the bytes don't decode or the image is below MIN_W/MIN_H.
    """
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
