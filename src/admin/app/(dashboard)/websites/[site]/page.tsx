import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import type { Landing } from '@/lib/supabase'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

interface LandingWithCount extends Landing {
  videoCount: number
}

async function getSiteData(siteId: string) {
  const { data: website } = await supabaseAdmin()
    .from('websites')
    .select('*')
    .eq('id', siteId)
    .eq('active', true)
    .single()

  if (!website) return null

  const { data: landings } = await supabaseAdmin()
    .from('landings')
    .select('*')
    .eq('website_id', website.id)
    .eq('active', true)
    .order('name')

  const landingIds = (landings ?? []).map((l) => l.id)

  let vcMap: Record<string, number> = {}
  if (landingIds.length > 0) {
    const { data: vlCounts } = await supabaseAdmin()
      .from('video_landings')
      .select('landing_id, videos!inner(status)')
      .in('landing_id', landingIds)
      .eq('active', true)
      .eq('videos.status', 'active')

    for (const vl of vlCounts ?? []) {
      vcMap[vl.landing_id] = (vcMap[vl.landing_id] ?? 0) + 1
    }
  }

  const landingsWithCount: LandingWithCount[] = (landings ?? []).map((l) => ({
    ...l,
    videoCount: vcMap[l.id] ?? 0,
  }))

  return { website, landings: landingsWithCount }
}

export default async function SitePage({
  params,
}: {
  params: { site: string }
}) {
  const data = await getSiteData(params.site)
  if (!data) notFound()

  const { website, landings } = data

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/websites" className={styles.breadcrumbLink}>Websites</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span className={styles.breadcrumbCurrent}>
          {website.flag} {website.name}
        </span>
      </div>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{website.name}</h1>
          <p className={styles.subtitle}>{website.url}</p>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Landings de producto</span>
        <span className={styles.sectionCount}>{landings.length}</span>
      </div>

      {landings.length === 0 ? (
        <div className={styles.empty}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
          <p>No hay landings configuradas para este sitio.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {landings.map((landing) => (
            <Link
              key={landing.id}
              href={`/websites/${params.site}/${landing.slug}`}
              className={styles.landingRow}
            >
              <span
                className={`${styles.statusDot} ${landing.videoCount > 0 ? styles.dotActive : styles.dotEmpty}`}
                aria-hidden="true"
              />

              <div className={styles.landingInfo}>
                <span className={styles.landingName}>{landing.name}</span>
                {landing.path && (
                  <span className={styles.landingPath}>{landing.path}</span>
                )}
              </div>

              <span className={styles.videoCount}>
                {landing.videoCount > 0
                  ? `${landing.videoCount} video${landing.videoCount !== 1 ? 's' : ''}`
                  : 'Sin videos'}
              </span>

              <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
