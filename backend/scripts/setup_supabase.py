#!/usr/bin/env python3
"""
Create Supabase Storage buckets via the Management API.

Usage:
    cd backend
    python scripts/setup_supabase.py
"""

import os
import sys

import requests

# ── Config ─────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

BUCKETS = [
    {"id": "videos",     "name": "videos",     "public": False},
    {"id": "frames",     "name": "frames",     "public": False},
    {"id": "thumbnails", "name": "thumbnails", "public": True},
    {"id": "models",     "name": "models",     "public": False},
    {"id": "exports",    "name": "exports",    "public": False},
]


def get_headers() -> dict:
    return {
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }


def bucket_exists(bucket_id: str) -> bool:
    url = f"{SUPABASE_URL}/storage/v1/bucket/{bucket_id}"
    resp = requests.get(url, headers=get_headers(), timeout=10)
    return resp.status_code == 200


def create_bucket(bucket: dict) -> None:
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    payload = {
        "id": bucket["id"],
        "name": bucket["name"],
        "public": bucket["public"],
        "file_size_limit": 52428800,  # 50 MB
        "allowed_mime_types": None,    # allow all
    }
    resp = requests.post(url, json=payload, headers=get_headers(), timeout=10)
    if resp.status_code in (200, 201):
        visibility = "public" if bucket["public"] else "private"
        print(f"  [OK] Created bucket '{bucket['id']}' ({visibility})")
    elif resp.status_code == 409:
        print(f"  [--] Bucket '{bucket['id']}' already exists — skipped")
    else:
        print(f"  [FAIL] Bucket '{bucket['id']}': {resp.status_code} {resp.text}")


def main() -> None:
    if not SUPABASE_URL:
        sys.exit(
            "ERROR: SUPABASE_URL (or VITE_SUPABASE_URL) is not set. "
            "Export it or add it to backend/.env"
        )
    if not SERVICE_ROLE_KEY:
        sys.exit(
            "ERROR: SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Export it or add it to backend/.env"
        )

    print(f"Connecting to Supabase: {SUPABASE_URL}")
    print(f"Creating {len(BUCKETS)} storage bucket(s)...\n")

    for bucket in BUCKETS:
        create_bucket(bucket)

    print("\nDone.")


if __name__ == "__main__":
    # Load .env if python-dotenv is available
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
    except ImportError:
        pass  # dotenv not installed — rely on shell env vars

    # Re-read after potential dotenv load
    SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")
    SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    main()
