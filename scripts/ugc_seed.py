#!/usr/bin/env python3
"""
ugc_seed.py — Migración inicial de los 19 videos de @hikvisionlatam
────────────────────────────────────────────────────────────────────
1. Lee hikvisionlatam_tiktok_videos.json (en el mismo directorio)
2. Descarga thumbnails (.webp) y videos (.mp4) a /var/www/kocassets/ugc/
3. Inserta creator @hikvisionlatam en ugc_creators
4. Inserta los 19 videos en la tabla videos
5. Asigna cada video a la landing correcta según su LinkProducto

Idempotente — si el archivo ya existe o el video ya está en la BD, lo salta.
"""

import os
import json
import logging
import requests
import time
from datetime import datetime, timezone
from pathlib import Path

# ─── CONFIG ──────────────────────────────────────────────────────────────────
SUPABASE_URL  = "https://koc.hikvisionlatam.tech"
SERVICE_ROLE  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk4MTI2MjEsImV4cCI6MTkzNzQ5MjYyMX0.AIhivCNYk62klNUA_2ThkbIZyvSk-BvBzvB_RTf5XpE"

ASSETS_ROOT    = "/var/www/kocassets/ugc"
ASSETS_PUB_URL = "https://kocassets.hikvisionlatam.tech/ugc"

CREATOR = {
    "tiktok_username": "hikvisionlatam",
    "display_name":    "Hikvision LATAM",
    "country_code":    "latam",
    "country_name":    "LATAM",
}

# Palabra clave en la URL del producto → slug de landing (website=latam)
LANDING_MAP = {
    "pymes":        "pymes",
    "houses":       "pymes",
    "small-medium": "pymes",
    "acusense":     "acusense",
    "colorvu":      "colorvu",
    "deepinview":   "deepinview",
    "wonderos":     "deepinview",
    "wonderhub":    "deepinview",
}
FALLBACK_SLUG = "home"
WEBSITE_ID    = "latam"
JSON_FILE     = Path(__file__).parent / "hikvisionlatam_tiktok_videos.json"

# ─── LOGGING ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ─── SUPABASE REST ────────────────────────────────────────────────────────────
BASE_HEADERS = {
    "apikey":        SERVICE_ROLE,
    "Authorization": f"Bearer {SERVICE_ROLE}",
    "Content-Type":  "application/json",
}

def sb_upsert(path, data, on_conflict):
    h = {**BASE_HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"}
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{path}?on_conflict={on_conflict}",
        headers=h, json=data, timeout=20,
    )
    if not r.ok:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    return r.json()

def sb_get(path, params=None):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers=BASE_HEADERS, params=params, timeout=15,
    )
    r.raise_for_status()
    return r.json()

# ─── ASSET HELPERS ───────────────────────────────────────────────────────────
def download_file(url, dest_path, label):
    try:
        with requests.get(url, stream=True, timeout=300) as r:
            r.raise_for_status()
            with open(dest_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    f.write(chunk)
        size_mb = os.path.getsize(dest_path) / 1_048_576
        log.info(f"    OK  {label} ({size_mb:.1f} MB)")
        return True
    except Exception as e:
        log.error(f"    FAIL {label}: {e}")
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return False

def ensure_thumbnail(tiktok_id, r2_url):
    dest = f"{ASSETS_ROOT}/thumbnails/{tiktok_id}.webp"
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        log.info(f"    SKIP thumbnail (ya existe)")
        return f"{ASSETS_PUB_URL}/thumbnails/{tiktok_id}.webp"
    ok = download_file(r2_url, dest, f"thumbnail {tiktok_id}.webp")
    return f"{ASSETS_PUB_URL}/thumbnails/{tiktok_id}.webp" if ok else r2_url

def ensure_video(tiktok_id, r2_url):
    dest = f"{ASSETS_ROOT}/videos/{tiktok_id}.mp4"
    if os.path.exists(dest) and os.path.getsize(dest) > 100_000:
        log.info(f"    SKIP video (ya existe)")
        return f"{ASSETS_PUB_URL}/videos/{tiktok_id}.mp4"
    ok = download_file(r2_url, dest, f"video {tiktok_id}.mp4")
    return f"{ASSETS_PUB_URL}/videos/{tiktok_id}.mp4" if ok else r2_url

# ─── LANDING RESOLVER ────────────────────────────────────────────────────────
_LANDING_CACHE = {}

def load_landings():
    rows = sb_get("landings", {"website_id": f"eq.{WEBSITE_ID}", "select": "id,slug"})
    for row in rows:
        _LANDING_CACHE[row["slug"]] = row["id"]
    log.info(f"Landings '{WEBSITE_ID}': {list(_LANDING_CACHE.keys())}")

def resolve_landing(link_producto):
    link = (link_producto or "").lower()
    for kw, slug in LANDING_MAP.items():
        if kw in link:
            lid = _LANDING_CACHE.get(slug)
            if lid:
                return lid, slug
    lid = _LANDING_CACHE.get(FALLBACK_SLUG)
    return lid, FALLBACK_SLUG

# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    log.info("=== UGC Seed v2 — inicio ===")
    now = datetime.now(timezone.utc).isoformat()

    # Verificar JSON
    if not JSON_FILE.exists():
        log.error(f"Archivo no encontrado: {JSON_FILE}")
        return

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        videos = json.load(f)
    log.info(f"Videos en JSON: {len(videos)}")

    os.makedirs(f"{ASSETS_ROOT}/thumbnails", exist_ok=True)
    os.makedirs(f"{ASSETS_ROOT}/videos",     exist_ok=True)

    load_landings()

    # Upsert creator
    log.info("Creando creator @hikvisionlatam...")
    rows = sb_upsert("ugc_creators", CREATOR, "tiktok_username")
    creator_id = rows[0]["id"]
    log.info(f"  creator_id = {creator_id}")

    ok = fail = 0

    for i, vid in enumerate(videos, 1):
        url       = vid["url"]
        tiktok_id = url.split("/video/")[1]
        log.info(f"\n[{i:02d}/{len(videos)}] {tiktok_id}")

        # Assets locales
        thumb_url = ensure_thumbnail(tiktok_id, vid["thumbnail_url"])
        video_url = ensure_video(tiktok_id, vid["video_url"])

        # Upsert video en BD (tiktok_id es columna generada, no se inserta)
        row = {
            "tiktok_url":    url,
            "creator_id":    creator_id,
            "description":      vid.get("description", ""),
            "thumbnail_url":    thumb_url,
            "video_url":        video_url,
            "views":            vid.get("views", 0),
            "likes":            vid.get("likes", 0),
            "comments":         vid.get("comments", 0),
            "shares":           vid.get("shares", 0),
            "stats_updated_at": now,
            "status":           "active",
        }
        try:
            res = sb_upsert("videos", row, "tiktok_url")
            vid_db_id = res[0]["id"]
        except Exception as e:
            log.error(f"  FAIL video BD: {e}")
            fail += 1
            continue

        # Upsert video_landings
        landing_id, slug = resolve_landing(vid.get("LinkProducto", ""))
        if landing_id:
            vl = {
                "video_id":      vid_db_id,
                "landing_id":    landing_id,
                "link_producto": vid.get("LinkProducto") or None,
                "active":        True,
                "position":      i - 1,
            }
            try:
                sb_upsert("video_landings", vl, "video_id,landing_id")
                log.info(f"  -> '{WEBSITE_ID}/{slug}' pos={i - 1}")
            except Exception as e:
                log.error(f"  FAIL video_landings: {e}")
        else:
            log.warning(f"  WARNING: landing '{slug}' no encontrada")

        ok += 1
        time.sleep(0.2)

    log.info(f"\n=== Seed completo: {ok} OK | {fail} errores ===")
    log.info(f"  thumbnails: ls {ASSETS_ROOT}/thumbnails/ | wc -l")
    log.info(f"  videos:     ls {ASSETS_ROOT}/videos/ | wc -l")

if __name__ == "__main__":
    main()
