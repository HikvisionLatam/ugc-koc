#!/usr/bin/env tsx
/**
 * scripts/seed-videos.ts
 * Seed de videos existentes en Supabase KOC.
 * Se ejecuta localmente: npx tsx scripts/seed-videos.ts
 *
 * Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

dotenv.config({ path: join(process.cwd(), '.env') })

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

// Obtener UUID de la landing por defecto (latam colorvu)
async function getLandingId(): Promise<string> {
  const { data, error } = await supabase
    .from('landings')
    .select('id')
    .eq('website_id', 'latam')
    .eq('slug', 'colorvu')
    .single()

  if (error || !data) {
    console.error('❌ No se encontró la landing latam/colorvu:', error?.message)
    process.exit(1)
  }

  return data.id
}

async function seedVideos() {
  console.log('🎬 UGC KOC — Seed de videos\n')

  // Verificar que existe el JSON con los videos
  const jsonPath = join(process.cwd(), 'hikvisionlatam_tiktok_videos_kocassets.json')
  let videos: Array<Record<string, unknown>>

  try {
    videos = JSON.parse(readFileSync(jsonPath, 'utf-8'))
  } catch {
    console.warn('⚠️  No se encontró hikvisionlatam_tiktok_videos_kocassets.json')
    console.warn('   Creando videos de prueba…')

    // Crear 3 videos de prueba si no existe el JSON
    videos = [
      {
        url: 'https://www.tiktok.com/@hikvisionlatam/video/7382756982345678000',
        description: 'Video de prueba ColorVu - Cámara con visión nocturna a color',
        views: 15000,
        likes: 342,
        comments: 28,
        shares: 15,
        thumbnail_url: null,
        video_url: null,
        LinkProducto: 'https://hikvision.com/latam/productos/colorvu',
      },
    ]
  }

  const landingId = await getLandingId()
  console.log(`✅ Landing: ${landingId}`)
  console.log(`📹 Videos a importar: ${videos.length}\n`)

  let success = 0
  let skipped = 0

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i]
    const url = v.url as string

    if (!url || !url.includes('/video/')) {
      console.log(`[${i + 1}/${videos.length}] ⚠️  Saltado: URL inválida`)
      skipped++
      continue
    }

    try {
      await supabase.rpc('insert_video_with_landing', {
        p_tiktok_url:    url,
        p_description:   (v.description as string) ?? '',
        p_thumbnail_url: (v.thumbnail_url as string) ?? null,
        p_video_url:     (v.video_url as string) ?? null,
        p_views:         (v.views as number) ?? 0,
        p_likes:         (v.likes as number) ?? 0,
        p_comments:      (v.comments as number) ?? 0,
        p_shares:        (v.shares as number) ?? 0,
        p_landing_id:    landingId,
        p_link_producto: (v.LinkProducto as string) ?? null,
      })

      console.log(`[${i + 1}/${videos.length}] ✅ ${url.split('/video/').pop()}`)
      success++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) {
        console.log(`[${i + 1}/${videos.length}] ⏭️  Ya existe: ${url.split('/video/').pop()}`)
        skipped++
      } else {
        console.log(`[${i + 1}/${videos.length}] ❌ Error: ${msg}`)
      }
    }
  }

  console.log(`\n✅ Seed completado: ${success} importados, ${skipped} saltados`)
}

seedVideos().catch(console.error)