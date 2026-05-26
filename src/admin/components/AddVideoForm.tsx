/**
 * components/AddVideoForm.tsx
 * Formulario para agregar un video de TikTok al sistema.
 * scraper → assets → Supabase
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { Website, Landing } from '@/lib/supabase'
import styles from './AddVideoForm.module.css'

type Step = 'form' | 'scraping' | 'done'

export function AddVideoForm() {
  const [step, setStep]               = useState<Step>('form')
  const [websites, setWebsites]       = useState<Website[]>([])
  const [landings, setLandings]       = useState<Landing[]>([])
  const [selectedWebsite, setSelectedWebsite] = useState('')
  const [result, setResult]           = useState<Record<string, string> | null>(null)

  // Form state
  const [tiktokUrl, setTiktokUrl]     = useState('')
  const [landingId, setLandingId]     = useState('')
  const [linkProducto, setLinkProducto] = useState('')

  // Load websites + landings
  useEffect(() => {
    fetch('/api/ugc/websites')
      .then(r => r.json())
      .then(data => {
        setWebsites(Array.isArray(data) ? data : [])
        setLandings(Array.isArray(data) ? data.flatMap((w: Website & { landings: Landing[] }) => w.landings ?? []) : [])
      })
      .catch(() => toast.error('Error cargando websites'))
  }, [])

  const filteredLandings = landings.filter(l => l.website_id === selectedWebsite)

  const handleWebsiteChange = useCallback((websiteId: string) => {
    setSelectedWebsite(websiteId)
    setLandingId('') // reset landing
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tiktokUrl.includes('/video/')) {
      toast.error('URL de TikTok inválida — debe contener /video/')
      return
    }
    if (!landingId) {
      toast.error('Selecciona una landing')
      return
    }

    setStep('scraping')

    try {
      const res  = await fetch('/api/ugc/process-video', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktok_url: tiktokUrl, landing_id: landingId, link_producto: linkProducto || null }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Error desconocido')
        setStep('form')
        return
      }

      setResult(data)
      setStep('done')
      toast.success('Video procesado y publicado')
    } catch {
      toast.error('Error de conexión')
      setStep('form')
    }
  }, [tiktokUrl, landingId, linkProducto])

  function handleReset() {
    setStep('form')
    setTiktokUrl('')
    setLandingId('')
    setLinkProducto('')
    setResult(null)
    setSelectedWebsite('')
  }

  if (step === 'done' && result) {
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <h3>Video publicado</h3>
        <p className={styles.doneSub}>
          {result.status === 'success'
            ? 'Thumbnail y video guardados en kocassets.'
            : 'Thumbnail guardado. El video no pudo descargarse (requiere cookies de TikTok).'}
        </p>

        <div className={styles.resultDetails}>
          <div className={styles.resultRow}>
            <span>ID</span>
            <code>{result.video_id}</code>
          </div>
          <div className={styles.resultRow}>
            <span>TikTok ID</span>
            <code>{result.tiktok_id}</code>
          </div>
          {result.thumbnail_url && (
            <div className={styles.resultRow}>
              <span>Thumbnail</span>
              <a href={result.thumbnail_url} target="_blank" rel="noopener noreferrer">
                Ver →
              </a>
            </div>
          )}
          {result.video_url && (
            <div className={styles.resultRow}>
              <span>Video</span>
              <a href={result.video_url} target="_blank" rel="noopener noreferrer">
                Ver →
              </a>
            </div>
          )}
        </div>

        <div className={styles.doneActions}>
          <button className="btn btn-primary" onClick={handleReset}>
            Publicar otro video
          </button>
          <a
            href={`https://kocassets.hikvisionlatam.tech/ugc/thumbnails/${result.tiktok_id}.webp`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Ver thumbnail en kocassets
          </a>
        </div>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formHeader}>
        <h2>Agregar video de TikTok</h2>
        <p>Pega la URL del video — el sistema extraerá los datos, descargará los archivos y lo publicará en la landing seleccionada.</p>
      </div>

      {/* URL de TikTok */}
      <div className="field">
        <label className="label" htmlFor="tiktok-url">
          URL del video en TikTok
        </label>
        <div className={styles.urlWrapper}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={styles.urlIcon}>
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
          <input
            id="tiktok-url"
            type="url"
            className={`input ${styles.urlInput}`}
            placeholder="https://www.tiktok.com/@hikvisionlatam/video/738275698234..."
            value={tiktokUrl}
            onChange={e => setTiktokUrl(e.target.value)}
            required
            autoFocus
          />
          {tiktokUrl.includes('/video/') && (
            <div className={`status-dot online`} title="URL válida" />
          )}
        </div>
        <p className={styles.fieldHint}>
          El video debe ser público o no funcionar&aacute; el scraper.
        </p>
      </div>

      {/* Website selector */}
      <div className="field">
        <label className="label" htmlFor="website-select">
          Pa&iacute;s / Website
        </label>
        <select
          id="website-select"
          className="select"
          value={selectedWebsite}
          onChange={e => handleWebsiteChange(e.target.value)}
          required
        >
          <option value="">Selecciona un pa&iacute;s…</option>
          {websites.map(w => (
            <option key={w.id} value={w.id}>
              {w.flag} {w.name}
            </option>
          ))}
        </select>
      </div>

      {/* Landing selector */}
      <div className="field">
        <label className="label" htmlFor="landing-select">
          Landing
        </label>
        <select
          id="landing-select"
          className="select"
          value={landingId}
          onChange={e => setLandingId(e.target.value)}
          disabled={!selectedWebsite}
          required
        >
          <option value="">
            {selectedWebsite ? 'Selecciona una landing…' : 'Primero selecciona un pa&iacute;s'}
          </option>
          {filteredLandings.map(l => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.path ?? l.slug})
            </option>
          ))}
        </select>
      </div>

      {/* Link producto */}
      <div className="field">
        <label className="label" htmlFor="link-producto">
          Link del producto (opcional)
        </label>
        <input
          id="link-producto"
          type="url"
          className="input"
          placeholder="https://hikvision.com/co/productos/colorvu"
          value={linkProducto}
          onChange={e => setLinkProducto(e.target.value)}
        />
        <p className={styles.fieldHint}>
          Este enlace se mostrar&aacute; debajo del video en el iframe para que los usuarios compren.
        </p>
      </div>

      {/* Submit */}
      <div className={styles.formFooter}>
        {step === 'scraping' ? (
          <div className={styles.scraping}>
            <div className={styles.scraperSpinner} />
            <div>
              <p className={styles.scraperTitle}>Extrayendo datos de TikTok…</p>
              <p className={styles.scraperSub}>
                Esto puede tomar 10–20 segundos mientras Playwright carga la p&aacute;gina.
              </p>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={!tiktokUrl.includes('/video/') || !landingId}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Procesar y publicar
          </button>
        )}
      </div>
    </form>
  )
}