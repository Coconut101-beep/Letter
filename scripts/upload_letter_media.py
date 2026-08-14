#!/usr/bin/env python3
"""Upload local letter media to private Supabase Storage (letter-media bucket).

Reads credentials from environment only — never commit the service role key.

  export SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
  python3 scripts/upload_letter_media.py
"""

from __future__ import annotations

import mimetypes
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUCKET = "letter-media"

ADI_UPLOADS: list[tuple[str, str]] = [
    ("assets/img/adi/scratchboard.webp", "adi/board/scratchboard.webp"),
    ("assets/img/adi/scratchboard.jpg", "adi/board/scratchboard.jpg"),
    ("assets/img/adi/01.jpg", "adi/photos/01.jpg"),
    ("assets/img/adi/02.jpg", "adi/photos/02.jpg"),
    ("assets/img/adi/03.jpg", "adi/photos/03.jpg"),
    ("assets/img/adi/clip.mp4", "adi/video/clip.mp4"),
    ("assets/audio/Tides_in_the_Parlor.mp3", "shared/audio/Tides_in_the_Parlor.mp3"),
]


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def upload_file(base_url: str, service_key: str, local: Path, storage_path: str) -> None:
    mime, _ = mimetypes.guess_type(local.name)
    content_type = mime or "application/octet-stream"
    url = f"{base_url.rstrip('/')}/storage/v1/object/{BUCKET}/{storage_path}"
    req = urllib.request.Request(
        url,
        data=local.read_bytes(),
        method="POST",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Upload failed {storage_path}: HTTP {exc.code} {body}") from exc

    print(f"  ok  {local.relative_to(ROOT)}  →  {storage_path}")


def main() -> None:
    load_dotenv(ROOT / ".env")
    base_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not base_url or not service_key:
        sys.exit(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment "
            "(or a local .env file — never commit it)."
        )

    print(f"Uploading {len(ADI_UPLOADS)} file(s) to bucket '{BUCKET}'…")
    for rel_local, storage_path in ADI_UPLOADS:
        local = ROOT / rel_local
        if not local.is_file():
            sys.exit(f"Missing local file: {local}")
        upload_file(base_url, service_key, local, storage_path)

    print("\nDone. Re-run your curl smoke test — signed_url should be non-null.")


if __name__ == "__main__":
    main()
