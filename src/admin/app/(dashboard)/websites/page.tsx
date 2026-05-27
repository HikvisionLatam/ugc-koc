import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import type { Website, Landing } from '@/lib/supabase'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

interface WebsiteWithStats extends Website {
  landings: Landing[]
  videoCount: number
}

async function getWebsitesWithStats(): Promise<WebsiteWithStats[]> {
  const { data: websites } = await supabaseAdmin()
    .from('websites')
    .select('*')
    .eq('active', true)
    .order('id')

  if (!websites?.length) return []

  const { data: landings } = await supabaseAdmin()
    .from('landings')
    .select('*')
    .eq('active', true)

  const { data: vlCounts } = await supabaseAdmin()
    .from('video_landings')
    .select('landing_id, videos!inner(status)')
    .eq('active', true)
    .eq('videos.status', 'active')

  const landingsByWebsite: Record<string, Landing[]> = {}
  for (const l of landings ?? []) {
    if (!landingsByWebsite[l.website_id]) landingsByWebsite[l.website_id] = []
    landingsByWebsite[l.website_id].push(l)
  }

  const landingIds = new Set((landings ?? []).map((l) => l.id))
  const vcMap: Record<string, number> = {}
  for (const vl of vlCounts ?? []) {
    if (landingIds.has(vl.landing_id)) {
      vcMap[vl.landing_id] = (vcMap[vl.landing_id] ?? 0) + 1
    }
  }

  return websites.map((w) => {
    const wLandings = landingsByWebsite[w.id] ?? []
    const videoCount = wLandings.reduce((sum, l) => sum + (vcMap[l.id] ?? 0), 0)
    return { ...w, landings: wLandings, videoCount }
  })
}

export default async function WebsitesPage() {
  const websites = await getWebsitesWithStats()

  const totalVideos = websites.reduce((s, w) => s + w.videoCount, 0)
  const totalLandings = websites.reduce((s, w) => s + w.landings.length, 0)

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Websites</h1>
          <p className={styles.subtitle}>Gestión de contenido UGC por región</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{websites.length}</span>
          <span className={styles.statLabel}>Websites</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalLandings}</span>
          <span className={styles.statLabel}>Landings</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalVideos}</span>
          <span className={styles.statLabel}>Videos activos</span>
        </div>
      </div>

      {websites.length === 0 ? (
        <div className={styles.empty}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <p>No hay websites configuradas aún.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {websites.map((w) => (
            <Link key={w.id} href={`/websites/${w.id}`} className={styles.websiteRow}>
              <span className={styles.flag} aria-hidden="true">{w.flag}</span>

              <div className={styles.websiteInfo}>
                <span className={styles.websiteName}>{w.name}</span>
                <span className={styles.websiteUrl}>{w.url}</span>
              </div>

              <div className={styles.websiteMeta}>
                <span className={styles.landingCount}>
                  {w.landings.length} landing{w.landings.length !== 1 ? 's' : ''}
                </span>
                <span className={w.videoCount > 0 ? styles.badgeActive : styles.badgeEmpty}>
                  {w.videoCount > 0 ? `${w.videoCount} activos` : 'Sin videos'}
                </span>
              </div>

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
