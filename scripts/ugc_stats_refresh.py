#!/usr/bin/env python3
"""
ugc_stats_refresh.py — Actualiza stats de todos los videos activos
──────────────────────────────────────────────────────────────────
Lee la lista de videos activos desde Supabase, navega cada URL en TikTok
con Playwright, extrae views/likes/comments/shares del JSON oculto y
actualiza la BD.

Corre via PM2 en modo fork con cron: "*/90 * * * *"

Uso:
  python3 ugc_stats_refresh.py
"""

import asyncio
import os
import logging
import requests
from datetime import datetime, timezone

# ─── CONFIG ──────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://koc.hikvisionlatam.tech"
SERVICE_ROLE  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk4MTI2MjEsImV4cCI6MTkzNzQ5MjYyMX0.AIhivCNYk62klNUA_2ThkbIZyvSk-BvBzvB_RTf5XpE"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# ─── LOGGING ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ─── SUPABASE REST ────────────────────────────────────────────────────────────
HEADERS = {
    "apikey":        SERVICE_ROLE,
    "Authorization": f"Bearer {SERVICE_ROLE}",
    "Content-Type":  "application/json",
}

def sb_get_active_videos():
    """Retorna lista de {id, tiktok_url} de videos activos."""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/videos",
        headers=HEADERS,
        params={"status": "eq.active", "select": "id,tiktok_url"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()

def sb_update_stats(video_id, views, likes, comments, shares):
    now = datetime.now(timezone.utc).isoformat()
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/videos",
        headers=HEADERS,
        params={"id": f"eq.{video_id}"},
        json={
            "views":            views,
            "likes":            likes,
            "comments":         comments,
            "shares":           shares,
            "stats_updated_at": now,
        },
        timeout=15,
    )
    r.raise_for_status()

# ─── SCRAPER ─────────────────────────────────────────────────────────────────
async def fetch_stats(page, url):
    """Navega a la URL de TikTok y extrae stats del JSON oculto."""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        await asyncio.sleep(2)

        data = await page.evaluate("""() => {
            try {
                const s = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                if (!s) return null;
                const j = JSON.parse(s.textContent);
                const d = j.__DEFAULT_SCOPE__ || {};
                const vd = d['webapp.video-detail'] || {};
                const item = (vd.itemInfo || {}).itemStruct || {};
                const st = item.stats || {};
                return {
                    views:    st.playCount    || 0,
                    likes:    st.diggCount    || 0,
                    comments: st.commentCount || 0,
                    shares:   st.shareCount   || 0,
                };
            } catch(e) { return null; }
        }""")
        return data
    except Exception as e:
        log.warning(f"Error scrapeando {url}: {e}")
        return None

async def run_refresh():
    from playwright.async_api import async_playwright

    log.info("═══ UGC Stats Refresh — inicio ═══")
    videos = sb_get_active_videos()
    log.info(f"Videos activos a actualizar: {len(videos)}")

    if not videos:
        log.info("Nada que actualizar.")
        return

    updated = 0
    failed  = 0

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(user_agent=USER_AGENT, locale="es-LA")
        page = await ctx.new_page()

        # Calentamiento — visitar TikTok primero para cookies de sesión
        try:
            await page.goto("https://www.tiktok.com", timeout=30_000)
            await asyncio.sleep(2)
        except Exception:
            pass

        for vid in videos:
            vid_id  = vid["id"]
            tiktok_url = vid["tiktok_url"]
            log.info(f"  → {tiktok_url.split('/')[-1]}")

            stats = await fetch_stats(page, tiktok_url)
            if stats:
                try:
                    sb_update_stats(
                        vid_id,
                        stats["views"],
                        stats["likes"],
                        stats["comments"],
                        stats["shares"],
                    )
                    log.info(
                        f"    ✓ views={stats['views']:,}  "
                        f"likes={stats['likes']:,}  "
                        f"shares={stats['shares']:,}"
                    )
                    updated += 1
                except Exception as e:
                    log.error(f"    ✗ Error actualizando BD: {e}")
                    failed += 1
            else:
                log.warning(f"    ✗ No se pudo obtener stats")
                failed += 1

            await asyncio.sleep(1.5)  # Pausa entre requests

        await browser.close()

    log.info(f"═══ Refresh completado: {updated} actualizados · {failed} fallidos ═══")

if __name__ == "__main__":
    asyncio.run(run_refresh())
