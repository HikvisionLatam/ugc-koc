/**
 * app/layout.tsx
 * Root layout — system font stack, CSS variables, toasts
 */
import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title:       'UGC Admin — Hikvision LATAM',
  description: 'Gestión de videos TikTok para landings de Hikvision',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-sans)',
              fontSize:   '14px',
            },
          }}
        />
      </body>
    </html>
  )
}