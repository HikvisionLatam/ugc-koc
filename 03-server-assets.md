# 03 — Servidor de assets (kocassets.hikvisionlatam.tech)

## Objetivo
Configurar Nginx en el servidor para servir videos y thumbnails públicamente bajo el subdominio `kocassets.hikvisionlatam.tech`, con Cloudflare Tunnel haciendo de CDN gratuito encima.

**Tiempo estimado:** 45 minutos
**Dependencias:** Acceso SSH al servidor (`SERVER-ACCESS.md`)
**Siguiente módulo:** `02-backend-api.md`

---

## Concepto

```
/var/www/kocassets/          ← raíz del servidor de assets
└── ugc/                     ← proyecto UGC (otros proyectos KOC irán aquí también)
    ├── thumbnails/           → kocassets.hikvisionlatam.tech/ugc/thumbnails/
    └── videos/              → kocassets.hikvisionlatam.tech/ugc/videos/

Nginx (puerto 8089)
  → Cloudflare Tunnel
    → kocassets.hikvisionlatam.tech
      → CDN Cloudflare encima automáticamente
```

---

## 1. Crear estructura de carpetas

```bash
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech << 'EOF'

# Crear estructura kocassets
sudo mkdir -p /var/www/kocassets/ugc/thumbnails
sudo mkdir -p /var/www/kocassets/ugc/videos

# Dar permisos al usuario marketing-digital
sudo chown -R marketing-digital:marketing-digital /var/www/kocassets

# Verificar
ls -la /var/www/kocassets/ugc/

EOF
```

---

## 2. Configurar Nginx

```bash
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech << 'EOF'

sudo tee /etc/nginx/sites-available/kocassets > /dev/null << 'NGINX'
server {
    listen 8089;
    server_name localhost;

    root /var/www/kocassets;
    autoindex off;

    # Tipos de archivo permitidos
    location ~* \.(mp4|webp|jpg|jpeg|png|gif|svg|ico|woff2)$ {

        # CORS — necesario para el iframe cargado desde AEM
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;

        # Caché del navegador: 30 días
        add_header Cache-Control "public, max-age=2592000, immutable";

        # Seguridad básica
        add_header X-Content-Type-Options "nosniff";

        try_files $uri =404;
    }

    # Bloquear todo lo que no sea un asset válido
    location / {
        return 404;
    }

    # Optimización para videos grandes
    location ~* \.mp4$ {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=2592000, immutable";
        mp4;
        mp4_buffer_size     1m;
        mp4_max_buffer_size 5m;
        try_files $uri =404;
    }
}
NGINX

# Activar el sitio
sudo ln -sf /etc/nginx/sites-available/kocassets /etc/nginx/sites-enabled/kocassets

# Verificar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx

echo "Nginx configurado OK"

EOF
```

> **Nota:** El módulo `mp4` de Nginx debe estar instalado. Si `nginx -t` falla por el bloque `mp4`, eliminar las líneas `mp4;`, `mp4_buffer_size` y `mp4_max_buffer_size` — el video igualmente funcionará, solo sin seek optimizado.

---

## 3. Agregar kocassets al Cloudflare Tunnel

El tunnel ya está corriendo en el servidor. Solo hay que agregar la nueva entrada.

```bash
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech << 'EOF'

# Ver la config actual del tunnel
cat ~/.cloudflared/config.yml

EOF
```

Editar `~/.cloudflared/config.yml` y agregar la entrada para kocassets **antes** del catch-all `http_status:404`:

```yaml
# ~/.cloudflared/config.yml
tunnel: TU-TUNNEL-UUID
credentials-file: /home/marketing-digital/.cloudflared/TU-TUNNEL-UUID.json

ingress:
  # --- entrada nueva ---
  - hostname: kocassets.hikvisionlatam.tech
    service: http://localhost:8089
  # --- entradas existentes (no tocar) ---
  - hostname: koc.hikvisionlatam.tech
    service: http://localhost:PUERTO_KOC
  # ... otras entradas ...
  - service: http_status:404
```

```bash
# Reiniciar el tunnel para aplicar cambios
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech \
  "sudo systemctl restart cloudflared && sudo systemctl status cloudflared --no-pager"
```

---

## 4. Registrar el DNS en Cloudflare

En el **dashboard de Cloudflare** → tu dominio `hikvisionlatam.tech` → DNS:

| Tipo | Nombre | Contenido | Proxy |
|------|--------|-----------|-------|
| CNAME | `kocassets` | `TU-TUNNEL-UUID.cfargotunnel.com` | ✅ Proxied |

Con el proxy activo, Cloudflare actúa como CDN automáticamente — cachea los assets en sus edge nodes globalmente sin configuración adicional.

---

## 5. Subir un asset de prueba y verificar

```bash
# Crear un thumbnail de prueba en el servidor
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech \
  "echo 'test' > /var/www/kocassets/ugc/thumbnails/test.txt"

# Verificar que es accesible públicamente
curl -I https://kocassets.hikvisionlatam.tech/ugc/thumbnails/test.txt
# Esperado: HTTP/2 404 (el .txt no está permitido en Nginx — correcto)

# Subir una imagen real de prueba via SCP
scp -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  cualquier-imagen.jpg \
  marketing-digital@ssh.hikvisionlatam.tech:/var/www/kocassets/ugc/thumbnails/test.jpg

# Verificar acceso público
curl -I https://kocassets.hikvisionlatam.tech/ugc/thumbnails/test.jpg
# Esperado: HTTP/2 200 con headers Access-Control-Allow-Origin: *
```

---

## 6. Migrar los 19 videos existentes

Ya tienes `hikvisionlatam_tiktok_videos.json` con los 19 videos procesados. Sus assets ya están en Cloudflare R2 con URLs `pub-xxxx.r2.dev`. El script de migración hace dos cosas: descarga los assets de R2 y los sube al servidor propio.

```python
# scripts/migrate_assets_to_server.py
import json
import requests
import subprocess
import os
import tempfile
from PIL import Image
from io import BytesIO

# Configuración
SERVER_USER = "marketing-digital"
SERVER_HOST = "ssh.hikvisionlatam.tech"
SSH_KEY     = os.path.expanduser("~/.ssh/claude_ed25519")
PROXY_CMD   = "/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech"
REMOTE_BASE = "/var/www/kocassets/ugc"
PUBLIC_BASE = "https://kocassets.hikvisionlatam.tech/ugc"

def scp_upload(local_path: str, remote_path: str) -> bool:
    result = subprocess.run([
        "scp",
        "-i", SSH_KEY,
        "-o", "StrictHostKeyChecking=no",
        "-o", f"ProxyCommand={PROXY_CMD}",
        local_path,
        f"{SERVER_USER}@{SERVER_HOST}:{remote_path}"
    ], capture_output=True)
    return result.returncode == 0

def migrate_thumbnail(video_id: str, r2_url: str) -> str | None:
    if not r2_url:
        return None
    try:
        res = requests.get(r2_url, timeout=15)
        res.raise_for_status()
        img = Image.open(BytesIO(res.content)).convert("RGB")
        with tempfile.NamedTemporaryFile(suffix=".webp", delete=False) as tmp:
            img.save(tmp.name, format="WEBP", quality=80)
            remote_path = f"{REMOTE_BASE}/thumbnails/{video_id}.webp"
            success = scp_upload(tmp.name, remote_path)
            os.unlink(tmp.name)
        if success:
            return f"{PUBLIC_BASE}/thumbnails/{video_id}.webp"
    except Exception as e:
        print(f"  [ERROR] thumb {video_id}: {e}")
    return None

def migrate_video(video_id: str, r2_url: str) -> str | None:
    if not r2_url:
        return None
    try:
        with requests.get(r2_url, stream=True, timeout=60) as r:
            r.raise_for_status()
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                for chunk in r.iter_content(8192):
                    tmp.write(chunk)
                tmp_path = tmp.name
        remote_path = f"{REMOTE_BASE}/videos/{video_id}.mp4"
        success = scp_upload(tmp_path, remote_path)
        os.unlink(tmp_path)
        if success:
            return f"{PUBLIC_BASE}/videos/{video_id}.webp"
    except Exception as e:
        print(f"  [ERROR] video {video_id}: {e}")
    return None

# Ejecutar migración
with open("hikvisionlatam_tiktok_videos.json") as f:
    videos = json.load(f)

results = []
for i, v in enumerate(videos, 1):
    video_id = v["url"].split("/video/")[-1]
    print(f"[{i}/{len(videos)}] Migrando {video_id}...")

    new_thumb = migrate_thumbnail(video_id, v.get("thumbnail_url"))
    new_video = migrate_video(video_id, v.get("video_url"))

    results.append({**v, "thumbnail_url": new_thumb, "video_url": new_video})
    print(f"  thumb: {'OK' if new_thumb else 'FAIL'} | video: {'OK' if new_video else 'FAIL'}")

# Guardar JSON actualizado con nuevas URLs
with open("hikvisionlatam_tiktok_videos_kocassets.json", "w") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("\nMigración completa. Usar hikvisionlatam_tiktok_videos_kocassets.json para seed de Supabase.")
```

---

## 7. Estructura final verificada

Después de completar este módulo, el servidor debe tener:

```
/var/www/kocassets/
└── ugc/
    ├── thumbnails/
    │   ├── 7603736511044979980.webp   ← accesible en kocassets.hikvisionlatam.tech/ugc/thumbnails/...
    │   └── ...
    └── videos/
        ├── 7603736511044979980.mp4    ← accesible en kocassets.hikvisionlatam.tech/ugc/videos/...
        └── ...
```

---

## Checklist de este módulo

- [ ] Carpetas `/var/www/kocassets/ugc/{thumbnails,videos}` creadas con permisos correctos
- [ ] Nginx configurado en puerto 8089 y activo
- [ ] `nginx -t` pasa sin errores
- [ ] Entrada `kocassets.hikvisionlatam.tech` agregada al config del tunnel
- [ ] `cloudflared` reiniciado y corriendo
- [ ] Registro DNS CNAME `kocassets` creado en Cloudflare con proxy activo
- [ ] Test de acceso público OK: `curl -I https://kocassets.hikvisionlatam.tech/ugc/thumbnails/test.jpg`
- [ ] Headers CORS presentes en la respuesta (`Access-Control-Allow-Origin: *`)
- [ ] Script de migración ejecutado — assets de los 19 videos en el servidor

**Siguiente → `02-backend-api.md`**
