/**
 * lib/supabase.ts
 * Clientes Supabase — servidor y navegador
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Solo servidor — nunca exponer en el cliente
export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

// Cliente del navegador (con RLS activo)
export const supabasePublic = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: true },
})

// Tipos TypeScript derivados del schema
export interface Website {
  id:       string
  name:     string
  url:      string
  flag:     string
  lang:     string
  active:   boolean
  created_at: string
}

export interface Landing {
  id:         string
  website_id: string
  slug:       string
  name:       string
  path:       string | null
  active:     boolean
  created_at: string
}

export interface Video {
  id:              string
  tiktok_url:      string
  tiktok_id:       string
  description:     string | null
  thumbnail_url:   string | null
  video_url:       string | null
  views:           number
  likes:           number
  comments:        number
  shares:          number
  stats_updated_at: string | null
  status:          'active' | 'paused' | 'deleted'
  created_at:      string
  created_by:      string | null
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

export interface IframeVideo {
  id:            string
  tiktok_url:    string
  tiktok_id:     string
  description:   string | null
  thumbnail_url: string | null
  video_url:     string | null
  views:         number
  likes:         number
  comments:      number
  shares:        number
  link_producto: string | null
  position:      number
  landing_slug:  string
  landing_name:  string
  website_id:    string
  lang:          string
}

export interface UserProfile {
  id:              string
  full_name:       string | null
  role:            'admin' | 'editor' | 'viewer'
  allowed_websites: string[] | null
  created_at:      string
}

export interface ActivityLog {
  id:         string
  user_id:    string | null
  action:     string
  entity_type: string | null
  entity_id:  string | null
  metadata:   Record<string, unknown> | null
  created_at: string
}