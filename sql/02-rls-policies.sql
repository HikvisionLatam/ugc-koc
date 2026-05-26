-- ============================================================
-- BLOQUE 2: RLS (Row Level Security)
-- Ejecutar después del Bloque 1
-- ============================================================

-- Activar RLS en todas las tablas
alter table public.videos          enable row level security;
alter table public.video_landings  enable row level security;
alter table public.landings        enable row level security;
alter table public.websites        enable row level security;
alter table public.user_profiles   enable row level security;
alter table public.activity_log    enable row level security;

-- Policies para websites
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

-- Policies para videos
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

-- Policies para video_landings
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

-- Policies para landings
create policy "landings_read"
  on public.landings for select using (true);

-- Policies para activity_log
create policy "log_read_own"
  on public.activity_log for select
  using (user_id = auth.uid());