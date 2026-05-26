/**
 * app/api/ugc/iframe/route.ts
 * Endpoint público para el componente iframe embebido en AEM.
 * No requiere autenticación — RLS de Supabase filtra videos activos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { IframeVideo } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic  = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const site    = searchParams.get('site')
  const landing = searchParams.get('landing')

  if (!site || !landing) {
    return NextResponse.json(
      { error: 'Faltan parámetros: site y landing' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin()
    .from('v_iframe_videos')
    .select('*')
    .eq('website_id',   site)
    .eq('landing_slug', landing)
    .order('position',  { ascending: true })
    .limit(12)

  if (error) {
    console.error('[IFRAME API] DB error:', error)
    return NextResponse.json(
      { error: 'Error de base de datos' },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [], {
    headers: {
      'Cache-Control':               'public, s-maxage=300, stale-while-revalidate=600',
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, apikey',
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}