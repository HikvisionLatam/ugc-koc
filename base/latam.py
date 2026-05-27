import asyncio
import os
import json
import logging
import tempfile
from datetime import datetime
from dotenv import load_dotenv
import boto3
from botocore.config import Config
from playwright.async_api import async_playwright
import requests
from io import BytesIO
from PIL import Image
from botocore.exceptions import ClientError

# ─── CONFIGURACION DEL ENTORNO ────────────────────────────────────────────────
load_dotenv()
ACCOUNT_ID = os.getenv('CF_ACCOUNT_ID')
ACCESS_KEY = os.getenv('CF_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('CF_SECRET_ACCESS_KEY')
BUCKET     = os.getenv('CF_R2_BUCKET')
ENDPOINT   = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"
PUBLIC_R2  = "https://pub-e8ad2ae91ff542308778fb41b3747009.r2.dev"
COOKIE_FILE = 'tiktok_cookies.txt'

# User Agent estandar corporativo
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

# Configuracion de Logs limpia (Sin emojis)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - [%(levelname)s] - %(message)s')

# Validacion de seguridad
if not all([ACCOUNT_ID, ACCESS_KEY, SECRET_KEY, BUCKET]):
    raise ValueError("ERROR FATAL: Faltan credenciales en el archivo .env")

# Cliente S3 (Cloudflare R2)
s3 = boto3.client(
    's3',
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name='auto',
    config=Config(s3={'addressing_style': 'path'})
)

VIDEOS_A_PROCESAR = [
    'https://www.tiktok.com/@hikvisionlatam/video/7603736511044979980',
    'https://www.tiktok.com/@hikvisionlatam/video/7593080434309795128',
    'https://www.tiktok.com/@hikvisionlatam/video/7587067200565939512',
    'https://www.tiktok.com/@hikvisionlatam/video/7579712728177167672',
    'https://www.tiktok.com/@hikvisionlatam/video/7559747263388585227',
    'https://www.tiktok.com/@hikvisionlatam/video/7554552074273361164',
    'https://www.tiktok.com/@hikvisionlatam/video/7547377899897113862',
    'https://www.tiktok.com/@hikvisionlatam/video/7541100685467667718',
    'https://www.tiktok.com/@hikvisionlatam/video/7538966476984716550',
    'https://www.tiktok.com/@hikvisionlatam/video/7533400234228010245',
    'https://www.tiktok.com/@hikvisionlatam/video/7535255662729678086',
    'https://www.tiktok.com/@hikvisionlatam/video/7530802604817829125',
    'https://www.tiktok.com/@hikvisionlatam/video/7526535232103648517',
    'https://www.tiktok.com/@hikvisionlatam/video/7518742393085054214',
    'https://www.tiktok.com/@hikvisionlatam/video/7516918173078228229',
    'https://www.tiktok.com/@hikvisionlatam/video/7498116270617857335',
    'https://www.tiktok.com/@hikvisionlatam/video/7491838741091192119',
    'https://www.tiktok.com/@hikvisionlatam/video/7510300279997320454',
    'https://www.tiktok.com/@hikvisionlatam/video/7502229067761093893',
]

# ─── FUNCIONES DE CARGA A R2 ──────────────────────────────────────────────────

def upload_thumbnail_to_r2(vid_id, raw_url):
    """Descarga la imagen raw y la sube a R2. Retorna la URL publica."""
    if not raw_url: return None
    
    key = f'thumbnails/{vid_id}.webp'
    
    # 1. Verificar si ya existe para ahorrar ancho de banda
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        # logging.info(f"Miniatura existente: {key}") # Comentado para reducir ruido
        return f"{PUBLIC_R2}/{key}"
    except ClientError:
        pass # No existe, proceder

    # 2. Descargar y procesar
    try:
        res = requests.get(raw_url, timeout=10)
        if res.status_code == 200:
            img = Image.open(BytesIO(res.content)).convert('RGB')
            buf = BytesIO()
            # Optimizar a WebP
            img.save(buf, format='WEBP', quality=80)
            buf.seek(0)
            s3.upload_fileobj(buf, BUCKET, key, ExtraArgs={'ContentType': 'image/webp'})
            return f"{PUBLIC_R2}/{key}"
    except Exception as e:
        logging.error(f"Error procesando miniatura para {vid_id}: {e}")
    return None

def download_video_requests(vid_id, download_url, cookies_list):
    """Descarga el video usando requests + cookies de sesion."""
    key = f'videos/{vid_id}.mp4'
    
    # 1. Verificar existencia
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        logging.info(f"Video ya existe en R2: {key}")
        return f"{PUBLIC_R2}/{key}"
    except ClientError:
        pass

    logging.info(f"Iniciando descarga de video ID: {vid_id}")
    
    # 2. Configurar sesion clonada
    session = requests.Session()
    session.headers.update({
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.tiktok.com/',
        'Origin': 'https://www.tiktok.com'
    })
    
    for cookie in cookies_list:
        session.cookies.set(cookie['name'], cookie['value'], domain=cookie['domain'])

    temp_path = os.path.join(tempfile.gettempdir(), f"{vid_id}.mp4")

    # 3. Descarga streaming
    try:
        with session.get(download_url, stream=True, timeout=60) as r:
            if r.status_code == 403:
                logging.error("Error 403 Forbidden: TikTok rechazo las cookies.")
                return None
            r.raise_for_status()
            
            with open(temp_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        
        # 4. Subida a R2
        if os.path.exists(temp_path) and os.path.getsize(temp_path) > 1000:
            size_mb = os.path.getsize(temp_path) / (1024 * 1024)
            logging.info(f"Subiendo a R2 ({size_mb:.2f} MB)...")
            s3.upload_file(temp_path, BUCKET, key, ExtraArgs={'ContentType': 'video/mp4'})
            return f"{PUBLIC_R2}/{key}"
        else:
            logging.error("Archivo descargado invalido (tamano 0 o muy pequeno).")
            return None

    except Exception as e:
        logging.error(f"Fallo en descarga/subida: {e}")
        return None
    finally:
        if os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass

# ─── LOGICA PRINCIPAL DE EXTRACCION ───────────────────────────────────────────

async def process_video_via_json(page, url, context):
    """Navega, extrae JSON oculto, procesa assets y retorna dict limpio."""
    logging.info(f"Procesando URL: {url}")
    try:
        # Navegacion
        await page.goto(url, wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(3) # Espera tecnica

        # Extraccion JSON (Universal Data)
        video_data = await page.evaluate('''() => {
            try {
                const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                if (!script) return null;
                const json = JSON.parse(script.textContent);
                const defaultScope = json.__DEFAULT_SCOPE__ || {};
                const videoDetail = defaultScope['webapp.video-detail'] || {};
                const itemInfo = videoDetail.itemInfo || {};
                return itemInfo.itemStruct || {}; 
            } catch (e) { return null; }
        }''')

        if not video_data:
            logging.error(f"No se detecto JSON de datos para {url}")
            return None

        # Parsing de datos
        vid_id = video_data.get('id')
        if not vid_id: return None
        
        video_obj = video_data.get('video', {})
        stats = video_data.get('stats', {})
        
        # Obtencion de URLs crudas
        raw_download_url = video_obj.get('playAddr') or video_obj.get('downloadAddr')
        raw_thumb_url = video_obj.get('cover')

        # Procesamiento de Assets (Transformacion a R2)
        final_thumb_url = upload_thumbnail_to_r2(vid_id, raw_thumb_url)
        
        final_video_url = None
        if raw_download_url:
            cookies = await context.cookies()
            final_video_url = download_video_requests(vid_id, raw_download_url, cookies)
        else:
            logging.warning("JSON extraido pero sin URL de descarga valida.")

        # Construccion del objeto final
        info = {
            'url': url,
            'description': video_data.get('desc', ''),
            'views': stats.get('playCount', 0),
            'likes': stats.get('diggCount', 0),
            'comments': stats.get('commentCount', 0),
            'shares': stats.get('shareCount', 0),
            'timestamp': datetime.now().isoformat(),
            'thumbnail_url': final_thumb_url, # URL transformada R2
            'video_url': final_video_url,     # URL transformada R2
            'LinkProducto': ""                # Campo vacio solicitado
        }

        return info

    except Exception as e:
        logging.error(f"Excepcion procesando {url}: {e}")
        return None

# ─── PUNTO DE ENTRADA ─────────────────────────────────────────────────────────

async def main():
    results = []
    
    async with async_playwright() as p:
        # Modo Headless activado para produccion
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=USER_AGENT,
            locale="es-LA"
        )
        page = await context.new_page()

        # Calentamiento de sesion
        try:
            logging.info("Iniciando sesion anonima en TikTok...")
            await page.goto("https://www.tiktok.com", timeout=30000)
            await asyncio.sleep(2)
        except: pass

        for url in VIDEOS_A_PROCESAR:
            info = await process_video_via_json(page, url, context)
            if info:
                results.append(info)
                status = "EXITO" if info.get('video_url') else "PARCIAL (Sin video)"
                logging.info(f"Finalizado: {url.split('/')[-1]} - Estado: {status}")
            else:
                logging.error(f"Fallo total: {url}")

        await browser.close()

    # Guardado JSON
    out_file = os.path.join(os.path.dirname(__file__), 'hikvisionlatam_tiktok_videos.json')
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=4, ensure_ascii=False)
    
    logging.info(f"Proceso completado. Archivo generado: {out_file}")

if __name__ == '__main__':
    asyncio.run(main())