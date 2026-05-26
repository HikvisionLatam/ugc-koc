-- ============================================================
-- BLOQUE 3: Vista para iframe + Función upsert
-- Ejecutar después del Bloque 2
-- ============================================================

-- Vista para el iframe (datos públicos de videos activos)
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

-- Función upsert para insertar video + landing en una sola operación
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