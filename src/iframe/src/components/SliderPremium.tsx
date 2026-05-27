/**
 * SliderPremium — GSAP Flip caterpillar · autoplay · blur-in
 *
 * Diseño premium silencioso: foco en el contenido UGC.
 * Cards 9:16 en fila, la activa se agranda con GSAP Flip.
 * Autoavance cada 4 s · blur-in al entrar · video silencioso en activa.
 */
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import type { Video } from '../types'
import './SliderPremium.css'

gsap.registerPlugin(Flip)

const CARD_INACTIVE_W = 148   // px
const CARD_ACTIVE_W   = 272   // px
const CARD_GAP        = 10    // px
const AUTOPLAY_MS     = 4_200 // ms

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`
  return String(n)
}

/** X center of the active card in track coords (final layout state) */
function getActiveCenter(idx: number): number {
  return idx * (CARD_INACTIVE_W + CARD_GAP) + CARD_ACTIVE_W / 2
}

interface SliderPremiumProps {
  videos: Video[]
}

export function SliderPremium({ videos }: SliderPremiumProps) {
  const [activeIdx, setActiveIdx]     = useState(0)
  const [paused,    setPaused]        = useState(false)
  const containerRef  = useRef<HTMLDivElement>(null)
  const trackRef      = useRef<HTMLDivElement>(null)
  const videoRefs     = useRef<(HTMLVideoElement | null)[]>([])
  const flipStateRef  = useRef<ReturnType<typeof Flip.getState> | null>(null)
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = videos.length

  // ── advance ────────────────────────────────────────────────────────────────
  const advance = useCallback(() => {
    if (!trackRef.current) return
    flipStateRef.current = Flip.getState(
      trackRef.current.querySelectorAll<HTMLElement>('.sp-card'),
      { props: 'width,height' }
    )
    setActiveIdx(i => (i + 1) % total)
  }, [total])

  const goTo = useCallback((idx: number) => {
    if (!trackRef.current || idx === activeIdx) return
    flipStateRef.current = Flip.getState(
      trackRef.current.querySelectorAll<HTMLElement>('.sp-card'),
      { props: 'width,height' }
    )
    setActiveIdx(idx)
  }, [activeIdx])

  // ── autoplay timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (total < 2 || paused) return
    timerRef.current = setInterval(advance, AUTOPLAY_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [advance, total, paused])

  // ── init: position track ───────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const track     = trackRef.current
    if (!container || !track) return
    const cx = container.offsetWidth / 2
    gsap.set(track, { x: cx - getActiveCenter(0) })
  }, [])

  // ── GSAP Flip + transition after activeIdx changes ─────────────────────────
  useLayoutEffect(() => {
    const container = containerRef.current
    const track     = trackRef.current
    if (!container || !track) return

    const cards = track.querySelectorAll<HTMLElement>('.sp-card')

    // Animate card sizes with Flip
    if (flipStateRef.current) {
      Flip.from(flipStateRef.current, {
        duration:  0.65,
        ease:      'expo.out',
        absolute:  false,
        nested:    true,
      })
      flipStateRef.current = null
    }

    // Dim all → brighten active, with stagger
    cards.forEach((card, i) => {
      if (i === activeIdx) return
      gsap.to(card, { opacity: 0.42, scale: 0.96, duration: 0.4, ease: 'power2.out' })
    })

    // Blur-in on new active card
    const activeCard = cards[activeIdx]
    if (activeCard) {
      gsap.fromTo(activeCard,
        { filter: 'blur(14px)', opacity: 0.75, scale: 0.97 },
        { filter: 'blur(0px)',  opacity: 1,    scale: 1,
          duration: 0.55, ease: 'power3.out' }
      )
    }

    // Scroll track to center active card
    const cx      = container.offsetWidth / 2
    const targetX = cx - getActiveCenter(activeIdx)
    gsap.to(track, { x: targetX, duration: 0.65, ease: 'expo.out' })

    // Video: play active (muted), pause others
    videoRefs.current.forEach((el, i) => {
      if (!el) return
      if (i === activeIdx) {
        el.muted = true
        el.currentTime = 0
        el.play().catch(() => {})
      } else {
        el.pause()
      }
    })
  }, [activeIdx])

  return (
    <div
      className="sp-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Track */}
      <div className="sp-viewport" ref={containerRef}>
        <div className="sp-track" ref={trackRef}>
          {videos.map((video, idx) => {
            const isActive = idx === activeIdx
            return (
              <div
                key={video.id}
                className={`sp-card ${isActive ? 'sp-active' : ''}`}
                onClick={() => goTo(idx)}
                role="button"
                tabIndex={0}
                aria-label={video.description ?? `Video ${idx + 1}`}
                onKeyDown={e => e.key === 'Enter' && goTo(idx)}
              >
                {/* Media */}
                {video.video_url ? (
                  <video
                    ref={el => { videoRefs.current[idx] = el }}
                    className="sp-media"
                    src={video.video_url}
                    poster={video.thumbnail_url ?? undefined}
                    muted
                    playsInline
                    loop
                    preload="none"
                  />
                ) : (
                  <img
                    className="sp-media"
                    src={video.thumbnail_url ?? ''}
                    alt={video.description ?? 'Video'}
                    loading={idx < 3 ? 'eager' : 'lazy'}
                  />
                )}

                {/* Active overlay */}
                {isActive && (
                  <div className="sp-overlay">
                    {/* Views pill — top right */}
                    {video.views > 0 && (
                      <div className="sp-views-pill">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11">
                          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                        </svg>
                        {fmtNum(video.views)}
                      </div>
                    )}

                    {/* Creator + TikTok link — bottom */}
                    <div className="sp-bottom">
                      <div className="sp-creator">
                        {video.creator_country && (
                          <CountryFlag country={video.creator_country} />
                        )}
                        <span className="sp-handle">
                          @{video.creator_username ?? 'hikvisionlatam'}
                        </span>
                      </div>
                      <a
                        href={video.tiktok_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sp-tiktok-link"
                        onClick={e => e.stopPropagation()}
                        aria-label="Ver en TikTok"
                      >
                        <TikTokIcon />
                      </a>
                    </div>

                    {/* Description — single line */}
                    {video.description && (
                      <p className="sp-desc">{video.description}</p>
                    )}

                    {/* Product link */}
                    {video.link_producto && (
                      <a
                        href={video.link_producto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sp-product-link"
                        onClick={e => e.stopPropagation()}
                      >
                        Ver producto
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div className="sp-dots" role="tablist">
          {videos.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIdx}
              aria-label={`Video ${i + 1}`}
              className={`sp-dot ${i === activeIdx ? 'sp-dot-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  co:   '🇨🇴', mx: '🇲🇽', br: '🇧🇷', ar: '🇦🇷',
  pe:   '🇵🇪', cl: '🇨🇱', uy: '🇺🇾', ve: '🇻🇪',
  ec:   '🇪🇨', bo: '🇧🇴', py: '🇵🇾', do: '🇩🇴',
  cr:   '🇨🇷', pa: '🇵🇦', gt: '🇬🇹', hn: '🇭🇳',
  latam:'🌎',  us: '🇺🇸',
}

function CountryFlag({ country }: { country: string }) {
  const flag = FLAG_MAP[country.toLowerCase()]
  if (!flag) return null
  return <span className="sp-flag" aria-hidden="true">{flag}</span>
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.34 6.34 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9a8.18 8.18 0 004.75 1.54V6.94a4.85 4.85 0 01-1-.25z"/>
    </svg>
  )
}
