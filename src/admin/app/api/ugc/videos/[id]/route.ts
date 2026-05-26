/**
 * app/api/ugc/videos/[id]/route.ts
 * GET  — detalle de un video
 * PATCH — editar video (status, link_producto, posición)
 * DELETE — soft delete (status = 'deleted')
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteAssets } from '@/lib/assetPipeline'
import type { Video, VideoLanding } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin()
    .from('videos')
    .select(`
      *,
      video_landings(
        id, landing_id, link_producto, active, position,
        landings(
          id, slug, name, website_id,
          websites(id, name, flag)
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Video no encontrado' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const {
    status,
    link_producto,
    landing_id,
    active,
    position,
  } = body

  // Actualizar video
  if (status) {
    const { error } = await supabaseAdmin()
      .from('videos')
      .update({ status })
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Actualizar vínculo con landing
  if (landing_id) {
    const updates: Record<string, unknown> = {}
    if (link_producto !== undefined) updates.link_producto = link_producto
    if (active       !== undefined) updates.active        = active
    if (position     !== undefined) updates.position      = position

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin()
        .from('video_landings')
        .update(updates)
        .eq('video_id',   params.id)
        .eq('landing_id', landing_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Log
  await supabaseAdmin().from('activity_log').insert({
    action:      `video.edited`,
    entity_type: 'video',
    entity_id:   params.id,
    metadata:    { status, link_producto, landing_id, active, position },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Soft delete — no borramos el registro
  const { error } = await supabaseAdmin()
    .from('videos')
    .update({ status: 'deleted' })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Eliminar archivos físicos
  deleteAssets(params.id)

  // Log
  await supabaseAdmin().from('activity_log').insert({
    action:      'video.deleted',
    entity_type: 'video',
    entity_id:   params.id,
  })

  return NextResponse.json({ ok: true })
}