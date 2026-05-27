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

  const dotColor =
    status === 'online'   ? 'var(--success)' :
    status === 'error'    ? 'var(--error)'   :
    'var(--warning)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width:        7,
        height:       7,
        borderRadius: '50%',
        background:   dotColor,
        flexShrink:   0,
        display:      'block',
      }} />
      <span style={{
        fontSize:   12,
        fontWeight: 500,
        color:      'var(--text-muted)',
      }}>
        {label}
      </span>
    </div>
  )
}
