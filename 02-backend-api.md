# 02 — Backend API + Pipeline de assets

## Objetivo
Construir los endpoints que el dashboard admin consume y el pipeline que extrae videos de TikTok, los guarda en el servidor (`/var/www/kocassets/ugc/`) y los registra en Supabase KOC.

**Tiempo estimado:** 3–4 horas
**Dependencias:** `01-database.md` y `03-server-assets.md` completados
**Siguiente módulo:** `04-admin-portal.md`

---

## Stack del backend

El backend corre como proceso PM2 en el servidor, lo que simplifica el pipeline de assets — los archivos se escriben directamente al filesystem local sin necesidad de SCP ni transferencias de red.

```
PM2 en hikvisionlatam.tech
  → Next.js API Routes (o FastAPI)
  → Escribe assets directo a /var/www/kocassets/ugc/
  → Nginx los sirve en kocassets.hikvisionlatam.tech
  → Registra en Supabase KOC (koc.hikvisionlatam.tech)
```

---

## 1. Variables de entorno

```env
# Supabase KOC
NEXT_PUBLIC_SUPABASE_URL=https://koc.hikvisionlatam.tech
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5ODEyNjIxLCJleHAiOjE5Mzc0OTI2MjF9.dXnH0Wnss3yUGg90O9OA7QKzRlMXhX8GiTYgFPVEvlc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk4MTI2MjEsImV4cCI6MTkzNzQ5MjYyMX9.AIhivCNYk62klNUA_2ThkbIZyvSk-BvBzvB_RTf5XpE

# Assets — rutas del servidor propio
UGC_ASSETS_LOCAL_PATH=/var/www/kocassets/ugc
UGC_ASSETS_PUBLIC_URL=https://kocassets.hikvisionlatam.tech/ugc

# Seguridad interna
UGC_API_SECRET=generar-token-aleatorio-largo-aqui
```

---

## 2. Endpoints

```
POST   /api/ugc/process-video          → scraper + pipeline + guardar en DB
GET    /api/ugc/videos                 → lista de videos para el admin
GET    /api/ugc/videos/:id             → detalle de un video
PATCH  /api/ugc/videos/:id             → editar (status, link_producto, posición)
DELETE /api/ugc/videos/:id             → soft delete (status = 'deleted')

GET    /api/ugc/websites               → lista de websites
GET    /api/ugc/websites/:site/landings → landings de una website

GET    /api/ugc/iframe                 → endpoint público para el iframe
                                         ?site=co&landing=colorvu
```

---

## 3. Pipeline de assets — escritura local en el servidor

Sin boto3, sin SCP, sin R2. El backend corre en el mismo servidor donde vive Nginx.

```python
# services/asset_pipeline.py
import os
import requests
from io import BytesIO
from PIL import Image

ASSETS_LOCAL = os.getenv("UGC_ASSETS_LOCAL_PATH", "/var/www/kocassets/ugc")
ASSETS_PUBLIC = os.getenv("UGC_ASSETS_PUBLIC_URL", "https://kocassets.hikvisionlatam.tech/ugc")


def save_thumbnail(video_id: str, raw_url: str) -> str | None:
    """
    Descarga el thumbnail de TikTok, lo convierte a WebP optimizado
    y lo guarda en disco. Retorna la URL pública o None si falla.
    Idempotente: si el archivo ya existe, retorna la URL sin reprocessar.
    """
    if not raw_url:
        return None

    dest_path  = f"{ASSETS_LOCAL}/thumbnails/{video_id}.webp"
    public_url = f"{ASSETS_PUBLIC}/thumbnails/{video_id}.webp"

    # Idempotencia — no reprocessar si ya existe
    if os.path.exists(dest_path):
        return public_url

    try:
        res = requests.get(raw_url, timeout=10)
        res.raise_for_status()

        img = Image.open(BytesIO(res.content)).convert("RGB")
        img.save(dest_path, format="WEBP", quality=80)

        return public_url

    except Exception as e:
        print(f"[ERROR] thumbnail {video_id}: {e}")
        return None


def save_video(video_id: str, download_url: str, cookies: list[dict]) -> str | None:
    """
    Descarga el video de TikTok usando cookies de sesión del browser
    y lo guarda en disco. Retorna la URL pública o None si falla.
    """
    if not download_url:
        return None

    dest_path  = f"{ASSETS_LOCAL}/videos/{video_id}.mp4"
    public_url = f"{ASSETS_PUBLIC}/videos/{video_id}.mp4"

    # Idempotencia
    if os.path.exists(dest_path):
        return public_url

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer":    "https://www.tiktok.com/",
        "Origin":     "https://www.tiktok.com",
    })
    for c in cookies:
        session.cookies.set(c["name"], c["value"], domain=c["domain"])

    try:
        with session.get(download_url, stream=True, timeout=60) as r:
            if r.status_code == 403:
                print(f"[ERROR] 403 Forbidden — TikTok rechazó las cookies para {video_id}")
                return None
            r.raise_for_status()

            with open(dest_path, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)

        # Validar que el archivo no esté vacío o corrupto
        if os.path.getsize(dest_path) < 1000:
            print(f"[ERROR] Video inválido ({os.path.getsize(dest_path)}B) para {video_id}")
            os.remove(dest_path)
            return None

        return public_url

    except Exception as e:
        print(f"[ERROR] video {video_id}: {e}")
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return None


def delete_assets(video_id: str) -> None:
    """Elimina los archivos físicos cuando se borra un video del sistema."""
    for path in [
        f"{ASSETS_LOCAL}/thumbnails/{video_id}.webp",
        f"{ASSETS_LOCAL}/videos/{video_id}.mp4",
    ]:
        if os.path.exists(path):
            os.remove(path)
            print(f"[OK] Eliminado: {path}")
```

---

## 4. Endpoint principal — `POST /api/ugc/process-video`

### Versión FastAPI (Python — recomendada para reusar `latam.py`)

```python
# routes/process_video.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from services.asset_pipeline import save_thumbnail, save_video
from services.scraper import scrape_tiktok_video
from lib.supabase import supabase_server
from lib.auth import require_editor

router = APIRouter(prefix="/api/ugc")


class ProcessVideoRequest(BaseModel):
    tiktok_url:    str
    landing_id:    str
    link_producto: Optional[str] = None


@router.post("/process-video")
async def process_video(body: ProcessVideoRequest, user=Depends(require_editor)):

    # 1. Validar URL
    if "tiktok.com" not in body.tiktok_url or "/video/" not in body.tiktok_url:
        raise HTTPException(400, "URL de TikTok inválida")

    # 2. Verificar duplicado
    existing = supabase_server.table("videos").select("id") \
        .eq("tiktok_url", body.tiktok_url).execute()
    if existing.data:
        raise HTTPException(409, "Este video ya existe en el sistema")

    # 3. Scraper Playwright (lógica de latam.py)
    video_data = await scrape_tiktok_video(body.tiktok_url)
    if not video_data:
        raise HTTPException(502, "No se pudo extraer información de TikTok")

    video_id = video_data["id"]

    # 4. Pipeline de assets — directo al filesystem
    thumbnail_url = save_thumbnail(video_id, video_data.get("raw_thumb_url"))
    video_url     = save_video(video_id, video_data.get("raw_download_url"), video_data.get("cookies", []))

    # 5. Guardar en Supabase KOC
    result = supabase_server.rpc("insert_video_with_landing", {
        "p_tiktok_url":    body.tiktok_url,
        "p_description":   video_data.get("description", ""),
        "p_thumbnail_url": thumbnail_url,
        "p_video_url":     video_url,
        "p_views":         video_data.get("views", 0),
        "p_likes":         video_data.get("likes", 0),
        "p_comments":      video_data.get("comments", 0),
        "p_shares":        video_data.get("shares", 0),
        "p_landing_id":    body.landing_id,
        "p_link_producto": body.link_producto,
    }).execute()

    # 6. Log de actividad
    supabase_server.table("activity_log").insert({
        "user_id":     str(user.id),
        "action":      "video.published",
        "entity_type": "video",
        "entity_id":   str(result.data),
        "metadata":    {"tiktok_url": body.tiktok_url, "landing_id": body.landing_id},
    }).execute()

    status = "success" if video_url else "partial"
    return {"video_id": str(result.data), "thumbnail_url": thumbnail_url, "video_url": video_url, "status": status}
```

### Versión Next.js (TypeScript)

```typescript
// app/api/ugc/process-video/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { requireEditor } from '@/lib/auth'
import { saveThumbnail, saveVideo } from '@/lib/assetPipeline'
import { scrapeVideo } from '@/lib/scraper'

export async function POST(req: NextRequest) {
  const user = await requireEditor(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tiktok_url, landing_id, link_producto } = await req.json()

  if (!tiktok_url?.includes('/video/')) {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  // Verificar duplicado
  const { data: existing } = await supabaseServer
    .from('videos').select('id').eq('tiktok_url', tiktok_url).single()
  if (existing) {
    return NextResponse.json({ error: 'Video ya existe' }, { status: 409 })
  }

  // Scraper
  const videoData = await scrapeVideo(tiktok_url)
  if (!videoData) {
    return NextResponse.json({ error: 'Error extrayendo video' }, { status: 502 })
  }

  // Assets — escritura directa al filesystem del servidor
  const thumbnailUrl = await saveThumbnail(videoData.id, videoData.rawThumbUrl)
  const videoUrl     = await saveVideo(videoData.id, videoData.rawDownloadUrl, videoData.cookies)

  // Guardar en DB
  const { data: videoId } = await supabaseServer.rpc('insert_video_with_landing', {
    p_tiktok_url:    tiktok_url,
    p_description:   videoData.description,
    p_thumbnail_url: thumbnailUrl,
    p_video_url:     videoUrl,
    p_views:         videoData.views,
    p_likes:         videoData.likes,
    p_comments:      videoData.comments,
    p_shares:        videoData.shares,
    p_landing_id:    landing_id,
    p_link_producto: link_producto ?? null,
  })

  return NextResponse.json({
    video_id:      videoId,
    thumbnail_url: thumbnailUrl,
    video_url:     videoUrl,
    status:        videoUrl ? 'success' : 'partial',
  })
}
```

---

## 5. Endpoint público para el iframe — `GET /api/ugc/iframe`

Sin autenticación. Devuelve solo videos activos para el site + landing pedidos.

```typescript
// app/api/ugc/iframe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const site    = searchParams.get('site')
  const landing = searchParams.get('landing')

  if (!site || !landing) {
    return NextResponse.json({ error: 'Faltan parámetros site y landing' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('v_iframe_videos')
    .select('*')
    .eq('website_id', site)
    .eq('landing_slug', landing)
    .order('position', { ascending: true })
    .limit(12)

  if (error) {
    return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 })
  }

  return NextResponse.json(data ?? [], {
    headers: {
      'Cache-Control':                'public, s-maxage=300, stale-while-revalidate=600',
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}

// Necesario para preflight CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}
```

---

## 6. Endpoint PATCH — editar un video existente

```typescript
// app/api/ugc/videos/[id]/route.ts
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireEditor(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { status, link_producto, landing_id, active, position } = await req.json()

  if (status) {
    await supabaseServer.from('videos').update({ status }).eq('id', params.id)
  }

  if (landing_id) {
    const updates: Record<string, unknown> = {}
    if (link_producto !== undefined) updates.link_producto = link_producto
    if (active !== undefined)        updates.active = active
    if (position !== undefined)      updates.position = position

    if (Object.keys(updates).length > 0) {
      await supabaseServer.from('video_landings')
        .update(updates)
        .eq('video_id', params.id)
        .eq('landing_id', landing_id)
    }
  }

  await supabaseServer.from('activity_log').insert({
    user_id:     user.id,
    action:      `video.${status ?? 'edited'}`,
    entity_type: 'video',
    entity_id:   params.id,
    metadata:    { status, link_producto, landing_id, active },
  })

  return NextResponse.json({ ok: true })
}
```

---

## 7. Seed de los 19 videos existentes en Supabase KOC

Después de ejecutar el script de migración de assets (`03-server-assets.md`), cargar los videos en la DB:

```python
# scripts/seed_videos_to_supabase.py
import json
from supabase import create_client
import os

supabase = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Obtener el UUID de la landing LATAM general desde la DB
landing = supabase.table("landings") \
    .select("id") \
    .eq("website_id", "latam") \
    .eq("slug", "colorvu") \
    .single() \
    .execute()

LANDING_ID = landing.data["id"]
print(f"Landing ID: {LANDING_ID}")

# Cargar el JSON con las nuevas URLs (kocassets)
with open("hikvisionlatam_tiktok_videos_kocassets.json") as f:
    videos = json.load(f)

for i, v in enumerate(videos, 1):
    try:
        result = supabase.rpc("insert_video_with_landing", {
            "p_tiktok_url":    v["url"],
            "p_description":   v["description"],
            "p_thumbnail_url": v["thumbnail_url"],
            "p_video_url":     v["video_url"],
            "p_views":         v["views"],
            "p_likes":         v["likes"],
            "p_comments":      v["comments"],
            "p_shares":        v["shares"],
            "p_landing_id":    LANDING_ID,
            "p_link_producto": v.get("LinkProducto") or None,
        }).execute()
        vid_id = v["url"].split("/video/")[-1]
        print(f"[{i}/{len(videos)}] OK: {vid_id}")
    except Exception as e:
        print(f"[{i}/{len(videos)}] ERROR: {e}")

print("\nSeed completo.")
```

---

## 8. Deploy con PM2

```bash
# En el servidor, desde el directorio del proyecto
pm2 start "npm run start" --name ugc-api
pm2 save

# Ver logs
pm2 logs ugc-api --lines 50

# Reiniciar después de cambios
pm2 restart ugc-api
```

---

## Checklist de este módulo

- [ ] `.env` con credenciales KOC y paths de kocassets
- [ ] `asset_pipeline.py` o `assetPipeline.ts` escribe correctamente en `/var/www/kocassets/ugc/`
- [ ] Test de escritura: crear un archivo desde el backend y verificar en `kocassets.hikvisionlatam.tech`
- [ ] `POST /api/ugc/process-video` funciona end-to-end con 1 video de prueba
- [ ] `GET /api/ugc/iframe?site=latam&landing=colorvu` devuelve JSON
- [ ] Headers CORS presentes en `/api/ugc/iframe`
- [ ] Script de seed ejecutado — 19 videos en Supabase KOC
- [ ] Proceso corriendo en PM2 y persistente tras reboot

**Siguiente → `04-admin-portal.md`**
