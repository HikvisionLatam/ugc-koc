/**
 * app/api/ugc/landings/route.ts
 *
 * GET  — lista landings (filtrables por website_id)
 * POST — crear nueva landing
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const websiteId = searchParams.get('website_id') ?? undefined

  let query = supabaseAdmin()
    .from('landings')
    .select(`
      *,
      websites!inner(id, name, flag, lang)
    `)
    .eq('active', true)
    .order('name')

  if (websiteId) query = query.eq('website_id', websiteId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { website_id, slug, name, path, landing_type = 'product' } = body

  if (!website_id || !slug || !name) {
    return NextResponse.json(
      { error: 'Campos requeridos: website_id, slug, name' },
      { status: 400 }
    )
  }

  if (!['product', 'homepage'].includes(landing_type)) {
    return NextResponse.json(
      { error: 'landing_type debe ser "product" o "homepage"' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin()
    .from('landings')
    .insert({ website_id, slug, name, path: path ?? null, landing_type })
    .select()
    .single()

  if (error) {
    // Unique constraint (website_id, slug)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Ya existe una landing con slug "${slug}" en este website` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabaseAdmin().from('activity_log').insert({
    action:      'landing.created',
    entity_type: 'landing',
    entity_id:   data.id,
    metadata:    { website_id, slug, name, landing_type },
  })

  return NextResponse.json(data, { status: 201 })
}
