/**
 * app/api/ugc/websites/route.ts
 * GET — lista de websites con sus landings
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { Website, Landing } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data: websites, error: wErr } = await supabaseAdmin()
    .from('websites')
    .select('*')
    .eq('active', true)
    .order('id')

  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })

  const { data: landings, error: lErr } = await supabaseAdmin()
    .from('landings')
    .select('*')
    .eq('active', true)
    .order('website_id')

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

  // Agrupar landings por website
  const landingsByWebsite = (landings ?? []).reduce(
    (acc, l) => {
      if (!acc[l.website_id]) acc[l.website_id] = []
      acc[l.website_id].push(l)
      return acc
    },
    {} as Record<string, Landing[]>
  )

  const result = (websites ?? []).map((w) => ({
    ...w,
    landings: landingsByWebsite[w.id] ?? [],
  }))

  return NextResponse.json(result)
}