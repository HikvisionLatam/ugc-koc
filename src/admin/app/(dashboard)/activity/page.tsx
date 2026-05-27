import { supabaseAdmin } from '@/lib/supabase'
import type { ActivityLog } from '@/lib/supabase'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

const ACTION_LABELS: Record<string, { label: string; type: 'publish' | 'edit' | 'delete' | 'user' | 'default' }> = {
  'video.published': { label: 'Video publicado', type: 'publish' },
  'video.created':   { label: 'Video creado', type: 'publish' },
  'video.edited':    { label: 'Video editado', type: 'edit' },
  'video.updated':   { label: 'Video actualizado', type: 'edit' },
  'video.deleted':   { label: 'Video eliminado', type: 'delete' },
  'user.created':    { label: 'Usuario creado', type: 'user' },
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 2) return 'ayer'
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} días`

  return new Date(dateStr).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

async function getActivity(): Promise<ActivityLog[]> {
  const { data } = await supabaseAdmin()
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export default async function ActivityPage() {
  const logs = await getActivity()

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Actividad</h1>
          <p className={styles.subtitle}>Registro de acciones en el portal</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className={styles.empty}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <p>No hay actividad registrada aún.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {logs.map((log) => {
            const info = ACTION_LABELS[log.action] ?? { label: log.action, type: 'default' }
            return (
              <div key={log.id} className={styles.logRow}>
                <div className={`${styles.logIcon} ${styles[`icon_${info.type}`]}`}>
                  {info.type === 'publish' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  )}
                  {info.type === 'edit' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  )}
                  {info.type === 'delete' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  )}
                  {info.type === 'user' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  )}
                  {info.type === 'default' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                    </svg>
                  )}
                </div>

                <div className={styles.logContent}>
                  <div className={styles.logTop}>
                    <span className={styles.logLabel}>{info.label}</span>
                    {log.metadata && typeof log.metadata === 'object' && 'tiktok_url' in log.metadata && (
                      <span className={styles.logDetail}>
                        {String(log.metadata.tiktok_url).split('/video/')[0].replace('https://www.tiktok.com/@', '@')}
                      </span>
                    )}
                  </div>
                  <div className={styles.logBottom}>
                    {log.user_id && (
                      <span className={styles.logUser}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        {log.user_id.slice(0, 8)}
                      </span>
                    )}
                    <time className={styles.logTime} dateTime={log.created_at}>
                      {relativeTime(log.created_at)}
                    </time>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
