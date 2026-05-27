/**
 * app/api/ugc/creators/check/route.ts
 *
 * GET ?username=hikvisioncolombia
 * Verifica si un creador existe en ugc_creators.
 * Usado por AddVideoModal antes de pedir el país.
 *
 * Respuesta:
 *   { exists: true,  creator: { id, tiktok_username, country_code, country_name, display_name } }
 *   { exists: false }
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')?.replace(/^@/, '') ?? ''

  if (!username) {
    return NextResponse.json({ error: 'Falta el parámetro username' }, { status: 400 })
  }

  const { data: creator } = await supabaseAdmin()
    .from('ugc_creators')
    .select('id, tiktok_username, display_name, country_code, country_name')
    .eq('tiktok_username', username)
    .single()

  if (!creator) {
    return NextResponse.json({ exists: false })
  }

  return NextResponse.json({ exists: true, creator })
}
