/**
 * lib/scraper.ts
 * Wrapper para el scraper existente latam.py (Playwright).
 *
 * El scraper real vive en scripts/latam.py y se invoca como proceso
 * hijo. Esto mantiene Playwright fuera del bundle de Next.js.
 */
import { spawn } from 'child_process'
import path from 'path'

export interface ScraperResult {
  id:             string
  description:    string
  rawThumbUrl:    string | null
  rawDownloadUrl: string | null
  views:          number
  likes:          number
  comments:       number
  shares:         number
  cookies:        Array<{ name: string; value: string; domain?: string }>
}

export interface ScraperError {
  error:   string
  details?: string
}

/**
 * Extrae datos de un video de TikTok usando el scraper Playwright.
 *
 * @param tiktokUrl — URL completa del video, ej: https://www.tiktok.com/@hikvisionlatam/video/123456789
 * @returns ScraperResult o null si falla
 */
export async function scrapeVideo(tiktokUrl: string): Promise<ScraperResult | null> {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'latam.py')

    const proc = spawn('python', [scriptPath, tiktokUrl], {
      timeout: 60000,
      stdio:   ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        console.error('[SCRAPER] Error:', stderr || `exit code ${code}`)
        resolve(null)
        return
      }

      try {
        const parsed = JSON.parse(stdout.trim()) as ScraperResult
        // El ID del video es la última parte de la URL
        const videoId = tiktokUrl.split('/video/').pop() ?? ''
        resolve({ ...parsed, id: videoId })
      } catch {
        console.error('[SCRAPER] JSON parse error:', stdout)
        resolve(null)
      }
    })

    proc.on('error', (err) => {
      console.error('[SCRAPER] Spawn error:', err)
      resolve(null)
    })

    // Timeout safety
    setTimeout(() => {
      proc.kill('SIGTERM')
      resolve(null)
    }, 60000)
  })
}

/**
 * Versión mock para desarrollo local (sin Playwright).
 * Usa la API pública de TikTok (no requiere cookies).
 */
export async function scrapeVideoMock(tiktokUrl: string): Promise<ScraperResult | null> {
  const videoIdMatch = tiktokUrl.match(/\/video\/(\d+)/)
  if (!videoIdMatch) return null

  const videoId = videoIdMatch[1]

  try {
    // TikTok oEmbed — datos públicos sin auth
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`
    const res       = await fetch(oembedUrl)
    if (!res.ok) return null

    const oembed = await res.json() as { title?: string; thumbnail_url?: string; author_name?: string }

    return {
      id:             videoId,
      description:    oembed.title ?? '',
      rawThumbUrl:    oembed.thumbnail_url ?? null,
      rawDownloadUrl: null, // requiere cookies — no disponible via oembed
      views:          0,
      likes:          0,
      comments:       0,
      shares:         0,
      cookies:        [],
    }
  } catch {
    return null
  }
}

/**
 * Wrapper que intenta el scraper real y cae a mock si falla.
 */
export async function scrapeVideoWithFallback(tiktokUrl: string): Promise<ScraperResult | null> {
  try {
    const result = await scrapeVideo(tiktokUrl)
    if (result) return result
  } catch {
    // fall through
  }

  // Fallback: solo oembed, sin download
  return scrapeVideoMock(tiktokUrl)
}