# 04 — Portal de administración (Frontend)

## Objetivo
Dashboard admin en Next.js 14 con App Router. Gestión completa de videos, landings, websites y usuarios. Diseño funcional, sin decoración innecesaria — cada elemento tiene un propósito.

**Tiempo estimado:** 4–6 horas
**Dependencias:** `01-database.md`, `02-backend-api.md`
**Siguiente módulo:** `05-iframe-embed.md`

---

## Principios de implementación

Estas tres referencias definen el criterio de calidad para este portal:

- **emilkowalski/skill** — microinteracciones que se sienten físicas. Los estados de hover, loading y transición tienen peso real. Nada de opacity fades genéricos.
- **pbakaus/impeccable** — cero tolerancia a detalles descuidados. Spacing consistente, tipografía con jerarquía clara, bordes que respiran.
- **Leonxlnx/taste-skill** — decisiones de diseño con criterio. Si un elemento no añade información o contexto, no existe. El admin se ve serio porque es una herramienta seria.

**Lo que esto significa en código:**
- Animaciones con `spring physics` (Framer Motion o CSS custom easing), no `ease-in-out` genérico
- Tipografía con escala modular, no tamaños aleatorios
- Estados de loading que informan, no solo giran
- Feedback inmediato en cada acción — el usuario nunca se pregunta si algo funcionó

---

## 1. Stack y estructura

```
admin/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── websites/page.tsx
│   │   ├── websites/[site]/page.tsx
│   │   ├── websites/[site]/[landing]/page.tsx
│   │   ├── users/page.tsx
│   │   └── activity/page.tsx
│   └── api/ugc/                       ← endpoints del módulo 02
├── components/ugc/
│   ├── VideoCard.tsx
│   ├── AddVideoModal.tsx
│   ├── EditVideoSheet.tsx             ← sheet lateral, no modal
│   ├── WebsiteGrid.tsx
│   ├── LandingList.tsx
│   └── ActivityFeed.tsx
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   └── api.ts
└── hooks/
    ├── useUser.ts
    ├── useVideos.ts
    └── useOptimistic.ts               ← updates optimistas en la UI
```

**Dependencias clave:**
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install framer-motion                    # animaciones con física real
npm install sonner                           # toasts que se ven bien
npm install @radix-ui/react-dialog @radix-ui/react-sheet
npm install class-variance-authority clsx tailwind-merge
```

**Fuente del admin:** `Geist` (de Vercel, libre) — monoespaciada para IDs y datos, sans para UI. Instalar via `next/font`.

---

## 2. Design tokens — CSS variables

Definir una vez, usar en todo el proyecto:

```css
/* app/globals.css */
:root {
  /* Superficie */
  --bg:           #f8f7f5;
  --bg-elevated:  #ffffff;
  --bg-sunken:    #f0efe d;

  /* Bordes */
  --border:       rgba(0, 0, 0, 0.08);
  --border-focus: rgba(0, 0, 0, 0.22);

  /* Texto */
  --text-primary:   #0f0f0f;
  --text-secondary: #6b6b6b;
  --text-tertiary:  #a3a3a3;

  /* Acento — rojo Hikvision */
  --accent:       #d01e26;
  --accent-hover: #b8181f;
  --accent-dim:   rgba(208, 30, 38, 0.08);

  /* Estados */
  --success:      #166534;
  --success-bg:   #f0fdf4;
  --warning:      #92400e;
  --warning-bg:   #fffbeb;

  /* Spacing modular (base 4px) */
  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 16px;
  --s5: 20px;
  --s6: 24px;
  --s8: 32px;
  --s10: 40px;

  /* Tipografía */
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 14px;
  --text-md:   16px;
  --text-lg:   18px;

  /* Radius */
  --r-sm: 6px;
  --r-md: 8px;
  --r-lg: 12px;

  /* Sombras */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);

  /* Easing con física real (Emil Kowalski style) */
  --ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:  cubic-bezier(0.45, 0, 0.55, 1);
}
```

---

## 3. Layout del dashboard

```typescript
// app/(dashboard)/layout.tsx
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Sidebar } from '@/components/ugc/Sidebar'
import { Toaster } from 'sonner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: 200,
        padding: 'var(--s8)',
        maxWidth: 1100,
      }}>
        {children}
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
```

```typescript
// components/ugc/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/websites',  label: 'Websites',   icon: '◻' },
  { href: '/users',     label: 'Usuarios',   icon: '◻' },
  { href: '/activity',  label: 'Actividad',  icon: '◻' },
]

export function Sidebar() {
  const path = usePathname()

  return (
    <aside style={{
      width: 200,
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      background: 'var(--bg-elevated)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: 'var(--s4)',
    }}>
      {/* Logo */}
      <div style={{ padding: 'var(--s4) var(--s2) var(--s6)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--s4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
          <div style={{ width: 22, height: 22, background: 'var(--accent)', borderRadius: 5 }} />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>UGC Manager</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Hikvision LATAM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ href, label }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href} style={{
              padding: 'var(--s2) var(--s3)',
              borderRadius: 'var(--r-sm)',
              fontSize: 'var(--text-sm)',
              fontWeight: active ? 500 : 400,
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              background: active ? 'var(--accent-dim)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s var(--ease-out)',
            }}>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer con logout */}
      <div style={{ marginTop: 'auto', paddingTop: 'var(--s4)', borderTop: '1px solid var(--border)' }}>
        <LogoutButton />
      </div>
    </aside>
  )
}
```

---

## 4. Página de websites — grid de cards

```typescript
// app/(dashboard)/websites/page.tsx
import { supabaseServer } from '@/lib/supabase'

export default async function WebsitesPage() {
  const { data: websites } = await supabaseServer
    .from('websites')
    .select('*, landings(count), video_landings(count)')
    .eq('active', true)

  return (
    <div>
      <PageHeader title="Websites" subtitle="Gestión de contenido UGC por país" />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 'var(--s4)',
        marginTop: 'var(--s6)',
      }}>
        {websites?.map(site => (
          <WebsiteCard key={site.id} site={site} />
        ))}
      </div>
    </div>
  )
}

function WebsiteCard({ site }: { site: any }) {
  return (
    <a href={`/websites/${site.id}`} style={{
      display: 'block',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      padding: 'var(--s5)',
      textDecoration: 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      cursor: 'pointer',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)'
      e.currentTarget.style.boxShadow = 'var(--shadow-md)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = 'var(--border)'
      e.currentTarget.style.boxShadow = 'none'
    }}>
      <div style={{ fontSize: 28, marginBottom: 'var(--s3)' }}>{site.flag}</div>
      <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>{site.name}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{site.url}</div>
      <div style={{ marginTop: 'var(--s4)', display: 'flex', gap: 'var(--s3)' }}>
        <Pill label={`${site.landings?.[0]?.count ?? 0} landings`} />
      </div>
    </a>
  )
}
```

---

## 5. Componente `AddVideoModal` — el flujo más crítico

El modal tiene 4 estados con transiciones entre ellos. La física de la animación hace que se sienta real.

```typescript
// components/ugc/AddVideoModal.tsx
'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

type Step = 'input' | 'processing' | 'done' | 'error'

const PROCESSING_MESSAGES = [
  'Conectando con TikTok...',
  'Extrayendo información del video...',
  'Procesando thumbnail...',
  'Guardando video en el servidor...',
  'Registrando en base de datos...',
]

interface Props {
  landingId: string
  onSuccess: () => void
  onClose: () => void
}

export function AddVideoModal({ landingId, onSuccess, onClose }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [url, setUrl] = useState('')
  const [linkProducto, setLinkProducto] = useState('')
  const [msgIndex, setMsgIndex] = useState(0)
  const [error, setError] = useState('')

  function isValid(u: string) {
    return u.includes('tiktok.com') && u.includes('/video/')
  }

  async function handleProcess() {
    if (!isValid(url)) {
      setError('Pega una URL válida: tiktok.com/@hikvisionlatam/video/...')
      return
    }
    setError('')
    setStep('processing')

    // Rotar mensajes mientras espera
    const interval = setInterval(() => {
      setMsgIndex(i => Math.min(i + 1, PROCESSING_MESSAGES.length - 1))
    }, 5000)

    try {
      const res = await fetch('/api/ugc/process-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktok_url: url, landing_id: landingId, link_producto: linkProducto || null }),
      })

      clearInterval(interval)

      if (res.status === 409) {
        setError('Este video ya existe en el sistema')
        setStep('error')
        return
      }
      if (!res.ok) throw new Error()

      const data = await res.json()
      setStep('done')

      if (data.status === 'partial') {
        toast.warning('Video publicado sin archivo MP4 — solo thumbnail disponible')
      } else {
        toast.success('Video publicado correctamente')
      }

      setTimeout(() => { onSuccess(); onClose() }, 1200)

    } catch {
      clearInterval(interval)
      setError('Error al procesar el video. Revisa que la URL sea correcta.')
      setStep('error')
    }
  }

  return (
    // Overlay
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
        backdropFilter: 'blur(2px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--s6)',
          width: 420,
          boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Agregar video de TikTok"
      >
        <AnimatePresence mode="wait">

          {/* PASO: input */}
          {step === 'input' && (
            <motion.div key="input"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}>
              <ModalTitle>Agregar video</ModalTitle>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-sm)', padding: 'var(--s3)', marginBottom: 'var(--s4)', fontSize: 'var(--text-sm)', color: '#991b1b' }}>
                  {error}
                </div>
              )}

              <Field label="URL del video en TikTok" hint="Debe ser de @hikvisionlatam">
                <input
                  type="url"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError('') }}
                  placeholder="https://www.tiktok.com/@hikvisionlatam/video/..."
                  autoFocus
                  style={inputStyle}
                  aria-label="URL del video de TikTok"
                />
              </Field>

              <Field label="Link de producto" hint="Opcional — aparece como botón rojo en el iframe">
                <input
                  type="url"
                  value={linkProducto}
                  onChange={e => setLinkProducto(e.target.value)}
                  placeholder="https://hikvision.com/co/colorvu"
                  style={inputStyle}
                  aria-label="Link de producto asociado"
                />
              </Field>

              <ModalActions>
                <GhostButton onClick={onClose}>Cancelar</GhostButton>
                <PrimaryButton onClick={handleProcess} disabled={!url}>
                  Procesar y publicar
                </PrimaryButton>
              </ModalActions>
            </motion.div>
          )}

          {/* PASO: processing */}
          {step === 'processing' && (
            <motion.div key="processing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ textAlign: 'center', padding: 'var(--s6) 0' }}>
              <Spinner />
              <AnimatePresence mode="wait">
                <motion.p key={msgIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  style={{ marginTop: 'var(--s4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {PROCESSING_MESSAGES[msgIndex]}
                </motion.p>
              </AnimatePresence>
              <p style={{ marginTop: 'var(--s2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                Esto puede tomar 20–40 segundos
              </p>
            </motion.div>
          )}

          {/* PASO: done */}
          {step === 'done' && (
            <motion.div key="done"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: 'var(--s6) 0' }}>
              <div style={{ fontSize: 32 }}>✓</div>
              <p style={{ marginTop: 'var(--s3)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', fontWeight: 500 }}>
                Video publicado
              </p>
            </motion.div>
          )}

          {/* PASO: error */}
          {step === 'error' && (
            <motion.div key="error"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ModalTitle>Error al procesar</ModalTitle>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--s5)' }}>
                {error}
              </p>
              <ModalActions>
                <GhostButton onClick={onClose}>Cerrar</GhostButton>
                <PrimaryButton onClick={() => setStep('input')}>Reintentar</PrimaryButton>
              </ModalActions>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border-focus)',
  borderRadius: 'var(--r-sm)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'inherit',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
}

function ModalTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--s5)', color: 'var(--text-primary)' }}>{children}</h2>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--s4)' }}>
      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 'var(--s1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--s1)' }}>{hint}</p>}
    </div>
  )
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 'var(--s2)', justifyContent: 'flex-end', marginTop: 'var(--s6)' }}>{children}</div>
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 16px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-focus)', background: 'transparent', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
      {children}
    </button>
  )
}

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '8px 16px', borderRadius: 'var(--r-sm)', border: 'none', background: disabled ? 'var(--text-tertiary)' : 'var(--accent)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
  )
}
```

---

## 6. VideoCard — gestión individual

```typescript
// components/ugc/VideoCard.tsx
'use client'
import { useState } from 'react'
import { toast } from 'sonner'

interface Video {
  id: string
  tiktok_url: string
  tiktok_id: string
  description: string
  thumbnail_url: string
  views: number
  likes: number
  status: 'active' | 'paused' | 'deleted'
  link_producto?: string
  landing_id: string
}

export function VideoCard({ video, onUpdate }: { video: Video; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false)
  const paused = video.status === 'paused'

  async function toggleStatus() {
    setLoading(true)
    const newStatus = paused ? 'active' : 'paused'
    const res = await fetch(`/api/ugc/videos/${video.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, landing_id: video.landing_id }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success(paused ? 'Video activado' : 'Video pausado')
      onUpdate()
    } else {
      toast.error('Error al actualizar')
    }
  }

  return (
    <article style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      opacity: paused ? 0.6 : 1,
      transition: 'opacity 0.2s var(--ease-out)',
    }}>
      {/* Thumbnail — aspect ratio 9:16 */}
      <div style={{ position: 'relative', aspectRatio: '9/16', background: '#111', overflow: 'hidden', maxHeight: 180 }}>
        {video.thumbnail_url && (
          <img
            src={video.thumbnail_url}
            alt=""
            aria-hidden="true"
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s var(--ease-out)' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          />
        )}
        <StatusBadge status={video.status} />
      </div>

      {/* Info */}
      <div style={{ padding: 'var(--s3) var(--s3) var(--s2)' }}>
        <p style={{
          fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
          overflow: 'hidden', display: '-webkit-box',
          WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
          lineHeight: 1.5, margin: 0,
        }}>
          {video.description}
        </p>
        <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s2)' }}>
          <Stat label="views" value={video.views} />
          <Stat label="likes" value={video.likes} />
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
        <ActionButton
          onClick={toggleStatus}
          loading={loading}
          aria-label={paused ? 'Activar video' : 'Pausar video'}
        >
          {paused ? 'Activar' : 'Pausar'}
        </ActionButton>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <a
          href={video.tiktok_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: 1, padding: 'var(--s2)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textDecoration: 'none' }}
          aria-label="Ver en TikTok (nueva pestaña)"
        >
          TikTok ↗
        </a>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    active: { bg: 'var(--accent)', text: '#fff' },
    paused: { bg: 'rgba(0,0,0,0.4)', text: 'rgba(255,255,255,0.7)' },
    deleted: { bg: '#991b1b', text: '#fff' },
  }
  const c = colors[status as keyof typeof colors] ?? colors.paused
  return (
    <span style={{
      position: 'absolute', top: 8, right: 8,
      padding: '2px 7px', borderRadius: 100,
      fontSize: 'var(--text-xs)', fontWeight: 500,
      background: c.bg, color: c.text,
    }}>
      {status === 'active' ? 'Activo' : status === 'paused' ? 'Pausado' : 'Eliminado'}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n)
  return (
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
      {fmt(value)} {label}
    </span>
  )
}

function ActionButton({ onClick, loading, children, ...props }: any) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      {...props}
      style={{
        flex: 1, padding: 'var(--s2)', background: 'none', border: 'none',
        fontSize: 'var(--text-xs)', color: loading ? 'var(--text-tertiary)' : 'var(--text-secondary)',
        cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
        transition: 'color 0.15s',
      }}
    >
      {loading ? '...' : children}
    </button>
  )
}
```

---

## 7. Página de videos — grid con header contextual

```typescript
// app/(dashboard)/websites/[site]/[landing]/page.tsx
import { supabaseServer } from '@/lib/supabase'
import { VideoGrid } from '@/components/ugc/VideoGrid'

export default async function LandingPage({
  params: { site, landing }
}: {
  params: { site: string; landing: string }
}) {
  const { data: landingData } = await supabaseServer
    .from('landings')
    .select('*, websites(name, flag)')
    .eq('website_id', site)
    .eq('slug', landing)
    .single()

  const { data: videos } = await supabaseServer
    .from('v_iframe_videos')
    .select('*')
    .eq('website_id', site)
    .eq('landing_slug', landing)

  return (
    <div>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--s5)' }}>
        <a href="/websites" style={{ color: 'inherit', textDecoration: 'none' }}>Websites</a>
        <span>›</span>
        <a href={`/websites/${site}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          {landingData?.websites?.flag} {landingData?.websites?.name}
        </a>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{landingData?.name}</span>
      </nav>

      <PageHeader
        title={landingData?.name ?? landing}
        subtitle={`${videos?.length ?? 0} videos activos en esta landing`}
        action={{ label: '+ Agregar video', landingId: landingData?.id }}
      />

      <VideoGrid
        videos={videos ?? []}
        landingId={landingData?.id ?? ''}
      />
    </div>
  )
}
```

---

## 8. Deploy en el servidor con PM2

```bash
# Build del admin
npm run build

# Arrancar con PM2
pm2 start "npm run start" --name ugc-admin -- --port 3001

# Agregar al tunnel de Cloudflare (config.yml):
# - hostname: ugc-admin.hikvisionlatam.tech
#   service: http://localhost:3001

pm2 save
pm2 startup
```

---

## Checklist de este módulo

- [ ] Variables CSS definidas en `globals.css`
- [ ] Fuente Geist instalada y configurada
- [ ] Sidebar con navegación activa funcionando
- [ ] Grid de websites carga desde Supabase KOC
- [ ] Navegación Website → Landing → Videos funcional
- [ ] `AddVideoModal` con los 4 estados (input, processing, done, error)
- [ ] Mensajes rotativos durante el processing
- [ ] `VideoCard` con toggle activo/pausado optimista
- [ ] Toasts de confirmación en cada acción
- [ ] Deploy en PM2 + tunnel `ugc-admin.hikvisionlatam.tech`

**Siguiente → `05-iframe-embed.md`**
