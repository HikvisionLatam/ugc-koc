'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import styles from './EditVideoModal.module.css'

interface VideoWithLanding {
  id: string
  tiktok_url: string
  description: string | null
  thumbnail_url: string | null
  views: number
  likes: number
  comments: number
  shares: number
  status: 'active' | 'paused' | 'deleted'
  vl_id: string
  vl_active: boolean
  vl_landing_id: string
  link_producto: string | null
}

interface Props {
  video: VideoWithLanding
  landingName: string
  onClose: () => void
  onSuccess: () => void
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function EditVideoModal({ video, landingName, onClose, onSuccess }: Props) {
  const [status, setStatus] = useState<'active' | 'paused'>(
    video.status === 'paused' ? 'paused' : 'active'
  )
  const [linkProducto, setLinkProducto] = useState(video.link_producto ?? '')
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ugc/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          landing_id: video.vl_landing_id,
          link_producto: linkProducto.trim() || null,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Error al guardar cambios')
        return
      }

      toast.success('Cambios guardados')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/ugc/videos/${video.id}`, { method: 'DELETE' })

      if (!res.ok) {
        toast.error('Error al eliminar el video')
        return
      }

      toast.success('Video eliminado')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Editar video">
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Gestionar video</h2>
            <p className={styles.modalSubtitle}>Landing: {landingName}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className={styles.videoRow}>
          <div className={styles.thumbWrap}>
            {video.thumbnail_url ? (
              <img
                src={video.thumbnail_url}
                alt=""
                className={styles.thumb}
              />
            ) : (
              <div className={styles.thumbPlaceholder}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </div>
            )}
          </div>

          <div className={styles.videoMeta}>
            {video.description && (
              <p className={styles.description}>{video.description}</p>
            )}
            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{fmtNum(video.views)}</span>
                <span className={styles.statLabel}>Views</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{fmtNum(video.likes)}</span>
                <span className={styles.statLabel}>Likes</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{fmtNum(video.shares)}</span>
                <span className={styles.statLabel}>Shares</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.fields}>
          <div className={styles.toggleRow}>
            <div>
              <span className={styles.toggleLabel}>Estado del video</span>
              <span className={status === 'active' ? styles.statusActive : styles.statusPaused}>
                {status === 'active' ? 'Activo' : 'Pausado'}
              </span>
            </div>
            <button
              className={`${styles.toggle} ${status === 'active' ? styles.toggleOn : styles.toggleOff}`}
              onClick={() => setStatus(status === 'active' ? 'paused' : 'active')}
              aria-label={`${status === 'active' ? 'Pausar' : 'Activar'} video`}
              role="switch"
              aria-checked={status === 'active'}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-link">
              Link de producto
              <span className={styles.optional}>(opcional)</span>
            </label>
            <input
              id="edit-link"
              className={styles.input}
              type="text"
              placeholder="/colorvu"
              value={linkProducto}
              onChange={(e) => setLinkProducto(e.target.value)}
            />
          </div>

          <a
            href={video.tiktok_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.tiktokLink}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
            </svg>
            Ver en TikTok
          </a>
        </div>

        <div className={styles.actions}>
          <button
            className={`btn ${confirmDelete ? 'btn-danger' : styles.deleteBtn}`}
            onClick={handleDelete}
            disabled={loading}
          >
            {confirmDelete ? 'Confirmar eliminación' : 'Eliminar'}
          </button>

          <div className={styles.actionsRight}>
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
