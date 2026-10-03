import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'fonts/KanzAlMarjaan.ttf'],
      manifest: {
        name: 'LSD Exam Paper Generator',
        short_name: 'Exam Papers',
        description: 'Create beautiful Lisan ud Dawat exam papers on your phone and print them as A4 PDFs.',
        theme_color: '#4338ca',
        background_color: '#f3f4f6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the whole app (including the Arabic font) so it opens offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
  // GitHub Pages serves the app from /lsd-exampaper-generator/; locally it runs from the root.
  base: command === 'build' ? '/lsd-exampaper-generator/' : '/',
}))
