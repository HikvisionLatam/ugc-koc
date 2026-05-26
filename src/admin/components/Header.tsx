/**
 * components/Header.tsx
 * Barra superior — logo, título, estado de conexión
 */
import { ConnectionStatus } from './ConnectionStatus'
import styles from './Header.module.css'

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        {/* Logo SVG inline */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <rect width="28" height="28" rx="6" fill="#e63946" />
          <path d="M8 9h12M8 14h8M8 19h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className={styles.brandText}>
          <span className={styles.brandName}>UGC Manager</span>
          <span className={styles.brandSub}>Hikvision LATAM</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <a href="/dashboard" className={`${styles.navLink} ${styles.navLinkActive}`}>
          Videos
        </a>
        <a href="/dashboard?tab=add" className={styles.navLink}>
          Agregar
        </a>
        <a href="/dashboard?tab=activity" className={styles.navLink}>
          Actividad
        </a>
      </nav>

      <div className={styles.actions}>
        <ConnectionStatus />
      </div>
    </header>
  )
}