/**
 * app/api/ugc/process-video/route.ts
 *
 * POST — scraper TikTok → guarda assets → registra en Supabase
 *
 * Pipeline completo:
 * 1. Validar URL de TikTok
 * 2. Verificar duplicado
 * 3. Scrape del video (Playwright via latam.py)
 * 4. Guardar thumbnail y video en disco (asset pipeline)
 * 5. Upsert en Supabase (función RPC)
 * 6. Log de actividad
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { saveThumbnail, saveVideo } from '@/lib/assetPipeline'
import { scrapeVideo } from '@/lib/scraper'
import type { Video } from '@/lib/supabase'

export const runtime  = 'nodejs'
export const dynamic  = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tiktok_url, landing_id, link_producto } = body

  // 1. Validar URL
  if (!tiktok_url || !tiktok_url.includes('/video/')) {
    return NextResponse.json({ error: 'URL de TikTok inválida' }, { status: 400 })
  }
  if (!landing_id) {
    return NextResponse.json({ error: 'Falta landing_id' }, { status: 400 })
  }

  // 2. Verificar duplicado
  const { data: existing } = await supabaseAdmin()
    .from('videos')
    .select('id, tiktok_url')
    .eq('tiktok_url', tiktok_url)
    .single()

  if (existing) {
    return NextResponse.json({
      error:   'Este video ya existe en el sistema',
      video_id: existing.id,
    }, { status: 409 })
  }

  // 3. Scraper — intenta Playwright, cae a oEmbed si falla
  const videoData = await scrapeVideo(tiktok_url)
  if (!videoData) {
    return NextResponse.json(
      { error: 'No se pudo extraer información del video de TikTok' },
      { status: 502 }
    )
  }

  const videoId = videoData.id

  // 4. Pipeline de assets — guardado directo al filesystem del servidor
  const thumbnailUrl = await saveThumbnail(videoId, videoData.rawThumbUrl)
  const videoUrl     = await saveVideo(videoId, videoData.rawDownloadUrl, videoData.cookies)

  // 5. Upsert en Supabase usando la función RPC
  const { data: rpcResult, error: rpcError } = await supabaseAdmin().rpc(
    'insert_video_with_landing',
    {
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
    }
  )

  if (rpcError) {
    console.error('[PROCESS-VIDEO] RPC error:', rpcError)
    return NextResponse.json(
      { error: `Error al guardar en base de datos: ${rpcError.message}` },
      { status: 500 }
    )
  }

  const insertedVideoId = rpcResult as string

  // 6. Log de actividad
  await supabaseAdmin().from('activity_log').insert({
    action:      'video.published',
    entity_type: 'video',
    entity_id:   insertedVideoId,
    metadata:    {
      tiktok_url,
      landing_id,
      link_producto,
      thumbnailUrl,
      videoUrl,
    },
  })

  const status = videoUrl ? 'success' : 'partial'
  return NextResponse.json({
    video_id:      insertedVideoId,
    thumbnail_url: thumbnailUrl,
    video_url:     videoUrl,
    description:   videoData.description,
    status,
    tiktok_id:     videoId,
  }, { status: 201 })
}