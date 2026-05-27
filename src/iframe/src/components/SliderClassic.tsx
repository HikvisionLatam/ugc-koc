/**
 * SliderClassic — puerto fiel de TiktokCarousel.jsx
 * Splide carousel · play/pause in-page · mute toggle · stats · i18n
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Splide, SplideSlide, type SplideProps } from '@splidejs/react-splide'
import '@splidejs/react-splide/css/core'
import type { Video } from '../types'
import './SliderClassic.css'

// ─── i18n ─────────────────────────────────────────────────────────────────────
const DICT = {
  en: {
    watchOn:       'Watch on TikTok',
    seeProduct:    'See Product',
    exploreMore:   'Explore more on TikTok',
    play:          'Play',
    pause:         'Pause',
    mute:          'Mute',
    unmute:        'Unmute',
    views:         (n: string) => `${n} views`,
    comments:      (n: string) => `${n} comments`,
    likes:         (n: string) => `${n} likes`,
  },
  pt: {
    watchOn:       'Ver no TikTok',
    seeProduct:    'Ver Produto',
    exploreMore:   'Explorar mais no TikTok',
    play:          'Reproduzir',
    pause:         'Pausar',
    mute:          'Silenciar',
    unmute:        'Ativar som',
    views:         (n: string) => `${n} visualizações`,
    comments:      (n: string) => `${n} comentários`,
    likes:         (n: string) => `${n} curtidas`,
  },
  es: {
    watchOn:       'Ver en TikTok',
    seeProduct:    'Ver Producto',
    exploreMore:   'Explora más en TikTok',
    play:          'Reproducir',
    pause:         'Pausar',
    mute:          'Silenciar',
    unmute:        'Activar sonido',
    views:         (n: string) => `${n} visualizaciones`,
    comments:      (n: string) => `${n} comentarios`,
    likes:         (n: string) => `${n} me gusta`,
  },
} as const

type Lang = keyof typeof DICT

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ─── Icons (inline SVG, no FA dependency) ─────────────────────────────────────
const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M8 5v14l11-7L8 5z"/>
  </svg>
)
const IconPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
)
const IconVolumeOn = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
  </svg>
)
const IconVolumeMute = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
  </svg>
)
const IconTikTok = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.34 6.34 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9a8.18 8.18 0 004.75 1.54V6.94a4.85 4.85 0 01-1-.25z"/>
  </svg>
)
const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
)
const IconVerified = () => (
  <svg viewBox="0 0 16 16" fill="#29b6f6" width="13" height="13">
    <path d="M10.067.87a2.89 2.89 0 00-4.134 0l-.622.638-.89-.011a2.89 2.89 0 00-2.924 2.924l.01.89-.636.622a2.89 2.89 0 000 4.134l.637.622-.011.89a2.89 2.89 0 002.924 2.924l.89-.01.622.636a2.89 2.89 0 004.134 0l.622-.637.89.011a2.89 2.89 0 002.924-2.924l-.01-.89.636-.622a2.89 2.89 0 000-4.134l-.637-.622.011-.89a2.89 2.89 0 00-2.924-2.924l-.89.01zm.287 5.984l-3 3a.5.5 0 01-.708 0l-1.5-1.5a.5.5 0 11.708-.708L7 8.793l2.646-2.647a.5.5 0 01.708.708"/>
  </svg>
)
const IconChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
)
const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)
const IconEye = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
)
const IconComment = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
    <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
  </svg>
)
const IconHeart = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
)

// ─── Component ────────────────────────────────────────────────────────────────
interface SliderClassicProps {
  videos: Video[]
}

export function SliderClassic({ videos }: SliderClassicProps) {
  const splideRef   = useRef<InstanceType<typeof Splide>>(null)
  const videoRefs   = useRef<(HTMLVideoElement | null)[]>([])
  const [playingIdx, setPlayingIdx]   = useState<number | null>(null)
  const [mutedMap,   setMutedMap]     = useState<Record<number, boolean>>({})
  const [hoveredIdx, setHoveredIdx]   = useState<number | null>(null)

  const lang: Lang = useMemo(() => {
    const l = videos[0]?.lang ?? 'es'
    return (l in DICT ? l : 'es') as Lang
  }, [videos])

  const t = useCallback(<K extends keyof typeof DICT['es']>(
    key: K,
    ...args: string[]
  ): string => {
    const dict = DICT[lang]
    const val  = dict[key]
    return typeof val === 'function' ? (val as (n: string) => string)(args[0]) : (val as string)
  }, [lang])

  // Sync video elements with play/mute state
  useEffect(() => {
    videoRefs.current.forEach((el, i) => {
      if (!el) return
      el.muted = mutedMap[i] !== false
      if (i === playingIdx) {
        el.play().catch(() => {})
      } else {
        el.pause()
      }
    })
  }, [playingIdx, mutedMap])

  function handlePlayPause(idx: number) {
    if (playingIdx === idx) {
      setPlayingIdx(null)
      setMutedMap(m => ({ ...m, [idx]: true }))
    } else {
      setPlayingIdx(idx)
      setMutedMap(m => ({ ...m, [idx]: false }))
    }
  }

  function handleMute(idx: number, e: React.MouseEvent) {
    e.stopPropagation()
    setMutedMap(m => ({ ...m, [idx]: !(m[idx] === false ? false : true) }))
  }

  function handleCardClick(idx: number, video: Video, e: React.MouseEvent) {
    // If clicking directly on the card (not on buttons), open TikTok
    if ((e.target as HTMLElement).closest('.sc-btn')) return
    if (video.video_url && playingIdx !== idx) {
      handlePlayPause(idx)
    } else if (!video.video_url) {
      window.open(video.tiktok_url, '_blank', 'noopener,noreferrer')
    }
  }

  function handleVideoEnded(idx: number) {
    setPlayingIdx(null)
    setMutedMap(m => ({ ...m, [idx]: true }))
  }

  const splideOptions: SplideProps['options'] = {
    type:       'loop',
    perPage:    3,
    perMove:    1,
    padding:    { right: '4%' },
    gap:        '10px',
    arrows:     false,
    pagination: false,
    rewind:     false,
    speed:      580,
    dragMinThreshold: { mouse: 80, touch: 60 },
    flickPower: 80,
    breakpoints: {
      900: { perPage: 2, padding: { right: '8%' } },
      600: { perPage: 1, padding: { right: '12%' } },
    },
  }

  const profileLink = `https://www.tiktok.com/@${videos[0]?.creator_username ?? 'hikvisionlatam'}`

  return (
    <div className="sc-root">
      <div className="sc-carousel-wrap">
        {/* Prev arrow */}
        <button
          className="sc-arrow sc-arrow-prev"
          onClick={() => splideRef.current?.go('<')}
          aria-label="Anterior"
        >
          <IconChevronLeft />
        </button>

        <Splide ref={splideRef} options={splideOptions} className="sc-splide">
          {videos.map((video, idx) => {
            const isPlaying = playingIdx === idx
            const isMuted   = mutedMap[idx] !== false

            return (
              <SplideSlide key={video.id}>
                <div
                  className="sc-card"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={(e) => handleCardClick(idx, video, e)}
                >
                  {/* Video / Thumbnail */}
                  {video.video_url ? (
                    <video
                      ref={el => { videoRefs.current[idx] = el }}
                      className="sc-media"
                      src={video.video_url}
                      poster={video.thumbnail_url ?? undefined}
                      muted={isMuted}
                      playsInline
                      loop
                      preload="none"
                      onEnded={() => handleVideoEnded(idx)}
                    />
                  ) : (
                    <img
                      className="sc-media"
                      src={video.thumbnail_url ?? ''}
                      alt={video.description ?? 'Video UGC'}
                      loading="lazy"
                    />
                  )}

                  {/* Mute btn */}
                  {video.video_url && (
                    <button
                      className="sc-btn sc-btn-mute"
                      onClick={(e) => handleMute(idx, e)}
                      aria-label={isMuted ? t('unmute') : t('mute')}
                    >
                      {isMuted ? <IconVolumeMute /> : <IconVolumeOn />}
                    </button>
                  )}

                  {/* Play/Pause btn — visible when hovering or when not playing */}
                  {video.video_url && (
                    <button
                      className={`sc-btn sc-btn-play ${(hoveredIdx === idx || !isPlaying) ? 'sc-btn-play-visible' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handlePlayPause(idx) }}
                      aria-label={isPlaying ? t('pause') : t('play')}
                    >
                      {isPlaying ? <IconPause /> : <IconPlay />}
                    </button>
                  )}

                  {/* Bottom overlay */}
                  <div className="sc-overlay">
                    <div className="sc-content">
                      {/* Username */}
                      <div className="sc-username-row">
                        <span className="sc-username">
                          @{video.creator_username ?? 'hikvisionlatam'}
                        </span>
                        <IconVerified />
                      </div>

                      {/* Description */}
                      {video.description && (
                        <p className="sc-desc">{video.description}</p>
                      )}

                      {/* Stats */}
                      <div className="sc-stats">
                        {video.views > 0 && (
                          <span className="sc-stat">
                            <IconEye />
                            <span>{fmtNum(video.views)}</span>
                          </span>
                        )}
                        {video.comments > 0 && (
                          <span className="sc-stat sc-stat-mid">
                            <IconComment />
                            <span>{fmtNum(video.comments)}</span>
                          </span>
                        )}
                        {video.likes > 0 && (
                          <span className="sc-stat">
                            <IconHeart />
                            <span>{fmtNum(video.likes)}</span>
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className={`sc-actions ${!video.link_producto ? 'sc-actions-single' : ''}`}>
                        <button
                          className="sc-btn sc-btn-tiktok"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(video.tiktok_url, '_blank', 'noopener,noreferrer')
                          }}
                          aria-label={t('watchOn')}
                        >
                          <IconTikTok />
                          <span>{t('watchOn')}</span>
                        </button>

                        {video.link_producto && (
                          <button
                            className="sc-btn sc-btn-product"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(video.link_producto!, '_blank', 'noopener,noreferrer')
                            }}
                            aria-label={t('seeProduct')}
                          >
                            <span>{t('seeProduct')}</span>
                            <IconArrowRight />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </SplideSlide>
            )
          })}
        </Splide>

        {/* Next arrow */}
        <button
          className="sc-arrow sc-arrow-next"
          onClick={() => splideRef.current?.go('>')}
          aria-label="Siguiente"
        >
          <IconChevronRight />
        </button>
      </div>

      {/* Explore more pill */}
      <div className="sc-footer">
        <a
          href={profileLink}
          target="_blank"
          rel="noopener noreferrer"
          className="sc-explore-pill"
        >
          {t('exploreMore')}
          <IconTikTok />
        </a>
      </div>
    </div>
  )
}
