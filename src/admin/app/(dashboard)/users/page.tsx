/**
 * Usuarios — solo 2 cuentas de administrador, sin roles ni jerarquía.
 */
import { supabaseAdmin } from '@/lib/supabase'
import type { UserProfile } from '@/lib/supabase'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

async function getUsers(): Promise<UserProfile[]> {
  const { data } = await supabaseAdmin()
    .from('user_profiles')
    .select('*')
    .order('created_at')

  return data ?? []
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.subtitle}>Equipo con acceso al portal de administración</p>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Administradores</span>
        <span className={styles.sectionCount}>{users.length} / 2</span>
      </div>

      {users.length === 0 ? (
        <div className={styles.empty}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          </svg>
          <p>No hay usuarios configurados aún.</p>
        </div>
      ) : (
        <div className={styles.userList}>
          {users.map((user) => (
            <div key={user.id} className={styles.userRow}>
              <div className={`${styles.avatar} ${styles.role_admin}`}>
                {getInitials(user.full_name)}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.full_name ?? 'Sin nombre'}</span>
                <span className={styles.userScope}>@hikvision.com</span>
              </div>
              <span className={`${styles.roleBadge} ${styles.badge_admin}`}>
                Admin
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.permissionsSection}>
        <div className={styles.section} style={{ marginTop: 36 }}>
          <span className={styles.sectionLabel}>Acceso</span>
        </div>
        <p className={styles.accessNote}>
          Ambas cuentas tienen acceso completo — publicar, editar y eliminar videos en todas las landings.
        </p>
      </div>
    </div>
  )
}
