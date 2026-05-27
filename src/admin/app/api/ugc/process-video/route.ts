/**
 * app/api/ugc/process-video/route.ts
 *
 * POST — scraper TikTok → guarda assets → registra en Supabase
 *
 * Pipeline:
 * 1. Validar URL + landing_id
 * 2. Verificar duplicado
 * 3. Scrape del video (Playwright via latam.py, fallback oEmbed)
 * 4. Verificar creador — si es nuevo y no vino country_code → 422 needs_creator
 * 5. Upsert creator si es nuevo
 * 6. Guardar thumbnail + video en disco
 * 7. INSERT en videos (sin tiktok_id — es columna GENERATED)
 * 8. INSERT en video_landings
 * 9. Log de actividad
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { saveThumbnail, saveVideo } from '@/lib/assetPipeline'
import { scrapeVideo } from '@/lib/scraper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    tiktok_url,
    landing_id,
    link_producto  = null,
    status         = 'active',
    // Datos del creador — solo presentes si ya se le preguntó al admin
    country_code   = null as string | null,
    country_name   = null as string | null,
  } = body

  // ── 1. Validación básica ────────────────────────────────────────────────────
  if (!tiktok_url || !tiktok_url.includes('/video/')) {
    return NextResponse.json({ error: 'URL de TikTok inválida' }, { status: 400 })
  }
  if (!landing_id) {
    return NextResponse.json({ error: 'Falta landing_id' }, { status: 400 })
  }

  // ── 2. Verificar duplicado ──────────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin()
    .from('videos')
    .select('id')
    .eq('tiktok_url', tiktok_url)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'Este video ya existe en el sistema', video_id: existing.id },
      { status: 409 }
    )
  }

  // ── 3. Scraper ──────────────────────────────────────────────────────────────
  const videoData = await scrapeVideo(tiktok_url)
  if (!videoData) {
    return NextResponse.json(
      { error: 'No se pudo extraer información del video de TikTok' },
      { status: 502 }
    )
  }

  // ── 4. Verificar creador ────────────────────────────────────────────────────
  const author = videoData.author ?? null
  let creatorId: string | null = null

  if (author) {
    const { data: existingCreator } = await supabaseAdmin()
      .from('ugc_creators')
      .select('id')
      .eq('tiktok_username', author)
      .single()

    if (existingCreator) {
      creatorId = existingCreator.id
    } else if (!country_code || !country_name) {
      // Creador nuevo y no tenemos el país — el frontend debe preguntar
      return NextResponse.json(
        {
          needs_creator: true,
          author,
          message: 'Creador desconocido — indica su país para continuar',
        },
        { status: 422 }
      )
    } else {
      // ── 5. Upsert creador nuevo ─────────────────────────────────────────────
      const { data: newCreator, error: creatorError } = await supabaseAdmin()
        .from('ugc_creators')
        .insert({
          tiktok_username: author,
          display_name:    author,
          country_code,
          country_name,
        })
        .select('id')
        .single()

      if (creatorError || !newCreator) {
        console.error('[PROCESS-VIDEO] Error creando creador:', creatorError)
        return NextResponse.json(
          { error: `Error al registrar creador: ${creatorError?.message}` },
          { status: 500 }
        )
      }
      creatorId = newCreator.id
    }
  }

  const tiktokId = videoData.id

  // ── 6. Pipeline de assets ───────────────────────────────────────────────────
  const thumbnailUrl = await saveThumbnail(tiktokId, videoData.rawThumbUrl)
  const videoUrl     = await saveVideo(tiktokId, videoData.rawDownloadUrl, videoData.cookies)

  // ── 7. INSERT video (tiktok_id es GENERATED — NO se inserta) ───────────────
  const { data: insertedVideo, error: videoError } = await supabaseAdmin()
    .from('videos')
    .insert({
      tiktok_url,
      creator_id:    creatorId,
      description:   videoData.description ?? null,
      thumbnail_url: thumbnailUrl,
      video_url:     videoUrl,
      views:         videoData.views    ?? 0,
      likes:         videoData.likes    ?? 0,
      comments:      videoData.comments ?? 0,
      shares:        videoData.shares   ?? 0,
      stats_updated_at: new Date().toISOString(),
      status,
    })
    .select('id')
    .single()

  if (videoError || !insertedVideo) {
    console.error('[PROCESS-VIDEO] Error insertando video:', videoError)
    return NextResponse.json(
      { error: `Error al guardar video: ${videoError?.message}` },
      { status: 500 }
    )
  }

  const insertedVideoId = insertedVideo.id

  // ── 8. INSERT video_landing ─────────────────────────────────────────────────
  const { error: vlError } = await supabaseAdmin()
    .from('video_landings')
    .insert({
      video_id:      insertedVideoId,
      landing_id,
      link_producto: link_producto ?? null,
      active:        status === 'active',
      position:      0,
    })

  if (vlError) {
    console.error('[PROCESS-VIDEO] Error insertando video_landing:', vlError)
    // Video ya insertado — no rollback, pero avisar
    return NextResponse.json(
      { error: `Video guardado pero falló el vínculo a landing: ${vlError.message}`, video_id: insertedVideoId },
      { status: 500 }
    )
  }

  // ── 9. Activity log ─────────────────────────────────────────────────────────
  await supabaseAdmin().from('activity_log').insert({
    action:      status === 'active' ? 'video.published' : 'video.draft',
    entity_type: 'video',
    entity_id:   insertedVideoId,
    metadata:    { tiktok_url, landing_id, link_producto, thumbnailUrl, videoUrl, author },
  })

  return NextResponse.json(
    {
      video_id:      insertedVideoId,
      thumbnail_url: thumbnailUrl,
      video_url:     videoUrl,
      description:   videoData.description,
      status:        videoUrl ? 'success' : 'partial',
      tiktok_id:     tiktokId,
      creator_id:    creatorId,
    },
    { status: 201 }
  )
}
