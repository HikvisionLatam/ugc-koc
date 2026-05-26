# 07 — Autenticación y roles

## Objetivo
Configurar Supabase Auth en la instancia KOC, proteger las rutas del admin con middleware de Next.js e implementar el sistema de roles (Admin / Editor / Viewer) con acceso por website.

**Tiempo estimado:** 2–3 horas
**Dependencias:** `01-database.md`, `04-admin-portal.md`
**Último módulo del sistema base**

---

## 1. Roles y permisos

| Acción | Admin | Editor | Viewer |
|--------|:-----:|:------:|:------:|
| Ver todas las websites | ✅ | ❌ solo las asignadas | ❌ solo las asignadas |
| Ver landings y videos | ✅ | ✅ | ✅ |
| Publicar video nuevo | ✅ | ✅ | ❌ |
| Pausar / activar video | ✅ | ✅ | ❌ |
| Editar link de producto | ✅ | ✅ | ❌ |
| Eliminar video | ✅ | ❌ | ❌ |
| Crear nueva landing | ✅ | ❌ | ❌ |
| Gestionar usuarios | ✅ | ❌ | ❌ |
| Ver activity log | ✅ | ✅ solo las suyas | ❌ |

---

## 2. Crear el primer usuario Admin

En Supabase KOC Studio (`koc.hikvisionlatam.tech/project/default`):

**Authentication → Users → Add user:**
```
Email:    admin@hikvision.com
Password: [contraseña segura — mínimo 16 caracteres]
```

Luego en **SQL Editor**, insertar el perfil:

```sql
-- 1. Obtener el UUID del usuario
select id from auth.users where email = 'admin@hikvision.com';

-- 2. Insertar perfil de admin (allowed_websites = null → acceso total)
insert into public.user_profiles (id, full_name, role, allowed_websites)
values (
  'UUID-DEL-USUARIO',
  'Admin UGC',
  'admin',
  null
);
```

---

## 3. Middleware Next.js — protección de rutas

```typescript
// middleware.ts (raíz del proyecto)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    name => request.cookies.get(name)?.value,
        set:    (name, value, opts) => response.cookies.set({ name, value, ...opts }),
        remove: (name, opts)        => response.cookies.set({ name, value: '', ...opts }),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isLogin     = request.nextUrl.pathname === '/login'
  const isProtected = request.nextUrl.pathname.startsWith('/websites') ||
                      request.nextUrl.pathname.startsWith('/users') ||
                      request.nextUrl.pathname.startsWith('/activity')
  const isApi       = request.nextUrl.pathname.startsWith('/api/ugc') &&
                      !request.nextUrl.pathname.includes('/iframe')   // iframe es público

  if (!user && (isProtected || isApi)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isLogin) {
    return NextResponse.redirect(new URL('/websites', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png).*)'],
}
```

---

## 4. Hook `useUser` — rol y permisos en el cliente

```typescript
// hooks/useUser.ts
import { useState, useEffect } from 'react'
import { supabasePublic } from '@/lib/supabase'

interface UserProfile {
  id: string
  full_name: string
  role: 'admin' | 'editor' | 'viewer'
  allowed_websites: string[] | null
}

const PERMISSIONS: Record<string, string[]> = {
  'video.publish':   ['admin', 'editor'],
  'video.pause':     ['admin', 'editor'],
  'video.edit':      ['admin', 'editor'],
  'video.delete':    ['admin'],
  'landing.create':  ['admin'],
  'user.manage':     ['admin'],
  'log.view':        ['admin', 'editor'],
}

export function useUser() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabasePublic.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setProfile(null); setLoading(false); return }

      const { data } = await supabasePublic
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    })
  }, [])

  function can(action: string): boolean {
    if (!profile) return false
    return PERMISSIONS[action]?.includes(profile.role) ?? false
  }

  function canAccessWebsite(siteId: string): boolean {
    if (!profile) return false
    if (profile.role === 'admin') return true
    if (!profile.allowed_websites) return true
    return profile.allowed_websites.includes(siteId)
  }

  return { profile, loading, can, canAccessWebsite }
}
```

**Uso en componentes:**

```typescript
const { can, canAccessWebsite } = useUser()

// Solo admin y editor ven el botón de agregar
{can('video.publish') && (
  <PrimaryButton onClick={() => setShowAdd(true)}>
    + Agregar video
  </PrimaryButton>
)}

// Solo admin puede eliminar
{can('video.delete') && (
  <DangerButton onClick={() => handleDelete(video.id)}>
    Eliminar
  </DangerButton>
)}

// Editor de México no ve Colombia en el grid
{websites.filter(s => canAccessWebsite(s.id)).map(...)}
```

---

## 5. Protección en endpoints de API

```typescript
// lib/auth.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getProfile() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: name => cookieStore.get(name)?.value } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}

export async function requireEditor() {
  const profile = await getProfile()
  if (!profile || !['admin', 'editor'].includes(profile.role)) return null
  return profile
}

export async function requireAdmin() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') return null
  return profile
}
```

```typescript
// Uso en API route — verificar también acceso a la website
export async function POST(req: NextRequest) {
  const user = await requireEditor()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { site } = await req.json()

  // Editor solo puede actuar en sus websites asignadas
  if (
    user.role !== 'admin' &&
    user.allowed_websites &&
    !user.allowed_websites.includes(site)
  ) {
    return NextResponse.json({ error: 'Sin acceso a esta website' }, { status: 403 })
  }

  // ... continuar con la lógica
}
```

---

## 6. Página de login

```typescript
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabasePublic.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas')
      setLoading(false)
    } else {
      router.push('/websites')
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      fontFamily: 'var(--font)',
    }}>
      <div style={{ width: 340 }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, background: 'var(--accent)', borderRadius: 9, margin: '0 auto 14px' }} />
          <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>UGC Manager</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 4 }}>Solo usuarios Hikvision</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div style={{
              padding: '10px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--r-sm)',
              fontSize: 'var(--text-sm)',
              color: '#991b1b',
            }}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Correo
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@hikvision.com"
              required
              autoFocus
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-focus)', borderRadius: 'var(--r-sm)', fontSize: 'var(--text-sm)', background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-focus)', borderRadius: 'var(--r-sm)', fontSize: 'var(--text-sm)', background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              marginTop: 4,
              padding: '10px',
              background: loading ? 'var(--text-tertiary)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'background 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Iniciando sesión...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

---

## 7. Logout

```typescript
// components/ugc/LogoutButton.tsx
'use client'
import { supabasePublic } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await supabasePublic.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        width: '100%',
        padding: '7px 10px',
        background: 'none',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
    >
      Cerrar sesión
    </button>
  )
}
```

---

## 8. Invitar usuarios nuevos (solo Admin)

```typescript
// app/api/ugc/users/invite/route.ts
import { requireAdmin } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Solo admins pueden invitar' }, { status: 403 })

  const { email, role, allowed_websites } = await req.json()

  // Crear usuario en Supabase Auth (envía email automático)
  const { data, error } = await supabaseServer.auth.admin.inviteUserByEmail(email, {
    data: { role }    // metadata para referencia
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Crear perfil con el rol asignado
  await supabaseServer.from('user_profiles').insert({
    id:               data.user.id,
    role,
    allowed_websites: allowed_websites?.length === 4 ? null : allowed_websites ?? null,
  })

  await supabaseServer.from('activity_log').insert({
    user_id:     admin.id,
    action:      'user.invited',
    entity_type: 'user',
    entity_id:   data.user.id,
    metadata:    { email, role },
  })

  return NextResponse.json({ ok: true })
}
```

El usuario recibe un email de Supabase con link para crear su contraseña. No se requiere configuración adicional de email.

---

## Checklist de este módulo

- [ ] Primer usuario Admin creado en Supabase KOC Auth
- [ ] Perfil insertado en `user_profiles` con `role = 'admin'`
- [ ] Middleware de Next.js redirige a `/login` si no hay sesión
- [ ] Página de login funcional y conectada a Supabase KOC
- [ ] Hook `useUser` devuelve rol y permisos correctamente
- [ ] Botones condicionados al rol en las páginas de videos
- [ ] Endpoints de API verifican autenticación y rol
- [ ] Editores solo ven las websites de `allowed_websites`
- [ ] Logout funcional
- [ ] Flujo de invitación probado con un usuario Editor de prueba

---

## Sistema completo — resumen final

```
✅ 01 — Schema Supabase KOC con RLS
✅ 02 — API backend: pipeline assets + endpoints REST
✅ 03 — Nginx kocassets + Cloudflare Tunnel
✅ 04 — Dashboard admin Next.js (Geist + Framer Motion)
✅ 05 — Iframe React con UGCSlider responsivo
✅ 06 — Integración AEM por país y landing
✅ 07 — Auth Supabase + roles Admin/Editor/Viewer
```

**Para agregar un nuevo país:**
1. `INSERT INTO websites` en Supabase KOC
2. `INSERT INTO landings` con el slug correspondiente
3. En AEM: `<iframe src="...?site=nuevo&landing=slug">`
4. En el admin: ya aparece en el grid de websites automáticamente

**Para agregar una nueva landing a un país existente:**
1. `INSERT INTO landings (website_id, slug, name, path)`
2. En AEM: nuevo iframe con el slug
3. En el admin: aparece en la lista de landings de esa website
