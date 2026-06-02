"""event_image.py — rehost a scraped event cover into the `event-images` bucket.

The visual-scrape sub-agent supplies an `image_source_url` it saw in the event
detail page's DOM (og:image / largest content <img>). This module downloads it,
normalizes it to a bounded JPEG (shared logic in image_utils), uploads it under
a deterministic path, and returns the public URL — which the importer writes to
`venue_events_staging.image`.

Best-effort by design (matches the workflow's stance): every failure path
returns None instead of raising, so a missing cover never blocks the event
insert. The deterministic storage path (sha256 of the source URL) makes re-runs
idempotent — the same source image upserts to the same object.
"""

from __future__ import annotations

import hashlib
from typing import Optional

from image_utils import fetch_image, normalize_to_jpeg

BUCKET = "event-images"
STORAGE_PREFIX = "scraped"


def _storage_path(source_url: str) -> str:
    digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:16]
    return f"{STORAGE_PREFIX}/{digest}.jpg"


def ingest_event_image(client, source_url: Optional[str]) -> Optional[str]:
    """Download → normalize → upload an event cover; return its public URL.

    Returns None on any failure (bad URL, fetch error, too small, unsupported
    format, upload error) — the caller treats a missing cover as acceptable and
    proceeds with the event insert regardless.
    """
    url = (source_url or "").strip()
    if not url:
        return None

    raw = fetch_image(url)
    if raw is None:
        return None

    jpeg = normalize_to_jpeg(raw)
    if jpeg is None:
        return None

    path = _storage_path(url)
    try:
        client.storage.from_(BUCKET).upload(
            path=path,
            file=jpeg,
            file_options={
                "content-type": "image/jpeg",
                "cache-control": "public, max-age=31536000",
                "upsert": "true",
            },
        )
    except Exception:
        return None

    public_url = client.storage.from_(BUCKET).get_public_url(path)
    # The python client appends a trailing '?' on some versions — strip it so
    # the value is clean in the DB.
    return public_url.rstrip("?")
