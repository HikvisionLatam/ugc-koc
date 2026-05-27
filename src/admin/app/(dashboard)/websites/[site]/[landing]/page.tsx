import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { VideoGrid } from '@/components/VideoGrid'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

async function getLandingData(siteId: string, landingSlug: string) {
  const { data: website } = await supabaseAdmin()
    .from('websites')
    .select('id, name, lang, flag')
    .eq('id', siteId)
    .eq('active', true)
    .single()

  if (!website) return null

  const { data: landing } = await supabaseAdmin()
    .from('landings')
    .select('*')
    .eq('website_id', website.id)
    .eq('slug', landingSlug)
    .eq('active', true)
    .single()

  if (!landing) return null

  const { data: videoLandings } = await supabaseAdmin()
    .from('video_landings')
    .select('id, landing_id, link_producto, active, position, videos(*)')
    .eq('landing_id', landing.id)
    .order('position', { ascending: true })

  const videos = (videoLandings ?? [])
    .filter((vl) => (vl.videos as any)?.status !== 'deleted')
    .map((vl) => {
      const v = vl.videos as any
      return {
        id: v.id,
        tiktok_url: v.tiktok_url,
        description: v.description,
        thumbnail_url: v.thumbnail_url,
        views: v.views ?? 0,
        likes: v.likes ?? 0,
        comments: v.comments ?? 0,
        shares: v.shares ?? 0,
        status: v.status as 'active' | 'paused' | 'deleted',
        vl_id: vl.id,
        vl_active: vl.active,
        vl_landing_id: vl.landing_id,
        link_producto: vl.link_producto,
      }
    })

  return { website, landing, videos }
}

export default async function LandingPage({
  params,
}: {
  params: { site: string; landing: string }
}) {
  const data = await getLandingData(params.site, params.landing)
  if (!data) notFound()

  const { website, landing, videos } = data
  const activeCount = videos.filter((v) => v.status === 'active').length

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/websites" className={styles.breadcrumbLink}>Websites</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <Link href={`/websites/${params.site}`} className={styles.breadcrumbLink}>
          {website.flag} {website.name}
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span className={styles.breadcrumbCurrent}>{landing.name}</span>
      </div>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{landing.name}</h1>
          <p className={styles.subtitle}>
            {activeCount} video{activeCount !== 1 ? 's' : ''} activo{activeCount !== 1 ? 's' : ''}
            {landing.path && (
              <span className={styles.path}> · {landing.path}</span>
            )}
          </p>
        </div>
      </div>

      <VideoGrid
        videos={videos}
        landingId={landing.id}
        landingName={landing.name}
      />
    </div>
  )
}
