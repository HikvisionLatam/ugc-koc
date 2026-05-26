-- ============================================================
-- BLOQUE 4: Verificación final
-- Ejecutar después del Bloque 3
-- ============================================================

-- Ver tablas creadas
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

-- Ver seeds de websites
select id, name, lang from public.websites order by id;

-- Ver seeds de landings
select website_id, slug, name from public.landings order by website_id;

-- Probar la vista del iframe (debe retornar 0 filas - aún no hay videos)
select * from public.v_iframe_videos limit 5;