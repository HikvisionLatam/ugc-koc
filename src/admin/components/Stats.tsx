/**
 * components/Stats.tsx
 * Tarjetas de estadísticas — total videos, activos, pausados, landings
 */
import { supabaseAdmin } from '@/lib/supabase'
import styles from './Stats.module.css'

export async function Stats() {
  // Queries paralelas para las estadísticas
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
      label:   'Total videos',
      value:   totalVideos ?? 0,
      sub:     'en el sistema',
      icon:    '🎬',
      accent:  false,
    },
    {
      label:   'Activos',
      value:   activeVideos ?? 0,
      sub:     'visibles en iframe',
      icon:    '✅',
      accent:  true,
    },
    {
      label:   'Pausados',
      value:   pausedVideos ?? 0,
      sub:     'temporalmente ocultos',
      icon:    '⏸',
      accent:  false,
    },
    {
      label:   'Landings',
      value:   totalLandings ?? 0,
      sub:     'páginas configuradas',
      icon:    '🌐',
      accent:  false,
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