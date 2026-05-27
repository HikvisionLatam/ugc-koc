/**
 * src/types.ts
 * Tipos del iframe — coinciden con la vista v_iframe_videos de Supabase
 */
export interface Video {
  id:                   string
  tiktok_url:           string
  tiktok_id:            string
  description:          string | null
  thumbnail_url:        string | null
  video_url:            string | null
  views:                number
  likes:                number
  comments:             number
  shares:               number
  link_producto:        string | null
  position:             number
  landing_slug:         string
  landing_name:         string
  landing_type:         string   // 'product' | 'homepage'
  website_id:           string
  lang:                 string   // 'es' | 'pt' | 'en'
  creator_username:     string | null
  creator_name:         string | null
  creator_country:      string | null
  creator_country_name: string | null
}
