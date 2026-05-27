/**
 * lib/supabase.ts
 * Clientes Supabase — lazy init para evitar errores en next build.
 * El cliente solo se crea cuando se usa (request-time), no al cargar el módulo.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singletons — solo se inicializan cuando el primer request las pide
let _admin:  SupabaseClient | null = null
let _public: SupabaseClient | null = null

function getUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL no está definido')
  return url
}

// Solo servidor — usa service_role_key (bypass RLS)
export const supabaseAdmin = (): SupabaseClient => {
  if (!_admin) {
    _admin = createClient(getUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
  }
  return _admin
}

// Cliente del navegador (con RLS activo)
export const supabasePublic = (): SupabaseClient => {
  if (!_public) {
    _public = createClient(getUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: true },
    })
  }
  return _public
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Website {
  id:         string
  name:       string
  url:        string
  flag:       string
  lang:       string
  active:     boolean
  created_at: string
}

export interface Landing {
  id:           string
  website_id:   string
  slug:         string
  name:         string
  path:         string | null
  landing_type: 'product' | 'homepage'
  active:       boolean
  created_at:   string
}

export interface Video {
  id:               string
  tiktok_url:       string
  tiktok_id:        string   // GENERATED column — no insertar manualmente
  creator_id:       string | null
  description:      string | null
  thumbnail_url:    string | null
  video_url:        string | null
  views:            number
  likes:            number
  comments:         number
  shares:           number
  stats_updated_at: string | null
  status:           'active' | 'paused' | 'draft'
  created_at:       string
  created_by:       string | null
}

export interface VideoLanding {
  id:            string
  video_id:      string
  landing_id:    string
  link_producto: string | null
  active:        boolean
  position:      number
  created_at:    string
}

export interface Creator {
  id:               string
  tiktok_username:  string
  display_name:     string | null
  country_code:     string
  country_name:     string
  created_at:       string
}

export interface IframeVideo {
  id:                   string
  tiktok_url:           string
  tiktok_id:            string
  description:          string | null
  thumbnail_url:        string | null
  video_url:            string | null
  views:                number
  likes:                number
  shares:               number
  link_producto:        string | null
  position:             number
  landing_slug:         string
  landing_name:         string
  landing_type:         'product' | 'homepage'
  website_id:           string
  lang:                 string
  creator_username:     string | null
  creator_name:         string | null
  creator_country:      string | null
  creator_country_name: string | null
}

export interface UserProfile {
  id:         string
  full_name:  string | null
  created_at: string
}

export interface ActivityLog {
  id:          string
  user_id:     string | null
  action:      string
  entity_type: string | null
  entity_id:   string | null
  metadata:    Record<string, unknown> | null
  created_at:  string
}
