'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AddVideoModal } from './AddVideoModal'
import { EditVideoModal } from './EditVideoModal'
import styles from './VideoGrid.module.css'

interface VideoItem {
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
  videos: VideoItem[]
  landingId: string
  landingName: string
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function VideoGrid({ videos, landingId, landingName }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<VideoItem | null>(null)

  function refresh() {
    startTransition(() => router.refresh())
  }

  return (
    <>
      <div className={styles.grid}>
        {videos.map((video) => (
          <button
            key={video.id}
            className={styles.card}
            onClick={() => setEditing(video)}
          >
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
              <span className={`${styles.statusBadge} ${video.status === 'active' ? styles.badgeActive : styles.badgePaused}`}>
                {video.status === 'active' ? 'Activo' : 'Pausado'}
              </span>
            </div>

            <div className={styles.cardInfo}>
              <p className={styles.cardTitle}>
                {video.description ?? video.tiktok_url.split('/video/')[1] ?? '—'}
              </p>
              <div className={styles.cardStats}>
                <span className={styles.statItem}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  {fmtNum(video.views)}
                </span>
                <span className={styles.statItem}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  {fmtNum(video.likes)}
                </span>
              </div>
            </div>
          </button>
        ))}

        <button
          className={styles.addCard}
          onClick={() => setShowAdd(true)}
          aria-label="Agregar video de TikTok"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Agregar video</span>
        </button>
      </div>

      {showAdd && (
        <AddVideoModal
          landingId={landingId}
          landingName={landingName}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            refresh()
          }}
        />
      )}

      {editing && (
        <EditVideoModal
          video={editing}
          landingName={landingName}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </>
  )
}
