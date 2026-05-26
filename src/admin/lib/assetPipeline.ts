/**
 * lib/assetPipeline.ts
 * Pipeline de assets — descarga thumbnails y videos, los guarda
 * directamente en el filesystem del servidor.
 *
 * Funciona cuando corre en el servidor (PM2), no en el navegador.
 * En desarrollo local, simplemente retorna las URLs sin descargar.
 */
import { pipeline } from 'stream/promises'
import fs from 'fs'
import path from 'path'
import { mkdir } from 'fs/promises'

const ASSETS_LOCAL  = process.env.UGC_ASSETS_LOCAL_PATH  ?? '/var/www/kocassets/ugc'
const ASSETS_PUBLIC = process.env.UGC_ASSETS_PUBLIC_URL ?? 'https://kocassets.hikvisionlatam.tech/ugc'

const THUMBS_DIR = path.join(ASSETS_LOCAL, 'thumbnails')
const VIDEOS_DIR = path.join(ASSETS_LOCAL, 'videos')

/**
 * Asegura que el directorio existe (crea recursively si no).
 */
async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch {
    // ya existe — OK
  }
}

// ── sharp helper — opcional, no se importa sino hasta que se necesita ──
async function toWebP(buffer: Buffer): Promise<Buffer> {
  // use createRequire para que webpack no resuelva sharp al parsear este archivo
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('sharp')
  const sharp = mod.default ?? mod
  return sharp(buffer).webp({ quality: 80 }).toBuffer()
}

/**
 * Descarga el thumbnail de TikTok, lo convierte a WebP optimizado
 * y lo guarda en disco. Retorna la URL pública o null si falla.
 *
 * Idempotente: si el archivo ya existe, retorna la URL sin
 * reprocesar (ahorra ancho de banda y tiempo).
 */
export async function saveThumbnail(
  videoId: string,
  rawUrl: string | null | undefined,
): Promise<string | null> {
  if (!rawUrl) return null

  const destPath  = path.join(THUMBS_DIR, `${videoId}.webp`)
  const publicUrl = `${ASSETS_PUBLIC}/thumbnails/${videoId}.webp`

  // Idempotencia — ya existe
  if (fs.existsSync(destPath)) return publicUrl

  try {
    // En desarrollo local no tenemos fetch a internet o el path no existe
    // Simplemente retornar la URL original de TikTok
    if (!fs.existsSync(ASSETS_LOCAL)) {
      console.warn(`[ASSET] ASSETS_LOCAL no existe (${ASSETS_LOCAL}) — usando URL original de TikTok`)
      return rawUrl
    }

    await ensureDir(THUMBS_DIR)

    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const arrayBuffer = await res.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    // Convertir a WebP con sharp (opcional — si no está instalado, guardar como JPEG)
    let outputBuffer: Buffer = buffer
    try {
      outputBuffer = await toWebP(buffer)
    } catch {
      // sharp no disponible — guardar como JPEG original
      outputBuffer = buffer
    }

    const ext = outputBuffer === buffer ? '.jpg' : '.webp'
    const finalPath = destPath.replace('.webp', ext)
    fs.writeFileSync(finalPath, outputBuffer)

    return `${ASSETS_PUBLIC}/thumbnails/${videoId}${ext}`
  } catch (err) {
    console.error(`[ASSET] thumbnail ${videoId}:`, err)
    return null
  }
}

/**
 * Descarga el video de TikTok y lo guarda en disco.
 * Requiere cookies de sesión para evitar 403.
 *
 * Idempotente: si el archivo ya existe, no lo baja de nuevo.
 */
export async function saveVideo(
  videoId:    string,
  downloadUrl: string | null | undefined,
  cookies:     Array<{ name: string; value: string; domain?: string }> = [],
): Promise<string | null> {
  if (!downloadUrl) return null

  const destPath  = path.join(VIDEOS_DIR, `${videoId}.mp4`)
  const publicUrl = `${ASSETS_PUBLIC}/videos/${videoId}.mp4`

  // Idempotencia
  if (fs.existsSync(destPath)) return publicUrl

  if (!fs.existsSync(ASSETS_LOCAL)) {
    console.warn(`[ASSET] ASSETS_LOCAL no existe — video no guardado locally`)
    return null
  }

  try {
    await ensureDir(VIDEOS_DIR)

    // Construir headers con cookies
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer':    'https://www.tiktok.com/',
      'Origin':     'https://www.tiktok.com',
    }

    if (cookies.length > 0) {
      headers['Cookie'] = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    }

    const res = await fetch(downloadUrl, {
      headers,
      signal: AbortSignal.timeout(120000),
    })

    if (res.status === 403) {
      console.error(`[ASSET] 403 Forbidden — TikTok rechazó las cookies para ${videoId}`)
      return null
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    // Stream a archivo — para videos grandes
    const stream = res.body
    if (!stream) throw new Error('No body')

    const writeStream = fs.createWriteStream(destPath)
    // pipeline accepts ReadableStream (web) + Writable (node) en Node 18+
    await pipeline(stream as unknown as import('stream').Readable, writeStream)

    // Validar tamaño mínimo (evitar archivos corruptos/vacíos)
    const stats = fs.statSync(destPath)
    if (stats.size < 1000) {
      console.error(`[ASSET] Video inválido (${stats.size}B) para ${videoId}`)
      fs.unlinkSync(destPath)
      return null
    }

    return publicUrl
  } catch (err) {
    console.error(`[ASSET] video ${videoId}:`, err)
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
    return null
  }
}

/**
 * Elimina los archivos físicos cuando se borra un video.
 */
export function deleteAssets(videoId: string): void {
  for (const file of [
    path.join(THUMBS_DIR, `${videoId}.webp`),
    path.join(THUMBS_DIR, `${videoId}.jpg`),
    path.join(VIDEOS_DIR, `${videoId}.mp4`),
  ]) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      console.log(`[ASSET] Eliminado: ${file}`)
    }
  }
}

/**
 * Verifica que el directorio de assets está accesible (para diagnóstico).
 */
export function checkAssetsHealth(): { ok: boolean; localPath: string; exists: boolean } {
  return {
    ok:        fs.existsSync(ASSETS_LOCAL),
    localPath: ASSETS_LOCAL,
    exists:    fs.existsSync(ASSETS_LOCAL),
  }
}