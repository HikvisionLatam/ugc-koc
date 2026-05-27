# UGC Manager — Hikvision LATAM
## Documento maestro del proyecto · Leído automáticamente por Claude Code

---

## Qué es este sistema

Portal de gestión de contenido UGC (User Generated Content) para Hikvision LATAM.
Permite a un equipo de marketing administrar videos de TikTok de creadores de
contenido y embeberlos en las websites AEM de Hikvision por país, sin tocar AEM
directamente.

El sistema tiene dos piezas:

1. **ugc-admin** — dashboard privado para el equipo de Hikvision (Next.js 14)
2. **ugc-iframe** — componente público embebido vía `<iframe>` en AEM (React + Vite)

Todo corre en infraestructura propia. Costo mensual: $0.

---

## Infraestructura existente — no recrear, no reinstalar

### Servidor físico
- Host: `hikvisionlatam.tech`
- Usuario SSH: `marketing-digital`
- Acceso vía Cloudflare Tunnel (cloudflared ya instalado y configurado)
- SSH key ya autorizada: `~/.ssh/claude_ed25519`

```bash
# Comando SSH completo
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech
```

### Supabase KOC (self-hosted, ya corriendo)
- Studio: `https://koc.hikvisionlatam.tech/project/default`
- API URL: `https://koc.hikvisionlatam.tech`
- Credenciales en `.env` del proyecto (ver sección de variables)
- PostgreSQL directo: `docker exec koc-db-1 psql -U postgres -d postgres`

### Servidor de assets (Nginx)
- Ruta física: `/var/www/kocassets/ugc/thumbnails/` y `/var/www/kocassets/ugc/videos/`
- Puerto local: `8089`
- URL pública: `https://kocassets.hikvisionlatam.tech/ugc/`
- Cloudflare Tunnel expone el subdominio con CDN encima

### Scraper existente — reutilizar, no reescribir
- Archivo: `latam.py`
- Stack: Playwright async + extracción de JSON `__UNIVERSAL_DATA_FOR_REHYDRATION__`
- Función principal: `process_video_via_json(page, url, context)`
- Ya procesa 19 videos de `@hikvisionlatam` correctamente
- Extrae: `id`, `desc`, `playAddr`, `cover`, `stats` (views, likes, comments, shares)
- También extrae el `author` del video (username de TikTok)

---

## Reglas de autenticación y usuarios

### Quién puede acceder al admin
- **Solo 2 cuentas de administrador** — no hay roles, no hay jerarquía
- El email **debe terminar en `@hikvision.com`** — validar en el login y en el backend
- Supabase Auth maneja las sesiones
- Si el email no es `@hikvision.com`, rechazar con mensaje claro

### Cómo crear los usuarios
```sql
-- En Supabase Studio → Authentication → Users → Add user
-- Email: admin@hikvision.com (y la segunda cuenta)
-- Luego insertar en user_profiles:
INSERT INTO public.user_profiles (id, full_name)
VALUES ('UUID-DEL-USUARIO', 'Nombre del admin');
```

### Restricción de dominio en el login
```typescript
// Validar antes de llamar a Supabase Auth
if (!email.endsWith('@hikvision.com')) {
  setError('Solo se permiten cuentas @hikvision.com')
  return
}
```

---

## Estructura de datos — lo que el sistema maneja

### Entidades principales

```
websites          → los sitios donde aparecen los videos (co, mx, br, latam)
landings          → páginas dentro de cada website (colorvu, acusense, homepage, etc.)
videos            → registros de cada video de TikTok
ugc_creators      → los creadores de contenido (con país de origen)
video_landings    → relación video ↔ landing (con link_producto y estado activo/inactivo)
```

### Sobre los creadores (`ugc_creators`)
- Cuando se agrega un video por URL de TikTok, el sistema **extrae el username del autor**
  automáticamente del scraper
- Si el creador no existe en la DB, se **pregunta al admin de qué país es**
- El país del creador se guarda para mostrarlo más adelante en el iframe público
- Campos mínimos: `tiktok_username`, `country_code`, `display_name`

### Dos estilos de visualización del iframe
El campo `landing_type` en la tabla `landings` distingue:
- `'product'` — landing de producto (ColorVu, AcuSense, etc.) → slider estándar
- `'homepage'` — homepage del sitio → slider con más énfasis visual, link_producto siempre presente

El iframe recibe `landing_type` en la respuesta del API y ajusta su layout.

---

## Flujo completo — agregar un video nuevo

```
Admin abre modal "Agregar video"
  ↓
Pega URL de TikTok
  ↓
Sistema hace scraping (Playwright):
  - Extrae metadata del video (descripción, stats, thumbnail, video URL)
  - Extrae username del autor
  ↓
¿El autor ya existe en ugc_creators?
  → Sí: continuar
  → No: mostrar campo "¿De qué país es este creador?" (select de países)
  ↓
Admin completa el formulario:
  - Landing donde aparece (select de landings disponibles)
  - Link del producto (opcional — requerido si landing_type = 'homepage')
  - Website(s) de destino (co, mx, br, latam — multi-select)
  ↓
Opciones: [Cancelar] [Guardar como borrador] [Publicar]
  ↓
Si Publicar:
  - Thumbnail → WebP → /var/www/kocassets/ugc/thumbnails/{id}.webp
  - Video MP4 → /var/www/kocassets/ugc/videos/{id}.mp4
  - INSERT en videos + video_landings
  - El iframe lo muestra inmediatamente
```

---

## Gestión de visibilidad por región

Un video puede estar **activo en LATAM pero pausado en Colombia** al mismo tiempo.
La tabla `video_landings` tiene un campo `active` por cada combinación video+landing.

En la pantalla de edición de un video el admin puede:
- Ver métricas: views, likes, shares (extraídas del scraper, actualizables)
- Ver si tiene `link_producto` configurado
- Activar/desactivar el video **por landing específica** (no globalmente)
- Ver el país del creador

```
video_landings:
  video_id     → FK a videos
  landing_id   → FK a landings (que tiene website_id)
  link_producto → nullable
  active        → boolean (controla si aparece en el iframe de esa landing)
  position      → integer (orden en el slider)
```

---

## Schema SQL completo

Ejecutar en orden en Supabase KOC Studio:

```sql
-- 1. Creadores UGC
CREATE TABLE public.ugc_creators (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_username text NOT NULL UNIQUE,
  display_name    text,
  country_code    text NOT NULL,  -- 'co', 'mx', 'br', 'ar', 'pe', etc.
  country_name    text NOT NULL,  -- 'Colombia', 'México', etc.
  created_at      timestamptz DEFAULT now()
);

-- 2. Websites
CREATE TABLE public.websites (
  id         text PRIMARY KEY,  -- 'co', 'mx', 'br', 'latam'
  name       text NOT NULL,
  url        text NOT NULL,
  flag       text,
  lang       text DEFAULT 'es',
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.websites (id, name, url, flag, lang) VALUES
  ('latam', 'LATAM General', 'hikvision.com/latam', '🌎', 'es'),
  ('co',    'Colombia',      'hikvision.com/co',    '🇨🇴', 'es'),
  ('mx',    'México',        'hikvision.com/mx',    '🇲🇽', 'es'),
  ('br',    'Brasil',        'hikvision.com/br',    '🇧🇷', 'pt');

-- 3. Landings
CREATE TABLE public.landings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id   text REFERENCES public.websites(id) ON DELETE CASCADE,
  slug         text NOT NULL,
  name         text NOT NULL,
  path         text,
  landing_type text DEFAULT 'product' CHECK (landing_type IN ('product', 'homepage')),
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(website_id, slug)
);

INSERT INTO public.landings (website_id, slug, name, path, landing_type) VALUES
  ('latam', 'colorvu',    'ColorVu',        '/productos/colorvu',   'product'),
  ('latam', 'acusense',   'AcuSense',       '/productos/acusense',  'product'),
  ('latam', 'pymes',      'PyMEs / Villas', '/soluciones/pymes',    'product'),
  ('latam', 'home',       'Homepage LATAM', '/',                    'homepage'),
  ('co',    'colorvu',    'ColorVu CO',     '/productos/colorvu',   'product'),
  ('co',    'home',       'Homepage CO',    '/',                    'homepage'),
  ('mx',    'colorvu',    'ColorVu MX',     '/productos/colorvu',   'product'),
  ('br',    'colorvu',    'ColorVu BR',     '/produtos/colorvu',    'product');

-- 4. Videos
CREATE TABLE public.videos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_url       text NOT NULL UNIQUE,
  tiktok_id        text GENERATED ALWAYS AS (split_part(tiktok_url, '/video/', 2)) STORED,
  creator_id       uuid REFERENCES public.ugc_creators(id),
  description      text,
  thumbnail_url    text,
  video_url        text,
  views            integer DEFAULT 0,
  likes            integer DEFAULT 0,
  comments         integer DEFAULT 0,
  shares           integer DEFAULT 0,
  stats_updated_at timestamptz,
  status           text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'draft')),
  created_at       timestamptz DEFAULT now(),
  created_by       uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_videos_status    ON public.videos(status);
CREATE INDEX idx_videos_creator   ON public.videos(creator_id);

-- 5. Video ↔ Landing (relación con visibilidad por región)
CREATE TABLE public.video_landings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  landing_id    uuid REFERENCES public.landings(id) ON DELETE CASCADE,
  link_producto text,
  active        boolean DEFAULT true,
  position      integer DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(video_id, landing_id)
);

CREATE INDEX idx_vl_landing_active ON public.video_landings(landing_id, active);

-- 6. Perfiles de admin (solo 2 cuentas)
CREATE TABLE public.user_profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  created_at timestamptz DEFAULT now()
);

-- 7. Activity log
CREATE TABLE public.activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_log_created ON public.activity_log(created_at DESC);
```

### RLS (Row Level Security)

```sql
ALTER TABLE public.videos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_landings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugc_creators    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles   ENABLE ROW LEVEL SECURITY;

-- Lectura pública para el iframe (videos activos)
CREATE POLICY "videos_public_read"
  ON public.videos FOR SELECT USING (status = 'active');

CREATE POLICY "vl_public_read"
  ON public.video_landings FOR SELECT USING (active = true);

CREATE POLICY "landings_public_read"
  ON public.landings FOR SELECT USING (true);

CREATE POLICY "websites_public_read"
  ON public.websites FOR SELECT USING (true);

CREATE POLICY "creators_public_read"
  ON public.ugc_creators FOR SELECT USING (true);

-- Escritura solo para usuarios autenticados con @hikvision.com
-- (la validación de dominio ocurre en el backend, no en RLS)
CREATE POLICY "videos_auth_write"
  ON public.videos FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "vl_auth_write"
  ON public.video_landings FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "landings_auth_write"
  ON public.landings FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "websites_auth_write"
  ON public.websites FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "creators_auth_write"
  ON public.ugc_creators FOR ALL
  USING (auth.uid() IS NOT NULL);
```

### Vista para el iframe

```sql
CREATE OR REPLACE VIEW public.v_iframe_videos AS
SELECT
  v.id,
  v.tiktok_url,
  v.tiktok_id,
  v.description,
  v.thumbnail_url,
  v.video_url,
  v.views,
  v.likes,
  v.shares,
  vl.link_producto,
  vl.position,
  l.slug           AS landing_slug,
  l.name           AS landing_name,
  l.landing_type,
  l.website_id,
  w.lang,
  c.tiktok_username AS creator_username,
  c.display_name    AS creator_name,
  c.country_code    AS creator_country,
  c.country_name    AS creator_country_name
FROM public.video_landings vl
JOIN public.videos      v  ON v.id  = vl.video_id
JOIN public.landings    l  ON l.id  = vl.landing_id
JOIN public.websites    w  ON w.id  = l.website_id
LEFT JOIN public.ugc_creators c ON c.id = v.creator_id
WHERE
  v.status    = 'active'
  AND vl.active   = true
  AND l.active    = true
  AND w.active    = true
ORDER BY
  vl.position ASC,
  v.created_at DESC;
```

---

## Variables de entorno

### ugc-admin (.env)
```env
# Supabase KOC
NEXT_PUBLIC_SUPABASE_URL=https://koc.hikvisionlatam.tech
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5ODEyNjIxLCJleHAiOjE5Mzc0OTI2MjF9.dXnH0Wnss3yUGg90O9OA7QKzRlMXhX8GiTYgFPVEvlc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk4MTI2MjEsImV4cCI6MTkzNzQ5MjYyMX9.AIhivCNYk62klNUA_2ThkbIZyvSk-BvBzvB_RTf5XpE

# Assets en servidor propio
UGC_ASSETS_LOCAL_PATH=/var/www/kocassets/ugc
UGC_ASSETS_PUBLIC_URL=https://kocassets.hikvisionlatam.tech/ugc
```

### ugc-iframe (.env)
```env
VITE_API_URL=https://ugc-admin.hikvisionlatam.tech
```

---

## Endpoints de la API

```
# Públicos (sin auth) — usados por el iframe
GET  /api/ugc/iframe          ?site=co&landing=colorvu

# Protegidos (requieren sesión @hikvision.com)
POST   /api/ugc/process-video   { tiktok_url, landing_id, website_ids[], link_producto?, country_code? }
GET    /api/ugc/videos          ?site=co&landing=colorvu
PATCH  /api/ugc/videos/:id      { status?, link_producto?, landing_id?, active? }

GET    /api/ugc/websites
POST   /api/ugc/websites        { id, name, url, flag, lang }

GET    /api/ugc/websites/:site/landings
POST   /api/ugc/landings        { website_id, slug, name, path, landing_type }

GET    /api/ugc/creators
POST   /api/ugc/creators        { tiktok_username, country_code, country_name, display_name }

# Verificación del creador durante el flujo de agregar video
GET    /api/ugc/creators/check  ?username=hikvisioncolombia
# Devuelve { exists: bool, creator?: { id, country_code, country_name } }
```

---

## Pantallas del admin — especificación funcional

### 1. Login (`/login`)
- Campo email con validación `@hikvision.com` en cliente antes de llamar a Supabase
- Campo contraseña
- Error claro si el dominio no es correcto: "Solo cuentas @hikvision.com tienen acceso"
- Error de Supabase si las credenciales no son válidas: "Credenciales incorrectas"
- Redirect a `/websites` tras login exitoso

### 2. Dashboard de websites (`/websites`)
- Grid de cards, una por website activa
- Cada card muestra: flag, nombre, URL, número de landings activas
- Botón "Agregar website" — abre modal con campos: nombre, URL, código (co/mx/br/etc.), flag, idioma
- Click en card → navega a `/websites/:site`

### 3. Landings de una website (`/websites/:site`)
- Lista de landings de esa website
- Cada item muestra: nombre, slug, tipo (product/homepage), cantidad de videos activos
- Botón "Agregar landing" — campos: nombre, slug, path en AEM, tipo (product/homepage)
- Click en landing → navega a `/websites/:site/:landing`

### 4. Videos de una landing (`/websites/:site/:landing`)
- Grid de VideoCards (thumbnail 9:16, descripción truncada, stats, estado)
- Botón prominente "+ Agregar video"
- Click en card → abre panel lateral (sheet) de edición del video

### 5. Modal "Agregar video"
Estados en orden:
```
[input URL] → [verificando creador] → [¿nuevo creador? → país] → [configurar] → [procesando] → [listo/error]
```

Campos del formulario (paso "configurar"):
- URL de TikTok (ya validada)
- Landing(s) donde aparecerá (multi-select, pre-seleccionada la landing actual)
- Website(s) de destino (multi-select: co, mx, br, latam)
- Link de producto (opcional para landings `product`, requerido para `homepage`)
- País del creador (solo aparece si es creador nuevo — select de países LATAM)

Botones: `Cancelar` · `Guardar borrador` · `Publicar`

### 6. Panel de edición de video (sheet lateral)
- Thumbnail del video (preview)
- Métricas: views, likes, shares (con botón "Actualizar stats")
- País del creador y username de TikTok
- URL del video en TikTok (link externo)
- Link de producto actual (editable)
- Toggle activo/inactivo **por landing** (no global)
  - Si tiene 3 landings, se ven 3 toggles independientes
- Botón "Eliminar video" (soft delete → status = 'deleted', con confirmación)

---

## ugc-admin — estructura de carpetas

```
ugc-admin/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← sidebar + topbar
│   │   ├── websites/
│   │   │   ├── page.tsx            ← grid de websites
│   │   │   └── [site]/
│   │   │       ├── page.tsx        ← landings de una website
│   │   │       └── [landing]/
│   │   │           └── page.tsx    ← videos de una landing
│   └── api/
│       └── ugc/
│           ├── process-video/route.ts
│           ├── iframe/route.ts
│           ├── videos/[id]/route.ts
│           ├── websites/route.ts
│           ├── landings/route.ts
│           └── creators/
│               ├── route.ts
│               └── check/route.ts
├── components/ugc/
│   ├── VideoCard.tsx
│   ├── AddVideoModal.tsx           ← modal multi-paso
│   ├── EditVideoSheet.tsx          ← panel lateral de edición
│   ├── WebsiteCard.tsx
│   ├── LandingItem.tsx
│   └── Sidebar.tsx
├── hooks/
│   ├── useUser.ts
│   └── useVideos.ts
└── lib/
    ├── supabase.ts
    ├── auth.ts                     ← requireAdmin() + validación @hikvision.com
    └── assetPipeline.ts            ← saveThumbnail + saveVideo (filesystem local)
```

---

## ugc-iframe — estructura de carpetas

```
ugc-iframe/
├── src/
│   ├── App.tsx                     ← fetch + render condicional
│   ├── main.tsx
│   ├── components/
│   │   ├── UGCSlider.tsx           ← composición responsiva (xs/sm/md/lg)
│   │   ├── VideoMain.tsx           ← video grande con controles
│   │   └── ThumbGrid.tsx           ← miniaturas navegables
│   ├── hooks/
│   │   ├── useParams.ts            ← lee site + landing del URL
│   │   ├── useVideos.ts            ← fetch + revalidación 5min
│   │   └── useContainerSize.ts     ← ResizeObserver → xs/sm/md/lg
│   └── styles/
│       ├── tokens.css
│       └── global.css
└── vite.config.ts
```

**Breakpoints del iframe:**
- `xs` (< 300px): solo video principal, sin miniaturas
- `sm` (300–440px): video 55% + 1 col miniaturas
- `md` (440–620px): video 44% + 2 cols miniaturas ← default AEM
- `lg` (> 620px): video 38% + 3 cols miniaturas

---

## Estándares de código (skills activas)

Las siguientes skills están instaladas globalmente en este proyecto:
- **emilkowalski/skill** — microinteracciones con física real
- **pbakaus/impeccable** — cero tolerancia a detalles descuidados
- **Leonxlnx/taste-skill** — criterio de diseño

### Aplicación concreta

**Animaciones:**
```typescript
// Spring easing — usar siempre para elementos que entran/salen
const spring = { duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }
// Exit easing — para elementos que desaparecen
const fadeOut = { duration: 0.15, ease: 'easeOut' }
```

**Spacing (base 4px, sin excepciones):**
```css
--s1: 4px;  --s2: 8px;  --s3: 12px;  --s4: 16px;
--s5: 20px; --s6: 24px; --s8: 32px;  --s10: 40px;
```

**Fuente del admin:** Geist (next/font) — monoespaciada para IDs y métricas
**Fuente del iframe:** system font stack — velocidad de carga máxima

**Estados obligatorios en todo componente:**
- `loading` — skeleton con shimmer (no spinner genérico)
- `error` — mensaje claro con acción posible
- `empty` — estado vacío útil, no un div invisible

**Botones — texto de acción específica:**
- ✅ "Procesar y publicar" / "Guardar borrador" / "Activar en Colombia"
- ❌ "Confirmar" / "Aceptar" / "OK"

---

## Pipeline de assets — cómo funciona

El backend (ugc-admin) corre en el mismo servidor que Nginx.
Los archivos se escriben directamente al filesystem — sin S3, sin R2, sin SCP.

```
TikTok (playAddr URL)
  ↓ requests + cookies de sesión Playwright
MP4 temporal en RAM/tmp
  ↓ escritura directa
/var/www/kocassets/ugc/videos/{tiktok_id}.mp4
  ↓ Nginx sirve en :8089
  ↓ Cloudflare Tunnel + CDN
https://kocassets.hikvisionlatam.tech/ugc/videos/{tiktok_id}.mp4

TikTok (cover URL)
  ↓ requests.get
Pillow → convertir a WebP (quality=80)
  ↓ escritura directa
/var/www/kocassets/ugc/thumbnails/{tiktok_id}.webp
  ↓ Nginx + CDN
https://kocassets.hikvisionlatam.tech/ugc/thumbnails/{tiktok_id}.webp
```

**Idempotencia:** si el archivo ya existe en disco, devolver la URL sin reprocessar.

---

## Integración con AEM (iframe)

```html
<!-- Ejemplo para Colombia, landing ColorVu -->
<iframe
  src="https://ugc.hikvisionlatam.tech/embed?site=co&landing=colorvu"
  width="100%"
  height="520"
  frameborder="0"
  scrolling="no"
  title="Videos ColorVu en TikTok — Hikvision Colombia"
  loading="lazy"
  allow="autoplay"
  style="border: none; display: block;"
></iframe>
```

El iframe es silencioso si no hay videos: envía `postMessage({ type: 'UGC_EMPTY' })` al padre y retorna `null`.

---

## Qué NO hacer

- No regenerar `~/.ssh/claude_ed25519` — ya está autorizada
- No crear nuevo proyecto Supabase — usar KOC existente
- No instalar cloudflared — ya está en el servidor
- No usar Cloudflare R2 — assets al servidor propio
- No usar Tailwind en ugc-iframe — aumenta el bundle
- No usar Google Fonts en ugc-iframe — carga más lento
- No usar roles/jerarquía de usuarios — solo 2 admins, ambos iguales
- No reescribir `latam.py` — solo importar/reutilizar su lógica

---

## Orden de implementación

```
1. SQL en Supabase KOC Studio (01-database.md → este CLAUDE.md tiene el schema)
2. Nginx kocassets (03-server-assets.md)
3. ugc-admin: lib/ + api/ (02-backend-api.md)
4. ugc-admin: app/ + components/ (04-admin-portal.md)
5. ugc-iframe: src/ (05-iframe-embed.md)
6. AEM tags (06-aem-integration.md)
7. Auth y middleware (07-roles-auth.md)
```

## Verificación rápida de conectividad

```bash
# Supabase KOC
curl https://koc.hikvisionlatam.tech/rest/v1/websites \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5ODEyNjIxLCJleHAiOjE5Mzc0OTI2MjF9.dXnH0Wnss3yUGg90O9OA7QKzRlMXhX8GiTYgFPVEvlc" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5ODEyNjIxLCJleHAiOjE5Mzc0OTI2MjF9.dXnH0Wnss3yUGg90O9OA7QKzRlMXhX8GiTYgFPVEvlc"

# Assets server
curl -I https://kocassets.hikvisionlatam.tech/ugc/thumbnails/test.jpg

# Iframe endpoint (cuando el backend esté listo)
curl "https://ugc-admin.hikvisionlatam.tech/api/ugc/iframe?site=latam&landing=colorvu"
```
