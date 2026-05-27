/**
 * app/page.tsx
 * Redirect a /dashboard
 */
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/websites')
}