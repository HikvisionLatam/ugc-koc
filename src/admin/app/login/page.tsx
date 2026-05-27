'use client'
/**
 * app/login/page.tsx
 * Login real con Supabase Auth — valida @hikvision.com antes de llamar a la API.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import styles from './page.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email    = (formData.get('email')    as string).trim().toLowerCase()
    const password = formData.get('password') as string

    // Validación de dominio antes de llamar a Supabase
    if (!email.endsWith('@hikvision.com')) {
      setError('Solo se permiten cuentas @hikvision.com')
      return
    }

    setLoading(true)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (authError) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
    } else {
      router.push('/websites')
      router.refresh()
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoMark} aria-hidden="true" />
          <div className={styles.brandText}>
            <span className={styles.brandName}>UGC Manager</span>
            <span className={styles.brandSub}>Hikvision LATAM</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>Iniciar sesión</h1>
            <p className={styles.subtitle}>Acceso exclusivo para el equipo Hikvision</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                Correo corporativo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className={styles.input}
                placeholder="nombre@hikvision.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className={styles.input}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p className={styles.errorMsg} role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={loading}
            >
              {loading ? 'Verificando…' : 'Entrar'}
            </button>
          </form>

          <p className={styles.note}>Sesión segura · Solo usuarios autorizados</p>
        </div>
      </div>
    </div>
  )
}
