'use client'
/**
 * AddVideoModal — modal multi-paso para agregar un video de TikTok.
 *
 * Estados:
 *   'url'     → pegar URL + link_producto opcional
 *   'creator' → creador nuevo detectado, el admin elige el país
 *   'loading' → procesando (scraping + assets + DB)
 *   'done'    → éxito
 *   'error'   → error terminal
 */
import { useState } from 'react'
import { toast } from 'sonner'
import styles from './AddVideoModal.module.css'

// Países LATAM que maneja Hikvision
const LATAM_COUNTRIES = [
  { code: 'co', name: 'Colombia' },
  { code: 'mx', name: 'México' },
  { code: 'br', name: 'Brasil' },
  { code: 'ar', name: 'Argentina' },
  { code: 'pe', name: 'Perú' },
  { code: 'cl', name: 'Chile' },
  { code: 'ec', name: 'Ecuador' },
  { code: 'bo', name: 'Bolivia' },
  { code: 'py', name: 'Paraguay' },
  { code: 'uy', name: 'Uruguay' },
  { code: 've', name: 'Venezuela' },
  { code: 'pa', name: 'Panamá' },
  { code: 'cr', name: 'Costa Rica' },
  { code: 'gt', name: 'Guatemala' },
  { code: 'hn', name: 'Honduras' },
  { code: 'sv', name: 'El Salvador' },
  { code: 'ni', name: 'Nicaragua' },
  { code: 'do', name: 'República Dominicana' },
  { code: 'cu', name: 'Cuba' },
  { code: 'latam', name: 'LATAM General' },
]

type Step = 'url' | 'creator' | 'loading' | 'done'

interface Props {
  landingId:   string
  landingName: string
  onClose:     () => void
  onSuccess:   () => void
}

export function AddVideoModal({ landingId, landingName, onClose, onSuccess }: Props) {
  const [step, setStep]               = useState<Step>('url')
  const [url, setUrl]                 = useState('')
  const [linkProducto, setLinkProducto] = useState('')
  const [error, setError]             = useState('')

  // Datos del creador nuevo (rellenados en step 'creator')
  const [newAuthor, setNewAuthor]     = useState('')
  const [countryCode, setCountryCode] = useState('')

  async function submitVideo(opts?: { country_code: string; country_name: string }) {
    setError('')
    setStep('loading')

    try {
      const payload: Record<string, unknown> = {
        tiktok_url:    url.trim(),
        landing_id:    landingId,
        link_producto: linkProducto.trim() || null,
      }

      if (opts) {
        payload.country_code = opts.country_code
        payload.country_name = opts.country_name
      }

      const res  = await fetch('/api/ugc/process-video', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      const data = await res.json()

      // 422 → nuevo creador, falta el país
      if (res.status === 422 && data.needs_creator) {
        setNewAuthor(data.author ?? '')
        setStep('creator')
        return
      }

      if (res.status === 409) {
        setError('Este video ya existe en el sistema.')
        setStep('url')
        return
      }

      if (!res.ok) {
        setError(data.error ?? 'Error al procesar el video.')
        setStep('url')
        return
      }

      setStep('done')
      toast.success('Video publicado correctamente')
      onSuccess()
    } catch {
      setError('Error de red. Intenta de nuevo.')
      setStep('url')
    }
  }

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || !url.includes('/video/')) {
      setError('Pega una URL válida de TikTok (debe incluir /video/)')
      return
    }
    void submitVideo()
  }

  function handleCreatorSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!countryCode) {
      setError('Selecciona el país del creador')
      return
    }
    const country = LATAM_COUNTRIES.find((c) => c.code === countryCode)!
    void submitVideo({ country_code: countryCode, country_name: country.name })
  }

  const isLoading = step === 'loading'

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Agregar video">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>
              {step === 'creator' ? 'Nuevo creador detectado' : 'Agregar video de TikTok'}
            </h2>
            <p className={styles.modalSubtitle}>Landing: {landingName}</p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            disabled={isLoading}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── Step: URL ───────────────────────────────────────────────────────── */}
        {(step === 'url' || step === 'loading') && (
          <form onSubmit={handleUrlSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="tiktok-url">URL del video</label>
              <input
                id="tiktok-url"
                className={styles.input}
                type="url"
                placeholder="https://www.tiktok.com/@usuario/video/123456789"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="link-producto">
                Link de producto
                <span className={styles.optional}>(opcional)</span>
              </label>
              <input
                id="link-producto"
                className={styles.input}
                type="text"
                placeholder="/colorvu"
                value={linkProducto}
                onChange={(e) => setLinkProducto(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && !isLoading && (
              <div className={styles.errorBanner} role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                {error}
              </div>
            )}

            {isLoading && (
              <div className={styles.processingBanner}>
                <svg className={styles.spinner} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Extrayendo datos del video de TikTok…
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={`btn btn-secondary ${styles.cancelBtn}`}
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`btn btn-primary ${styles.submitBtn}`}
                disabled={isLoading || !url.trim()}
              >
                {isLoading ? 'Procesando…' : 'Procesar y publicar'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step: Creator ────────────────────────────────────────────────────── */}
        {step === 'creator' && (
          <form onSubmit={handleCreatorSubmit} className={styles.form}>
            <div className={styles.creatorAlert}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>
                El creador <strong>@{newAuthor}</strong> no está en el sistema.
                Indica su país para registrarlo.
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="country-select">País del creador</label>
              <select
                id="country-select"
                className={styles.input}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
                autoFocus
              >
                <option value="">Selecciona un país…</option>
                {LATAM_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className={styles.errorBanner} role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                {error}
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={`btn btn-secondary ${styles.cancelBtn}`}
                onClick={() => { setStep('url'); setError('') }}
              >
                Atrás
              </button>
              <button
                type="submit"
                className={`btn btn-primary ${styles.submitBtn}`}
                disabled={!countryCode}
              >
                Guardar creador y publicar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
