import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir:       'dist',
    assetsDir:    'assets',
    // Bundle lo más pequeño posible para iframe
    rollupOptions: {
      output: {
        // Un solo archivo para facilitar embedding
        entryFileNames:     'embed.js',
        chunkFileNames:     'embed.js',
        assetFileNames:     'embed.[ext]',
        manualChunks:       undefined,
      },
    },
    // Minificar sin source maps
    minify:  'terser',
    sourcemap: false,
  },
  // El componente no necesita polyfills de Node
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})