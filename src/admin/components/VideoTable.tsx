'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { Video, VideoLanding, Landing, Website } from '@/lib/supabase'
import styles from './VideoTable.module.css'

type VideoWithLandings = Video & {
  video_landings: (VideoLanding & { landings?: Landing & { websites?: Website } })[]
}

type FilterStatus = 'all' | 'active' | 'paused' | 'deleted'

export function VideoTable() {
  const [videos, setVideos]   = useState<VideoWithLandings[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<FilterStatus>('all')
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const PER_PAGE = 20

  const fetchVideos = useCallback(async () => {
    setLoading(true)
    try {
      const url = filter !== 'all' ? `/api/ugc/videos?status=${filter}` : '/api/ugc/videos'
      const res = await fetch(url)
      const data = await res.json()
      setVideos(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Error al cargar videos')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchVideos() }, [fetchVideos])

  const filtered = videos.filter(v =>
    v.tiktok_url.toLowerCase().includes(search.toLowerCase()) ||
    v.description?.toLowerCase().includes(search.toLowerCase())
  )

  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  async function handleStatus(videoId: string, newStatus: 'active' | 'paused') {
    const res = await fetch(`/api/ugc/videos/${videoId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      toast.success(`Video ${newStatus === 'active' ? 'activado' : 'pausado'}`)
      fetchVideos()
    } else {
      toast.error('Error al actualizar')
    }
  }

  async function handleDelete(videoId: string) {
    if (!confirm('¿Eliminar este video del iframe?')) return
    const res = await fetch(`/api/ugc/videos/${videoId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Video eliminado')
      fetchVideos()
    } else {
      toast.error('Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Cargando videos…</span>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            className={styles.search}
            placeholder="Buscar por URL o descripción…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        <div className={styles.filters}>
          {(['all', 'active', 'paused', 'deleted'] as FilterStatus[]).map(s => (
            <button
              key={s}
              className={`${styles.filterBtn} ${filter === s ? styles.filterBtnActive : ''}`}
              onClick={() => { setFilter(s); setPage(1) }}
            >
              {s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && (
                <span className={styles.filterCount}>
                  {videos.filter(v => v.status === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {paginated.length === 0 && (
        <div className={styles.empty}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="20" height="20" rx="4" />
            <polygon points="10,8 16,12 10,16" />
          </svg>
          <h3>No hay videos{filter !== 'all' ? ` ${filter}s` : ''}</h3>
          <p>
            {filter !== 'all'
              ? 'Cambia el filtro para ver más resultados.'
              : 'Agrega el primer video con la pestaña Agregar.'}
          </p>
        </div>
      )}

      {/* Table */}
      {paginated.length > 0 && (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Estadísticas</th>
                  <th>Landings</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(video => (
                  <tr key={video.id}>
                    <td>
                      <div className={styles.videoCell}>
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt=""
                            className={styles.thumb}
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.thumbPlaceholder}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="5,3 19,12 5,21" />
                            </svg>
                          </div>
                        )}
                        <div className={styles.videoInfo}>
                          <a
                            href={video.tiktok_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.tiktokLink}
                          >
                            /video/{video.tiktok_id}
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                            </svg>
                          </a>
                          <p className={styles.description}>
                            {video.description ?? <span className={styles.noDesc}>Sin descripción</span>}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className={styles.stats}>
                        <Stat value={video.views} label="views" icon={
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        } />
                        <Stat value={video.likes} label="likes" icon={
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                          </svg>
                        } />
                        <Stat value={video.comments} label="comentarios" icon={
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                        } />
                      </div>
                    </td>

                    <td>
                      <div className={styles.landings}>
                        {video.video_landings?.map(vl => (
                          <span key={vl.id} className={styles.landingBadge}>
                            {vl.landings?.websites?.flag ?? ''} {vl.landings?.name ?? vl.landing_id}
                          </span>
                        )) ?? <span className={styles.noDesc}>Sin landing</span>}
                      </div>
                    </td>

                    <td>
                      <span className={`badge badge-${video.status}`}>
                        <span className={`status-dot ${video.status === 'active' ? 'online' : video.status === 'paused' ? 'warning' : 'error'}`} />
                        {video.status === 'active' ? 'Activo' : video.status === 'paused' ? 'Pausado' : 'Eliminado'}
                      </span>
                    </td>

                    <td>
                      <div className={styles.actions}>
                        {video.status === 'active' ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleStatus(video.id, 'paused')}>
                            Pausar
                          </button>
                        ) : video.status === 'paused' ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleStatus(video.id, 'active')}>
                            Activar
                          </button>
                        ) : null}
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleDelete(video.id)}
                          title="Eliminar video"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                ← Anterior
              </button>
              <span className={styles.pageInfo}>{page} / {totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  return (
    <div className={styles.stat} title={`${value} ${label}`}>
      {icon}
      <span>{fmt(value)}</span>
    </div>
  )
}
