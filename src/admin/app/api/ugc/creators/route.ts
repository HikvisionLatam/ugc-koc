/**
 * app/api/ugc/creators/route.ts
 *
 * GET  — lista todos los creadores
 * POST — registrar un nuevo creador manualmente
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const { data, error } = await supabaseAdmin()
    .from('ugc_creators')
    .select('*')
    .order('tiktok_username')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tiktok_username, country_code, country_name, display_name } = body

  if (!tiktok_username || !country_code || !country_name) {
    return NextResponse.json(
      { error: 'Campos requeridos: tiktok_username, country_code, country_name' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin()
    .from('ugc_creators')
    .insert({
      tiktok_username: tiktok_username.replace(/^@/, ''), // limpiar @ si viene
      display_name:    display_name ?? tiktok_username,
      country_code,
      country_name,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `El creador @${tiktok_username} ya está registrado` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
