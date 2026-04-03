// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-05',

  devtools: { enabled: true },

  devServer: {
    port: 3004,
  },

  future: {
    compatibilityVersion: 4,
  },

  modules: [
    '@nuxt/ui',
    '@nuxt/image',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
  },

  app: {
    head: {
      title: 'KostMan - Kelola Kost',
      meta: [
        { name: 'description', content: 'Aplikasi manajemen kost premium' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        // iOS PWA
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'KostMan' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'theme-color', content: '#22C55E' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap' }
      ],
      script: [
        // Midtrans Snap SDK - loads conditionally based on environment
        {
          src: process.env.MIDTRANS_IS_PRODUCTION === 'true'
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js',
          'data-client-key': process.env.MIDTRANS_CLIENT_KEY || '',
        }
      ],
    },
  },

  runtimeConfig: {
    // Server-side only
    midtransServerKey: process.env.MIDTRANS_SERVER_KEY,
    // Public (client-side)
    public: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      midtransClientKey: process.env.MIDTRANS_CLIENT_KEY,
      midtransIsProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    },
  },

  typescript: {
    strict: false,
    typeCheck: false,
  },

  // Production server configuration
  nitro: {
    preset: 'node-server',
    // Force port for production
    devServer: {
      host: process.env.HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '3004'),
    },
  },

  // Ensure cookies are properly handled in production
  experimental: {
    payloadExtraction: false,
  },

  // Global fetch configuration for SSR
  $production: {
    routeRules: {
      '/**': { ssr: true },
    },
  },

  // PWA Configuration
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'KostMan - Kelola Kost',
      short_name: 'KostMan',
      description: 'Aplikasi manajemen kost premium',
      theme_color: '#22C55E',
      background_color: '#0f172a',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icons/icon-maskable-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/icons/icon-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      // Cache API calls for offline fallback (GET only, not auth/mutations)
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'gstatic-fonts-cache',
            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
      navigateFallback: null,
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },
})