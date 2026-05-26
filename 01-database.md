# 01 — Base de datos (Supabase KOC — self-hosted)

## Objetivo
Crear el schema completo en la instancia Supabase KOC que ya está corriendo en el servidor. Esta instancia es self-hosted — no es Supabase Cloud.

**Tiempo estimado:** 1–2 horas
**Dependencias:** Ninguna — empezar aquí
**Siguiente módulo:** `02-backend-api.md`

---

## 1. Acceso al Studio

Abrir en el navegador:

```
https://koc.hikvisionlatam.tech/project/default
Usuario:    AdminKOC
Contraseña: d430facbb5a8f04aba050f6e3e00ad3f
```

Ir a **SQL Editor** para ejecutar los bloques de este módulo.

---

## 2. Variables de entorno

Crear `.env` en la raíz del proyecto con las credenciales KOC:

```env
# Supabase KOC (self-hosted)
NEXT_PUBLIC_SUPABASE_URL=https://koc.hikvisionlatam.tech
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5ODEyNjIxLCJleHAiOjE5Mzc0OTI2MjF9.dXnH0Wnss3yUGg90O9OA7QKzRlMXhX8GiTYgFPVEvlc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk4MTI2MjEsImV4cCI6MTkzNzQ5MjYyMX9.AIhivCNYk62klNUA_2ThkbIZyvSk-BvBzvB_RTf5XpE

# Assets — servidor propio
UGC_ASSETS_PUBLIC_URL=https://kocassets.hikvisionlatam.tech/ugc
UGC_ASSETS_LOCAL_PATH=/var/www/kocassets/ugc
```

### Cliente Supabase (TypeScript)

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Solo servidor — nunca exponer en el cliente
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cliente del navegador (con RLS activo)
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

---

## 3. Schema SQL — ejecutar en SQL Editor de KOC

Ejecutar cada bloque por separado en el orden indicado.

### 3.1 Tabla `websites`

```sql
create table public.websites (
  id          text primary key,
  name        text not null,
  url         text not null,
  flag        text,
  lang        text default 'es',
  active      boolean default true,
  created_at  timestamptz default now()
);

insert into public.websites (id, name, url, flag, lang) values
  ('latam', 'LATAM General', 'hikvision.com/latam', '🌎', 'es'),
  ('co',    'Colombia',      'hikvision.com/co',    '🇨🇴', 'es'),
  ('mx',    'México',        'hikvision.com/mx',    '🇲🇽', 'es'),
  ('br',    'Brasil',        'hikvision.com/br',    '🇧🇷', 'pt');
```

### 3.2 Tabla `landings`

```sql
create table public.landings (
  id          uuid primary key default gen_random_uuid(),
  website_id  text references public.websites(id) on delete cascade,
  slug        text not null,
  name        text not null,
  path        text,
  active      boolean default true,
  created_at  timestamptz default now(),
  unique(website_id, slug)
);

insert into public.landings (website_id, slug, name, path) values
  ('latam', 'colorvu',    'ColorVu',          '/productos/colorvu'),
  ('latam', 'acusense',   'AcuSense',         '/productos/acusense'),
  ('latam', 'pymes',      'PyMEs / Villas',   '/soluciones/pymes'),
  ('latam', 'deepinview', 'DeepinView',       '/productos/deepinview'),
  ('co',    'colorvu',    'ColorVu Colombia', '/productos/colorvu'),
  ('co',    'acusense',   'AcuSense Colombia','/productos/acusense'),
  ('mx',    'colorvu',    'ColorVu México',   '/productos/colorvu'),
  ('br',    'colorvu',    'ColorVu Brasil',   '/produtos/colorvu');
```

### 3.3 Tabla `videos`

```sql
create table public.videos (
  id               uuid primary key default gen_random_uuid(),
  tiktok_url       text not null unique,
  tiktok_id        text generated always as (
                     split_part(tiktok_url, '/video/', 2)
                   ) stored,
  description      text,
  thumbnail_url    text,
  video_url        text,
  views            integer default 0,
  likes            integer default 0,
  comments         integer default 0,
  shares           integer default 0,
  stats_updated_at timestamptz,
  status           text default 'active'
                   check (status in ('active', 'paused', 'deleted')),
  created_at       timestamptz default now(),
  created_by       uuid references auth.users(id)
);

create index idx_videos_status on public.videos(status);
```

### 3.4 Tabla `video_landings`

```sql
create table public.video_landings (
  id            uuid primary key default gen_random_uuid(),
  video_id      uuid references public.videos(id) on delete cascade,
  landing_id    uuid references public.landings(id) on delete cascade,
  link_producto text,
  active        boolean default true,
  position      integer default 0,
  created_at    timestamptz default now(),
  unique(video_id, landing_id)
);

create index idx_vl_landing_active
  on public.video_landings(landing_id, active);
```

### 3.5 Tabla `user_profiles`

```sql
create table public.user_profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text,
  role             text default 'viewer'
                   check (role in ('admin', 'editor', 'viewer')),
  allowed_websites text[],
  created_at       timestamptz default now()
);
```

### 3.6 Tabla `activity_log`

```sql
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz default now()
);

create index idx_log_created on public.activity_log(created_at desc);
```

---

## 4. Row Level Security (RLS)

```sql
alter table public.videos          enable row level security;
alter table public.video_landings  enable row level security;
alter table public.landings        enable row level security;
alter table public.websites        enable row level security;
alter table public.user_profiles   enable row level security;
alter table public.activity_log    enable row level security;

-- Websites: lectura pública, escritura solo admin
create policy "websites_read_all"
  on public.websites for select using (true);

create policy "websites_admin_write"
  on public.websites for all
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Videos: el iframe lee activos, admin/editor escribe
create policy "videos_read_active"
  on public.videos for select
  using (status = 'active');

create policy "videos_write_by_role"
  on public.videos for all
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor')
    )
  );

-- Video landings: mismo patrón
create policy "vl_read_active"
  on public.video_landings for select
  using (active = true);

create policy "vl_write_by_role"
  on public.video_landings for all
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor')
    )
  );

-- Landings y activity_log: lectura para autenticados
create policy "landings_read"
  on public.landings for select using (true);

create policy "log_read_own"
  on public.activity_log for select
  using (user_id = auth.uid());
```

---

## 5. Vista para el iframe

```sql
create or replace view public.v_iframe_videos as
select
  v.id,
  v.tiktok_url,
  v.tiktok_id,
  v.description,
  v.thumbnail_url,
  v.video_url,
  v.views,
  v.likes,
  v.comments,
  v.shares,
  vl.link_producto,
  vl.position,
  l.slug        as landing_slug,
  l.name        as landing_name,
  l.website_id,
  w.lang
from public.video_landings vl
join public.videos   v on v.id  = vl.video_id
join public.landings l on l.id  = vl.landing_id
join public.websites w on w.id  = l.website_id
where
  v.status   = 'active'
  and vl.active = true
  and l.active  = true
  and w.active  = true
order by
  vl.position asc,
  v.created_at desc;
```

---

## 6. Función upsert de video

```sql
create or replace function public.insert_video_with_landing(
  p_tiktok_url    text,
  p_description   text,
  p_thumbnail_url text,
  p_video_url     text,
  p_views         int,
  p_likes         int,
  p_comments      int,
  p_shares        int,
  p_landing_id    uuid,
  p_link_producto text default null
) returns uuid language plpgsql as $$
declare
  v_video_id uuid;
begin
  insert into public.videos
    (tiktok_url, description, thumbnail_url, video_url,
     views, likes, comments, shares, stats_updated_at)
  values
    (p_tiktok_url, p_description, p_thumbnail_url, p_video_url,
     p_views, p_likes, p_comments, p_shares, now())
  on conflict (tiktok_url) do update set
    views            = excluded.views,
    likes            = excluded.likes,
    comments         = excluded.comments,
    shares           = excluded.shares,
    stats_updated_at = now()
  returning id into v_video_id;

  insert into public.video_landings (video_id, landing_id, link_producto)
  values (v_video_id, p_landing_id, p_link_producto)
  on conflict (video_id, landing_id) do nothing;

  return v_video_id;
end;
$$;
```

---

## 7. Verificación final

```sql
-- Ver tablas creadas
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

-- Ver seeds cargados
select id, name, lang from public.websites;
select website_id, slug, name from public.landings order by website_id;

-- Probar la vista (0 filas esperadas — aún no hay videos)
select * from public.v_iframe_videos limit 5;
```

---

## 8. Verificar conectividad desde el servidor

```bash
# Desde tu máquina local, via SSH al servidor:
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech \
  "docker exec koc-db-1 psql -U postgres -d postgres -c 'SELECT count(*) FROM public.websites;'"

# Resultado esperado: 4 (los 4 países seeds)
```

---

## Checklist de este módulo

- [ ] Acceso al Studio KOC verificado (`koc.hikvisionlatam.tech/project/default`)
- [ ] Archivo `.env` creado con credenciales KOC
- [ ] Las 6 tablas creadas sin errores en SQL Editor
- [ ] Seeds de websites (4) y landings (8) insertados
- [ ] RLS activado en todas las tablas
- [ ] Vista `v_iframe_videos` creada
- [ ] Función `insert_video_with_landing` creada
- [ ] Verificación final sin errores
- [ ] Conectividad desde servidor confirmada via docker exec

**Siguiente → `03-server-assets.md`** (configurar el servidor de assets antes del backend)
