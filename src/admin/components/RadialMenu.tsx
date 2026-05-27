'use client'
/**
 * RadialMenu — GSAP elastic.out FAB radial para el admin
 *
 * FAB fijo en la esquina inferior-izquierda del área de contenido.
 * Al abrir, 4 ítems saltan en arco 90° (arriba → derecha) con elastic.out.
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import styles from './RadialMenu.module.css'

// ── Config de ítems ───────────────────────────────────────────────────────────
const RADIUS = 88  // px entre el FAB y cada ítem

interface MenuItem {
  angle:    number
  label:    string
  href:     string | null
  external?: string
  icon:     React.ReactNode
}

// Arco: de -90° (arriba) a 0° (derecha) — 4 ítems, 30° de separación
const ITEMS: MenuItem[] = [
  {
    angle:  -90,
    label:  'Nuevo video',
    href:   '/websites',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
  },
  {
    angle:  -60,
    label:  'Sync stats',
    href:   '/activity',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
        <polyline points="1 4 1 10 7 10"/>
        <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
      </svg>
    ),
  },
  {
    angle:  -30,
    label:  'Websites',
    href:   '/websites',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 014-10z"/>
      </svg>
    ),
  },
  {
    angle:    0,
    label:   'Vista previa',
    href:    null,
    external: 'http://localhost:5173/?site=latam&landing=colorvu&style=premium',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
] as const

function toXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(rad) * r, y: Math.sin(rad) * r }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function RadialMenu() {
  const router   = useRouter()
  const [open, setOpen]       = useState(false)
  const fabRef                = useRef<HTMLButtonElement>(null)
  const itemRefs              = useRef<(HTMLButtonElement | null)[]>([])
  const labelsRef             = useRef<(HTMLSpanElement | null)[]>([])
  const overlayRef            = useRef<HTMLDivElement>(null)
  const tlRef                 = useRef<gsap.core.Timeline | null>(null)

  // Build / rebuild timeline when deps change
  const buildTimeline = useCallback(() => {
    const items  = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
    const labels = labelsRef.current.filter(Boolean) as HTMLSpanElement[]
    if (!items.length) return

    const tl = gsap.timeline({ paused: true })

    // FAB icon rotation
    tl.to(fabRef.current, {
      rotate: 45,
      duration: 0.3,
      ease: 'back.out(2)',
    }, 0)

    // Items: pop out from FAB center
    items.forEach((el, i) => {
      const { x, y } = toXY(ITEMS[i].angle, RADIUS)
      tl.fromTo(
        el,
        { x: 0, y: 0, scale: 0.3, opacity: 0 },
        {
          x,
          y,
          scale:    1,
          opacity:  1,
          duration: 0.7,
          ease:     'elastic.out(1, 0.5)',
          stagger:  0.06,
        },
        0.05 + i * 0.06
      )
    })

    // Labels fade in after items land
    tl.fromTo(
      labels,
      { opacity: 0, y: 4 },
      { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', stagger: 0.04 },
      0.5
    )

    tlRef.current = tl
  }, [])

  useEffect(() => {
    // Init items off-screen
    const items  = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
    const labels = labelsRef.current.filter(Boolean) as HTMLSpanElement[]
    gsap.set(items,  { x: 0, y: 0, scale: 0.3, opacity: 0 })
    gsap.set(labels, { opacity: 0 })

    buildTimeline()
  }, [buildTimeline])

  function toggleMenu() {
    if (!tlRef.current) return
    if (open) {
      tlRef.current.reverse()
      setOpen(false)
    } else {
      tlRef.current.restart()
      setOpen(true)
    }
  }

  function closeMenu() {
    tlRef.current?.reverse()
    setOpen(false)
  }

  function handleItemClick(item: MenuItem) {
    closeMenu()
    setTimeout(() => {
      if (item.external) {
        window.open(item.external, '_blank', 'noopener,noreferrer')
      } else if (item.href) {
        router.push(item.href)
      }
    }, 180)
  }

  return (
    <>
      {/* Backdrop — cierra el menú al hacer click fuera */}
      {open && (
        <div
          ref={overlayRef}
          className={styles.backdrop}
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <div className={styles.anchor}>
        {/* Menu items (absolute, stacked at center) */}
        {ITEMS.map((item, i) => (
          <button
            key={i}
            ref={el => { itemRefs.current[i] = el }}
            className={styles.item}
            onClick={() => handleItemClick(item)}
            aria-label={item.label}
            tabIndex={open ? 0 : -1}
          >
            {item.icon}
            {/* Tooltip label */}
            <span
              ref={el => { labelsRef.current[i] = el }}
              className={styles.itemLabel}
              aria-hidden="true"
            >
              {item.label}
            </span>
          </button>
        ))}

        {/* Main FAB */}
        <button
          ref={fabRef}
          className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
          onClick={toggleMenu}
          aria-expanded={open}
          aria-label={open ? 'Cerrar menú' : 'Acciones rápidas'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            width="22"
            height="22"
          >
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5"  y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </>
  )
}
