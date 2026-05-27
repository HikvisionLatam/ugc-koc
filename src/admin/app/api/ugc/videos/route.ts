/**
 * app/api/ugc/videos/route.ts
 * GET  — lista de videos con filtros
 * POST — crear video manualmente (sin scraper)
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { saveThumbnail, saveVideo } from '@/lib/assetPipeline'
import type { Video, VideoLanding } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic  = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')   ?? undefined
  const websiteId = searchParams.get('website_id') ?? undefined

  let query = supabaseAdmin()
    .from('videos')
    .select(`
      *,
      video_landings(
        id, landing_id, link_producto, active, position
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (status)    query = query.eq('status', status)
  if (websiteId) query = query.eq('created_by', websiteId) // TODO: join real

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tiktok_url, landing_id, link_producto, status = 'active' } = body

  if (!tiktok_url || !landing_id) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  if (!tiktok_url.includes('/video/')) {
    return NextResponse.json({ error: 'URL de TikTok inválida' }, { status: 400 })
  }

  // Upsert video
  const { data: existing } = await supabaseAdmin()
    .from('videos')
    .select('id')
    .eq('tiktok_url', tiktok_url)
    .single()

  let videoId: string

  if (existing) {
    // Ya existe — actualizar solo status
    await supabaseAdmin()
      .from('videos')
      .update({ status })
      .eq('id', existing.id)
    videoId = existing.id
  } else {
    // Crear nuevo
    const { data, error } = await supabaseAdmin()
      .from('videos')
      .insert({
        tiktok_url,
        // tiktok_id is GENERATED ALWAYS AS — do not insert
        description:   body.description   ?? null,
        thumbnail_url: body.thumbnail_url ?? null,
        video_url:     body.video_url     ?? null,
        status,
      })
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Error creando video' }, { status: 500 })
    }
    videoId = data.id
  }

  // Vincular a landing
  const { error: vlError } = await supabaseAdmin()
    .from('video_landings')
    .upsert({
      video_id:      videoId,
      landing_id,
      link_producto: link_producto ?? null,
      active:        true,
    }, {
      onConflict: 'video_id,landing_id',
    })

  if (vlError) {
    return NextResponse.json({ error: vlError.message }, { status: 500 })
  }

  // Log de actividad
  await supabaseAdmin().from('activity_log').insert({
    action:      existing ? 'video.updated' : 'video.created',
    entity_type: 'video',
    entity_id:   videoId,
    metadata:    { tiktok_url, landing_id, link_producto, status },
  })

  return NextResponse.json({ id: videoId, status: 'ok' }, { status: 201 })
}