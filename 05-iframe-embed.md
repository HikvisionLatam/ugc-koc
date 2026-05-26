# 05 — Iframe público con slider responsivo

## Objetivo
Componente React standalone embebido como iframe en AEM. Detecta `site` y `landing` desde los params del URL, hace fetch a Supabase KOC y renderiza el slider. El diseño tiene el mismo nivel de criterio que el admin — nada de componentes de aspecto genérico.

**Tiempo estimado:** 3–4 horas
**Dependencias:** `02-backend-api.md`, `03-server-assets.md`
**Siguiente módulo:** `06-aem-integration.md`

---

## Principios de implementación

- **emilkowalski/skill** — las transiciones entre videos tienen física real. El thumbnail activo no solo cambia de borde — la imagen del video principal hace crossfade con motion.
- **pbakaus/impeccable** — el slider funciona perfecto en 280px de ancho y en 800px. Cada breakpoint tiene su propia composición, no solo "se achica".
- **Leonxlnx/taste-skill** — los botones dicen exactamente lo que hacen. El overlay de gradiente existe porque da legibilidad, no decoración. Nada es arbitrario.

---

## 1. Estructura del proyecto iframe

```
iframe-app/
├── index.html
├── src/
│   ├── main.tsx               ← entry point
│   ├── App.tsx                ← fetch + render
│   ├── components/
│   │   ├── UGCSlider.tsx      ← layout principal
│   │   ├── VideoMain.tsx      ← video grande con controles
│   │   └── ThumbGrid.tsx      ← miniaturas navegables
│   ├── hooks/
│   │   ├── useParams.ts       ← lee site + landing del URL
│   │   ├── useVideos.ts       ← fetch con revalidación
│   │   └── useContainerSize.ts ← ResizeObserver
│   └── styles/
│       ├── tokens.css         ← variables de diseño
│       └── global.css
├── vite.config.ts
└── package.json
```

**Dependencias:**
```bash
npm install @supabase/supabase-js
npm install framer-motion
# No Tailwind — CSS variables puro para mantener el bundle pequeño
```

---

## 2. Design tokens del iframe

```css
/* src/styles/tokens.css */
:root {
  /* Colores */
  --accent:      #d01e26;
  --glass-bg:    rgba(255, 255, 255, 0.12);
  --glass-border: rgba(255, 255, 255, 0.18);
  --overlay-gradient: linear-gradient(
    to bottom,
    transparent 25%,
    rgba(0, 0, 0, 0.5) 65%,
    rgba(0, 0, 0, 0.88) 100%
  );

  /* Tipografía — system stack, sin Google Fonts para velocidad */
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Timing con física real */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);

  /* Spacing */
  --gap: 10px;
  --pad: 12px;
  --radius: 12px;
}
```

---

## 3. Hook `useParams` — detecta site + landing

```typescript
// src/hooks/useParams.ts

export function useParams(): { site: string; landing: string } {
  const params = new URLSearchParams(window.location.search)
  return {
    site:    params.get('site')    ?? 'latam',
    landing: params.get('landing') ?? '',
  }
}
```

---

## 4. Hook `useVideos` — fetch con revalidación silenciosa

```typescript
// src/hooks/useVideos.ts
import { useState, useEffect, useCallback } from 'react'

export interface UGCVideo {
  id: string
  tiktok_id: string
  tiktok_url: string
  description: string
  thumbnail_url: string
  video_url: string
  views: number
  likes: number
  link_producto: string | null
  position: number
  lang: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function useVideos(site: string, landing: string) {
  const [videos, setVideos]   = useState<UGCVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  const fetch_ = useCallback(async () => {
    if (!site || !landing) return

    try {
      const res  = await fetch(`${API_BASE}/api/ugc/iframe?site=${site}&landing=${landing}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setVideos(Array.isArray(data) ? data : [])
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [site, landing])

  useEffect(() => { fetch_() }, [fetch_])

  // Revalidar silenciosamente cada 5 minutos
  useEffect(() => {
    const id = setInterval(fetch_, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetch_])

  return { videos, loading, error }
}
```

---

## 5. Hook `useContainerSize` — breakpoints responsivos

```typescript
// src/hooks/useContainerSize.ts
import { useRef, useState, useEffect } from 'react'

type Size = 'xs' | 'sm' | 'md' | 'lg'

function toSize(w: number): Size {
  if (w < 300) return 'xs'   // solo video principal, sin thumbs
  if (w < 440) return 'sm'   // video + 1 columna de thumbs
  if (w < 620) return 'md'   // video + 2 columnas (default AEM)
  return 'lg'                 // video + 3 columnas
}

export function useContainerSize() {
  const ref  = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>('md')

  useEffect(() => {
    if (!ref.current) return
    const obs = new ResizeObserver(entries => {
      setSize(toSize(entries[0].contentRect.width))
    })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return { ref, size }
}
```

---

## 6. Componente `VideoMain` — video grande con controles

```typescript
// src/components/VideoMain.tsx
import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { UGCVideo } from '../hooks/useVideos'

const t = (lang: string, key: string) => ({
  es: { play: 'Reproducir', pause: 'Pausar', mute: 'Silenciar', unmute: 'Activar sonido', tiktok: 'Ver en TikTok', product: 'Ver producto' },
  pt: { play: 'Reproduzir', pause: 'Pausar', mute: 'Silenciar', unmute: 'Ativar som', tiktok: 'Ver no TikTok', product: 'Ver produto' },
}[lang] ?? {})[key] ?? key

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

interface Props {
  video: UGCVideo
  lang: string
}

export function VideoMain({ video, lang }: Props) {
  const ref         = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted]     = useState(true)
  const [showPlay, setShowPlay] = useState(false)

  // Reset al cambiar de video
  useEffect(() => {
    if (ref.current) {
      ref.current.pause()
      ref.current.currentTime = 0
    }
    setPlaying(false)
  }, [video.id])

  function toggle() {
    if (!ref.current) return
    if (playing) { ref.current.pause(); setPlaying(false) }
    else         { ref.current.play().catch(() => {}); setPlaying(true) }
    // Mostrar feedback del botón brevemente
    setShowPlay(true)
    setTimeout(() => setShowPlay(false), 600)
  }

  function toggleMute() {
    if (!ref.current) return
    ref.current.muted = !muted
    setMuted(!muted)
  }

  return (
    <div
      onClick={toggle}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '9/16',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: '#000',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {/* Video */}
      <video
        ref={ref}
        src={video.video_url}
        poster={video.thumbnail_url}
        muted={muted}
        playsInline
        loop
        preload="metadata"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        aria-label={video.description?.slice(0, 80)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Gradiente */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--overlay-gradient)', pointerEvents: 'none' }} />

      {/* Botón mute — esquina superior derecha */}
      <button
        onClick={e => { e.stopPropagation(); toggleMute() }}
        aria-label={muted ? t(lang, 'unmute') : t(lang, 'mute')}
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--glass-border)',
          color: '#fff', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 10,
          transition: 'background 0.15s',
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {/* Botón play/pause — aparece al hacer clic */}
      <AnimatePresence>
        {(showPlay || !playing) && (
          <motion.div
            key="play"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(6px)',
              border: '1px solid var(--glass-border)',
              color: '#fff', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            {playing ? '⏸' : '▶'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenido inferior */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 'var(--pad)',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{fmt(video.views)} views</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{fmt(video.likes)} likes</span>
        </div>

        {/* Descripción */}
        <p style={{
          fontSize: 11, color: 'rgba(255,255,255,0.9)',
          margin: '0 0 10px', lineHeight: 1.45,
          overflow: 'hidden', display: '-webkit-box',
          WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
        }}>
          {video.description}
        </p>

        {/* Botones — pointer-events manual */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: 'grid',
            gridTemplateColumns: video.link_producto ? '1fr 1fr' : '1fr',
            gap: 6,
            pointerEvents: 'auto',
          }}
        >
          <a
            href={video.tiktok_url}
            target="_blank"
            rel="noopener noreferrer"
            style={glassBtn}
          >
            {t(lang, 'tiktok')}
          </a>
          {video.link_producto && (
            <a
              href={video.link_producto}
              target="_blank"
              rel="noopener noreferrer"
              style={redBtn}
            >
              {t(lang, 'product')}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

const glassBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '8px 10px',
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(10px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 9, color: '#fff',
  fontSize: 11, fontWeight: 600,
  textDecoration: 'none',
  transition: 'background 0.15s',
}

const redBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '8px 10px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 9, color: '#fff',
  fontSize: 11, fontWeight: 600,
  textDecoration: 'none',
  boxShadow: '0 2px 8px rgba(208,30,38,0.4)',
}
```

---

## 7. Componente `ThumbGrid` — miniaturas

```typescript
// src/components/ThumbGrid.tsx
import { motion } from 'framer-motion'
import type { UGCVideo } from '../hooks/useVideos'

interface Props {
  videos: UGCVideo[]
  activeIdx: number
  onSelect: (i: number) => void
  columns: 1 | 2 | 3
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
}

export function ThumbGrid({ videos, activeIdx, onSelect, columns }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: 'var(--gap)',
      alignContent: 'start',
      overflowY: 'auto',
      scrollbarWidth: 'none',
    }}>
      {videos.map((v, i) => {
        const active = i === activeIdx
        return (
          <motion.button
            key={v.id}
            onClick={() => onSelect(i)}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.12, ease: [0.34, 1.56, 0.64, 1] }}
            role="option"
            aria-selected={active}
            aria-label={v.description?.slice(0, 60)}
            style={{
              border: active ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 9,
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0,
              background: 'none',
              position: 'relative',
              aspectRatio: '9/16',
              outline: 'none',
              transition: 'border-color 0.15s var(--ease-out)',
            }}
          >
            <img
              src={v.thumbnail_url}
              alt=""
              aria-hidden="true"
              loading="lazy"
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover', display: 'block',
                filter: active ? 'none' : 'brightness(0.75)',
                transition: 'filter 0.2s var(--ease-out)',
              }}
            />
            {/* Views en el bottom */}
            <div aria-hidden="true" style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '3px 5px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
              fontSize: 9, color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.3,
            }}>
              {fmt(v.views)}
            </div>
            {/* Dot activo */}
            {active && (
              <motion.div
                layoutId="active-dot"
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 5, left: 5,
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--accent)',
                }}
              />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
```

---

## 8. Componente `UGCSlider` — composición responsiva

```typescript
// src/components/UGCSlider.tsx
import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { VideoMain } from './VideoMain'
import { ThumbGrid } from './ThumbGrid'
import { useContainerSize } from '../hooks/useContainerSize'
import type { UGCVideo } from '../hooks/useVideos'

const COLUMNS_MAP = { xs: 0, sm: 1, md: 2, lg: 3 } as const
const MAIN_WIDTH  = { xs: '100%', sm: '55%', md: '44%', lg: '38%' } as const

interface Props {
  videos: UGCVideo[]
  lang?: string
}

export function UGCSlider({ videos, lang = 'es' }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const { ref, size } = useContainerSize()

  const selectVideo = useCallback((i: number) => {
    if (i !== activeIdx) setActiveIdx(i)
  }, [activeIdx])

  const active  = videos[activeIdx]
  const columns = COLUMNS_MAP[size]
  const showThumbs = size !== 'xs'

  if (!active) return null

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        gap: 'var(--gap)',
        width: '100%',
        height: '100%',
        padding: 'var(--pad)',
        boxSizing: 'border-box',
        fontFamily: 'var(--font)',
      }}
      role="region"
      aria-label="Contenido UGC Hikvision en TikTok"
    >
      {/* Video principal — crossfade al cambiar */}
      <div style={{ width: MAIN_WIDTH[size], flexShrink: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ height: '100%' }}
          >
            <VideoMain video={active} lang={lang} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Miniaturas */}
      {showThumbs && (
        <div style={{ flex: 1 }} role="listbox" aria-label="Videos disponibles">
          <ThumbGrid
            videos={videos}
            activeIdx={activeIdx}
            onSelect={selectVideo}
            columns={columns as 1 | 2 | 3}
          />
        </div>
      )}
    </div>
  )
}
```

---

## 9. App.tsx — entry point

```typescript
// src/App.tsx
import { useParams }  from './hooks/useParams'
import { useVideos }  from './hooks/useVideos'
import { UGCSlider }  from './components/UGCSlider'
import './styles/tokens.css'
import './styles/global.css'

export default function App() {
  const { site, landing } = useParams()
  const { videos, loading, error } = useVideos(site, landing)

  // Sin landing configurada → iframe transparente
  if (!landing) return null

  // Loading — skeleton mínimo sin spinner genérico
  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(110deg, #1a1a1a 30%, #2a2a2a 50%, #1a1a1a 70%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
        borderRadius: 'var(--radius)',
      }} aria-hidden="true" />
    )
  }

  // Sin videos o error → silencioso (el iframe colapsa)
  if (error || videos.length === 0) {
    // Notificar al padre para ocultar el wrapper
    window.parent?.postMessage?.({ type: 'UGC_EMPTY' }, '*')
    return null
  }

  return <UGCSlider videos={videos} lang={videos[0]?.lang ?? 'es'} />
}
```

```css
/* src/styles/global.css */
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Ocultar scrollbar en thumbs grid */
::-webkit-scrollbar { display: none; }
```

---

## 10. Build y deploy

```bash
# Build con Vite
npm run build     # output: dist/

# El iframe se sirve como static site en el servidor
# Copiar dist/ al servidor:
scp -r dist/ marketing-digital@ssh.hikvisionlatam.tech:/var/www/ugc-iframe/

# Agregar a Nginx (nuevo server block en kocassets o aparte):
# location /embed { alias /var/www/ugc-iframe/; try_files $uri /index.html; }

# Agregar al tunnel:
# - hostname: ugc.hikvisionlatam.tech
#   service: http://localhost:8090
```

---

## Checklist de este módulo

- [ ] `useParams` lee `site` y `landing` correctamente del URL
- [ ] `useVideos` hace fetch al endpoint `/api/ugc/iframe` y maneja errores
- [ ] `useContainerSize` devuelve el breakpoint correcto: xs/sm/md/lg
- [ ] `VideoMain` reproduce video con play/pause y mute funcionando
- [ ] Crossfade al cambiar de video (AnimatePresence)
- [ ] `ThumbGrid` cambia el video activo al hacer clic
- [ ] Dot animado con `layoutId` en miniatura activa
- [ ] `UGCSlider` en xs: solo video, sin thumbs
- [ ] `UGCSlider` en sm: video 55% + 1 columna thumbs
- [ ] `UGCSlider` en md: video 44% + 2 columnas thumbs
- [ ] Botón "Ver en TikTok" funcional en todos los breakpoints
- [ ] Botón "Ver producto" solo aparece si `link_producto` tiene valor
- [ ] Estado vacío notifica al padre con `postMessage`
- [ ] Build genera `dist/` sin errores
- [ ] Deploy en `ugc.hikvisionlatam.tech`

**Siguiente → `06-aem-integration.md`**
