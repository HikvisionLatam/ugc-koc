/**
 * lib/scraper.ts
 * Wrapper sobre el scraper de TikTok (Playwright / Python).
 *
 * En producción, lanza el script Python que hace el scraping real.
 * En desarrollo o si el scraper falla, usa la API oEmbed de TikTok.
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import https from 'https'

const execAsync = promisify(exec)

export interface VideoData {
  id:              string
  description:     string
  rawThumbUrl:     string
  rawDownloadUrl:  string
  views:           number
  likes:           number
  comments:        number
  shares:          number
  author:          string
  cookies:         Array<{ name: string; value: string; domain: string }>
}

/**
 * Obtiene el ID de un TikTok desde la URL.
 */
function extractVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/)
  return match ? match[1] : null
}

/**
 * Scraper real — usa Playwright via Python.
 * Requiere que scripts/latam.py exista y que playwright esté instalado.
 */
async function scrapeWithPlaywright(tiktokUrl: string): Promise<VideoData | null> {
  try {
    const scriptPath = './scripts/latam.py'
    const { stdout } = await execAsync(
      `python3 "${scriptPath}" "${tiktokUrl}"`,
      { timeout: 60000, cwd: process.cwd() },
    )
    return JSON.parse(stdout.trim()) as VideoData
  } catch (err) {
    console.error('[SCRAPER] Playwright failed:', err)
    return null
  }
}

/**
 * Fallback — usa la API oEmbed de TikTok para obtener thumbnail y descripción.
 * No obtiene download_url ni stats precisos.
 */
async function scrapeWithOEmbed(tiktokUrl: string): Promise<VideoData | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`
    const json = await new Promise<{ thumbnail_url?: string; title?: string; author_name?: string }>(
      (resolve, reject) => {
        https.get(oembedUrl, res => {
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => {
            try { resolve(JSON.parse(data)) }
            catch { reject(new Error('oEmbed parse failed')) }
          })
        }).on('error', reject)
      },
    )

    const videoId = extractVideoId(tiktokUrl)
    if (!videoId || !json.thumbnail_url) return null

    return {
      id:             videoId,
      description:    json.title ?? '',
      rawThumbUrl:    json.thumbnail_url,
      rawDownloadUrl: '',   // no disponible via oEmbed
      views:          0,
      likes:          0,
      comments:       0,
      shares:         0,
      author:         json.author_name ?? '',
      cookies:        [],
    }
  } catch {
    return null
  }
}

/**
 * Función principal — intenta Playwright, cae a oEmbed.
 */
export async function scrapeVideo(tiktokUrl: string): Promise<VideoData | null> {
  if (!tiktokUrl.includes('tiktok.com') || !tiktokUrl.includes('/video/')) {
    return null
  }

  // Intentar scraper real primero
  const result = await scrapeWithPlaywright(tiktokUrl)
  if (result?.rawDownloadUrl) return result

  // Fallback a oEmbed
  return scrapeWithOEmbed(tiktokUrl)
}

/**
 * Mock para pruebas sin acceso a TikTok.
 */
export async function scrapeVideoMock(tiktokUrl: string): Promise<VideoData> {
  const videoId = extractVideoId(tiktokUrl) ?? '0000000000'
  return {
    id:             videoId,
    description:    'Video de prueba — TikTok embed sandbox',
    rawThumbUrl:    `https://p19-sign.tiktokcdn.com/obj/tos-useast2-p-0068-tx/${videoId}~tplv-r40-obj.png?X农资电商资源中心&time=1735689600&x-expires=1735693200&x-signature=mock_signature_placeholder`,
    rawDownloadUrl: '',
    views:          Math.floor(Math.random() * 50000),
    likes:          Math.floor(Math.random() * 5000),
    comments:       Math.floor(Math.random() * 500),
    shares:         Math.floor(Math.random() * 200),
    author:         '@hikvisionlatam',
    cookies:        [],
  }
}