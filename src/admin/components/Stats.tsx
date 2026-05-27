import { supabaseAdmin } from '@/lib/supabase'
import styles from './Stats.module.css'

export async function Stats() {
  const [
    { count: totalVideos },
    { count: activeVideos },
    { count: pausedVideos },
    { count: totalLandings },
  ] = await Promise.all([
    supabaseAdmin().from('videos').select('*', { count: 'exact', head: true }),
    supabaseAdmin().from('videos').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin().from('videos').select('*', { count: 'exact', head: true }).eq('status', 'paused'),
    supabaseAdmin().from('landings').select('*', { count: 'exact', head: true }).eq('active', true),
  ])

  const items = [
    {
      label:  'Total videos',
      value:  totalVideos ?? 0,
      sub:    'en el sistema',
      accent: false,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      label:  'Activos',
      value:  activeVideos ?? 0,
      sub:    'visibles en iframe',
      accent: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      label:  'Pausados',
      value:  pausedVideos ?? 0,
      sub:    'temporalmente ocultos',
      accent: false,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="10" y1="9" x2="10" y2="15" />
          <line x1="14" y1="9" x2="14" y2="15" />
        </svg>
      ),
    },
    {
      label:  'Landings',
      value:  totalLandings ?? 0,
      sub:    'páginas configuradas',
      accent: false,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      ),
    },
  ]

  return (
    <div className={styles.grid}>
      {items.map(({ label, value, sub, icon, accent }) => (
        <div key={label} className={`${styles.card} ${accent ? styles.cardAccent : ''}`}>
          <div className={styles.cardHeader}>
            <span className={styles.icon}>{icon}</span>
            <span className={styles.label}>{label}</span>
          </div>
          <div className={styles.value}>{value.toLocaleString()}</div>
          <div className={styles.sub}>{sub}</div>
        </div>
      ))}
    </div>
  )
}
