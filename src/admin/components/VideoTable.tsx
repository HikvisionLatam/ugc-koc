/**
 * components/VideoTable.tsx
 * Tabla de videos con acciones — pausar, activar, eliminar, editar link
 */
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
  const [videos, setVideos]     = useState<VideoWithLandings[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<FilterStatus>('all')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const PER_PAGE = 20

  const fetchVideos = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/ugc/videos'
      if (filter !== 'all') url += `?status=${filter}`

      const res  = await fetch(url)
      const data = await res.json()
      setVideos(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Error al cargar videos')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchVideos() }, [fetchVideos])

  // Filter by search
  const filtered = videos.filter(v =>
    v.tiktok_url.toLowerCase().includes(search.toLowerCase()) ||
    v.description?.toLowerCase().includes(search.toLowerCase())
  )

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  // Acciones
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
      toast.error('Error al actualizar video')
    }
  }

  async function handleDelete(videoId: string) {
    if (!confirm('¿Pausar este video? Lo eliminarás del iframe.')) return
    const res = await fetch(`/api/ugc/videos/${videoId}`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })

    if (res.ok) {
      toast.success('Video pausado')
      fetchVideos()
    } else {
      toast.error('Error al pausar video')
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon}>
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
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="20" height="20" rx="4" />
            <path d="M10 8l6 4-6 4V8z" />
          </svg>
          <h3>No hay videos {filter !== 'all' ? filter : ''}</h3>
          <p>
            {filter !== 'all'
              ? 'Cambia el filtro para ver más resultados.'
              : 'Agrega tu primer video TikTok con el formulario de arriba.'}
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
                    {/* Thumbnail + info */}
                    <td>
                      <div className={styles.videoCell}>
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.description ?? 'Thumbnail'}
                            className={styles.thumb}
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.thumbPlaceholder}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10 8l6 4-6 4V8z" />
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
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                            </svg>
                          </a>
                          <p className={styles.description}>
                            {video.description ?? <span className={styles.noDesc}>Sin descripción</span>}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Stats */}
                    <td>
                      <div className={styles.stats}>
                        <Stat icon="👁" value={video.views}    label="views" />
                        <Stat icon="❤" value={video.likes}     label="likes" />
                        <Stat icon="💬" value={video.comments}  label="comments" />
                      </div>
                    </td>

                    {/* Landings */}
                    <td>
                      <div className={styles.landings}>
                        {video.video_landings?.map(vl => (
                          <span key={vl.id} className={styles.landingBadge}>
                            {vl.landings?.websites?.flag ?? '🌎'} {vl.landings?.name ?? vl.landing_id}
                          </span>
                        )) ?? <span className={styles.noDesc}>Sin landing</span>}
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge badge-${video.status}`}>
                        <span className={`status-dot ${video.status === 'active' ? 'online' : video.status === 'paused' ? 'warning' : ''}`} />
                        {video.status === 'active' ? 'Activo' : video.status === 'paused' ? 'Pausado' : 'Eliminado'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className={styles.actions}>
                        {video.status === 'active' ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatus(video.id, 'paused')}
                            title="Pausar video"
                          >
                            ⏸ Pausar
                          </button>
                        ) : video.status === 'paused' ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatus(video.id, 'active')}
                            title="Activar video"
                          >
                            ▶ Activar
                          </button>
                        ) : null}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDelete(video.id)}
                          title="Pausar video"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Anterior
              </button>
              <span className={styles.pageInfo}>
                {page} de {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div className={styles.stat} title={`${value} ${label}`}>
      <span>{icon}</span>
      <span>{value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}</span>
    </div>
  )
}