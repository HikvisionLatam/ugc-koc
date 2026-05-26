/**
 * components/ConnectionStatus.tsx
 * Indicador visual de conexión a Supabase KOC
 */
'use client'

import { useEffect, useState } from 'react'

export function ConnectionStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'error'>('checking')

  useEffect(() => {
    let cancelled = false
    fetch('/api/ugc/websites')
      .then(r => r.ok ? 'online' : 'error')
      .catch(() => 'error' as const)
      .then((s: 'online' | 'error') => { if (!cancelled) setStatus(s) })
    return () => { cancelled = true }
  }, [])

  const label = status === 'checking' ? 'Conectando…' : status === 'online' ? 'KOC Online' : 'Sin conexión'
  const dotClass = status === 'checking' ? styles.dotWarning : status === 'online' ? styles.dotOnline : styles.dotError

  return (
    <div className={styles.wrapper}>
      <span className={`${styles.dot} ${dotClass}`} />
      <span className={styles.label}>{label}</span>
    </div>
  )
}

const styles = {
  wrapper: 'display: flex; align-items: center; gap: 6px;',
  dot:     'width: 8px; height: 8px; border-radius: 9999px; flex-shrink: 0;',
  dotOnline:  'background: var(--success); box-shadow: 0 0 6px var(--success);',
  dotWarning: 'background: var(--warning);',
  dotError:   'background: var(--error);',
  label:      'font-size: 12px; font-weight: 500; color: var(--text-muted);',
} as Record<string, string>