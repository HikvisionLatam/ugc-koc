-- ============================================================
-- BLOQUE 1: Crear todas las tablas + seeds
-- Ejecutar en SQL Editor de KOC Studio
-- ============================================================

-- Tabla websites
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

-- Tabla landings
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

-- Tabla videos
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

-- Tabla video_landings
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

-- Tabla user_profiles
create table public.user_profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text,
  role             text default 'viewer'
                   check (role in ('admin', 'editor', 'viewer')),
  allowed_websites text[],
  created_at       timestamptz default now()
);

-- Tabla activity_log
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