# UGC Manager — Hikvision LATAM
## Índice del proyecto

Sistema de gestión de contenido UGC (TikTok) para embeber en websites AEM de Hikvision LATAM vía iframe. Un solo portal de administración controla qué videos aparecen en qué landings de cada país, sin tocar AEM.

Todo el stack corre en infraestructura propia — sin dependencias de servicios cloud de pago.

---

## Módulos

| # | Archivo | Qué resuelve | Dependencias |
|---|---------|-------------|--------------|
| 01 | `01-database.md` | Schema Supabase KOC, tablas, RLS, seeds | Ninguna — empezar aquí |
| 02 | `02-backend-api.md` | Endpoints REST, scraper TikTok, pipeline assets | 01 |
| 03 | `03-server-assets.md` | Nginx + kocassets, estructura de carpetas, Cloudflare Tunnel | 01 |
| 04 | `04-admin-portal.md` | Frontend del dashboard admin (Next.js) | 01, 02 |
| 05 | `05-iframe-embed.md` | Componente iframe público, slider responsivo | 02, 03 |
| 06 | `06-aem-integration.md` | Cómo embeber el iframe en AEM por país | 05 |
| 07 | `07-roles-auth.md` | Auth, roles (Admin/Editor/Viewer), acceso por website | 01, 04 |

---

## Arquitectura completa

```
Admin dashboard (Next.js)
  → POST /api/ugc/process-video
    → Scraper Playwright extrae JSON de TikTok
    → Guarda thumbnail (WebP) en /var/www/kocassets/ugc/thumbnails/
    → Guarda video    (MP4)  en /var/www/kocassets/ugc/videos/
    → Nginx sirve los archivos en puerto 8089
    → Cloudflare Tunnel expone: kocassets.hikvisionlatam.tech
    → Registra URLs públicas en Supabase KOC

Iframe público (React standalone, embebido en AEM)
  → Detecta site + landing desde params del src
  → GET /api/ugc/iframe?site=co&landing=colorvu
    → Supabase KOC devuelve videos activos
    → Assets se sirven desde kocassets.hikvisionlatam.tech
  → Renderiza UGCSlider (responsivo, formato slider único)
```

---

## URLs del sistema

| Servicio | URL |
|---------|-----|
| Supabase Studio | https://koc.hikvisionlatam.tech/project/default |
| Assets públicos | https://kocassets.hikvisionlatam.tech/ugc/... |
| Admin dashboard | https://ugc-admin.hikvisionlatam.tech (a configurar) |
| Iframe público | https://ugc.hikvisionlatam.tech/embed (a configurar) |

---

## Stack — 100% infraestructura propia

| Capa | Tecnología | Dónde corre | Costo |
|------|-----------|-------------|-------|
| Base de datos | Supabase self-hosted (KOC) | hikvisionlatam.tech | $0 |
| Assets (videos + thumbs) | Nginx file server | hikvisionlatam.tech | $0 |
| CDN sobre assets | Cloudflare Tunnel + proxy | Cloudflare free | $0 |
| Backend API | Next.js o FastAPI vía PM2 | hikvisionlatam.tech | $0 |
| Scraper | Playwright Python | hikvisionlatam.tech | $0 |
| Admin frontend | Next.js | hikvisionlatam.tech | $0 |
| Iframe público | React bundle standalone | hikvisionlatam.tech | $0 |

**Costo total: $0/mes** — todo en el servidor que ya tienes.

---

## Estructura de carpetas en el servidor

```
/var/www/kocassets/          ← raíz generalizable para otros proyectos KOC
└── ugc/                     ← proyecto UGC específico
    ├── thumbnails/
    │   ├── 7603736511044979980.webp
    │   └── ...
    └── videos/
        ├── 7603736511044979980.mp4
        └── ...
```

URLs resultantes:
```
https://kocassets.hikvisionlatam.tech/ugc/thumbnails/7603736511044979980.webp
https://kocassets.hikvisionlatam.tech/ugc/videos/7603736511044979980.mp4
```

---

## Credenciales del servidor

Ver `KOC-DB-CONNECTION.md` y `SERVER-ACCESS.md` para credenciales completas.

```bash
# Acceso SSH
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech
```

---

## Convenciones del proyecto

- Prefijo de variables de entorno: `UGC_`
- Rutas API: `/api/ugc/...`
- Países soportados: `co`, `mx`, `br`, `latam` (expandible)
- Idiomas: `es` (CO, MX, LATAM), `pt` (BR)
- Assets siempre bajo `/var/www/kocassets/ugc/` en el servidor
- Subdominio de assets: `kocassets.hikvisionlatam.tech`
