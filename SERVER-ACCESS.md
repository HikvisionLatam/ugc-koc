# Acceso al Servidor — hikvisionlatam.tech

## Infraestructura

El servidor está protegido por **Cloudflare Access** (Zero Trust). El acceso SSH pasa por un proxy de Cloudflare usando `cloudflared`.

- **Hostname SSH**: `ssh.hikvisionlatam.tech`
- **Usuario**: `marketing-digital`
- **Clave privada**: `~/.ssh/claude_ed25519` (ya autorizada en el servidor)
- **Proxy**: `/c/cloudflare/cloudflared` (binario de cloudflared en Windows)

---

## Conectarse por SSH

```bash
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech
```

Para ejecutar un comando remoto directamente (sin abrir sesión interactiva):

```bash
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech "comando aqui"
```

---

## Consultar bases de datos (PostgreSQL via Docker)

Las bases de datos corren en contenedores Docker. Se acceden con `docker exec`:

```bash
# Hikvision Partner Pro DB
docker exec supabase-db psql -U postgres -d postgres -c "SELECT ..."

# BD2 — App legacy Colombia
docker exec partner-cup-db-1 psql -U postgres -d postgres -c "SELECT ..."

# BD3 — App nueva LATAM
docker exec partner-cup-la-db-1 psql -U postgres -d postgres -c "SELECT ..."
```

Ejemplo completo (desde la máquina local, un solo comando):

```bash
ssh -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  marketing-digital@ssh.hikvisionlatam.tech \
  "docker exec supabase-db psql -U postgres -d postgres -c 'SELECT count(*) FROM matches;'"
```

---

## Gestionar procesos con PM2

Los jobs de Node.js corren con PM2:

```bash
# Ver estado de todos los procesos
pm2 list

# Ver logs en tiempo real
pm2 logs hik-jobs --lines 100

# Reiniciar después de cambios
pm2 restart hik-jobs

# Arrancar si no está corriendo
pm2 start "npx tsx --env-file=.env.local src/jobs/index.ts" --name hik-jobs
```

---

## Subir archivos al servidor (SCP via Cloudflare)

```bash
scp -i ~/.ssh/claude_ed25519 \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech" \
  archivo-local.txt \
  marketing-digital@ssh.hikvisionlatam.tech:/ruta/destino/
```

---

## Notas importantes

- El MCP de Supabase **no puede acceder** a estas bases de datos (son self-hosted, no en Supabase Cloud).
- La clave privada `~/.ssh/claude_ed25519` ya está generada y autorizada — no regenerar.
- `cloudflared` debe estar en `/c/cloudflare/cloudflared` en Windows (ruta usada en el ProxyCommand).
- En Linux/Mac el ProxyCommand sería `cloudflared access ssh --hostname ssh.hikvisionlatam.tech` (sin ruta absoluta si está en PATH).
