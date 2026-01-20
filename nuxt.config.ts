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
  ],

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
  },

  app: {
    head: {
      title: 'Kost Man  - Premium Starter Kit',
      meta: [
        { name: 'description', content: 'A premium Nuxt UI starter kit with comprehensive component documentation' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
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
})
