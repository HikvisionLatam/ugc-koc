import { useEffect, useState } from 'react'
import { SliderClassic } from './components/SliderClassic'
import { SliderPremium } from './components/SliderPremium'
import type { Video } from './types'

interface AppProps {
  site:    string
  landing: string
  apiUrl:  string
  style:   'classic' | 'premium'
}

export function App({ site, landing, apiUrl, style }: AppProps) {
  const [videos, setVideos]   = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!site || !landing) {
      setError('Faltan parámetros: site y landing')
      setLoading(false)
      return
    }

    const url = `${apiUrl}?site=${encodeURIComponent(site)}&landing=${encodeURIComponent(landing)}`

    fetch(url, { headers: { Accept: 'application/json' } })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: Video[]) => {
        setVideos(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message ?? 'Error cargando videos')
        setLoading(false)
      })
  }, [site, landing, apiUrl])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState message={error} />
  if (videos.length === 0) return <EmptyState site={site} landing={landing} />

  return (
    <div className="ugc-root">
      {style === 'premium'
        ? <SliderPremium videos={videos} />
        : <SliderClassic videos={videos} />
      }
    </div>
  )
}

// ── Loading skeleton ────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="ugc-loading">
      <div className="ugc-loading-dot" />
      <div className="ugc-loading-dot" />
      <div className="ugc-loading-dot" />
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="ugc-error">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>No se pudieron cargar los videos</span>
      <small>{message}</small>
    </div>
  )
}

function EmptyState({ site, landing }: { site: string; landing: string }) {
  return (
    <div className="ugc-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="20" height="20" rx="4" />
        <path d="M10 8l6 4-6 4V8z" />
      </svg>
      <p>No hay videos para {landing} en {site}</p>
      <small>El equipo de marketing agregará contenido pronto.</small>
    </div>
  )
}
