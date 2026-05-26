/** @type {import('next').NextConfig} */
const nextConfig = {
  // Habilitar Server Actions para mutations
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'ugc-admin.hikvisionlatam.tech'] },
  },
  // Prefix para assets — útil detrás de un proxy
  assetPrefix: process.env.NODE_ENV === 'production'
    ? 'https://ugc-admin.hikvisionlatam.tech'
    : undefined,
  // Alias @/ → src/admin/ (para que @/lib/supabase resuelva en src/admin/lib/)
  webpack: (config) => {
    config.resolve.alias['@'] = __dirname
    // sharp solo se usa en el servidor — que se resuelva a runtime, no en bundle
    config.externals = [...(config.externals || []), 'sharp']
    return config
  },
}

module.exports = nextConfig