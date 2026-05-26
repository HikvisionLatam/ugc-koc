# KOC — Conexión a la Base de Datos

Instancia Supabase self-hosted en `https://koc.hikvisionlatam.tech`.

---

## Dashboard (Supabase Studio)

| Campo | Valor |
|-------|-------|
| URL | https://koc.hikvisionlatam.tech/project/default |
| Usuario | `AdminKOC` |
| Contraseña | `d430facbb5a8f04aba050f6e3e00ad3f` |

---

## Credenciales para el frontend

### Variables de entorno (.env)

```env
NEXT_PUBLIC_SUPABASE_URL_KOC=https://koc.hikvisionlatam.tech
NEXT_PUBLIC_SUPABASE_ANON_KEY_KOC=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5ODEyNjIxLCJleHAiOjE5Mzc0OTI2MjF9.dXnH0Wnss3yUGg90O9OA7QKzRlMXhX8GiTYgFPVEvlc
SUPABASE_SERVICE_ROLE_KEY_KOC=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk4MTI2MjEsImV4cCI6MTkzNzQ5MjYyMX9.AIhivCNYk62klNUA_2ThkbIZyvSk-BvBzvB_RTf5XpE
```

> `ANON_KEY` — para el cliente del navegador (lectura pública con RLS).
> `SERVICE_ROLE_KEY` — solo en el servidor/backend. Nunca exponer en el cliente.

### Cliente Supabase (Next.js / TypeScript)

```typescript
import { createClient } from '@supabase/supabase-js'

// Cliente del servidor (SSR / API routes)
export const supabaseKoc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL_KOC!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_KOC!
)

// Cliente del navegador (componentes client-side)
export const supabaseKocPublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL_KOC!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_KOC!
)
```

---

## Conexión directa a PostgreSQL

| Campo | Valor |
|-------|-------|
| Host | `ssh.hikvisionlatam.tech` (via SSH tunnel) |
| Puerto | `5435` |
| Base de datos | `postgres` |
| Usuario | `postgres` |
| Contraseña | `dc459a0c05ce2ca5c2eb5780c607931c` |

Desde el servidor (via docker exec):

```bash
docker exec koc-db-1 psql -U postgres -d postgres -c "SELECT version();"
```

---

## Archivos en el servidor

| Archivo | Ruta |
|---------|------|
| Configuración Docker | `~/databases/koc/docker/docker-compose.yml` |
| Variables de entorno | `~/databases/koc/docker/.env` |
| Datos PostgreSQL | `~/databases/koc/docker/volumes/db/data/` |
