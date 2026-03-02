import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Get base URL from environment or use default
const base = process.env.VITE_BASE_URL || './'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', '**/*.wasm'],
      manifest: {
        name: 'Image LemGendizer',
        short_name: 'LemGendizer',
        description: 'Professional client-side image optimization and processing tool',
        theme_color: '#366487',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 50000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}'],
        navigateFallbackDenylist: [/^\/.*\/hmr/], // Exclude HMR
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@tensorflow\/tfjs-backend-webgpu.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tf-backends-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/tfjs-models\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tf-models-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],

  resolve: {
    alias: {
      fibers: '/src/mocks/fibers.js'
    }
  },

  // Base public path for GitHub Pages
  base: base,

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    target: 'es2020',
    emptyOutDir: true,
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('onnxruntime-web')) return 'vendor-onnx';
            if (id.includes('@fortawesome')) return 'vendor-icons';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            return 'vendor';
          }
        }
      }
    },
    // Reduce chunk size warning
    chunkSizeWarningLimit: 2000
  },

  // Treat WASM as static assets
  assetsInclude: ['**/*.wasm'],

  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },

  // Development server configuration
  server: {
    port: 5173,
    host: true,
    open: true,
    strictPort: true,
    // Note: COOP/COEP headers removed from dev server.
    // They cause browsing context recreation which breaks Vite HMR websockets.
    // SharedArrayBuffer (needed for threaded WASM) won't be available in dev,
    // but onnxruntime-web falls back to non-threaded WASM automatically.
    // For production, set these headers in your hosting config (Netlify, Vercel, etc).
    // Proxy for browserless API (development only)
    proxy: {
      '/api/browserless': {
        target: 'https://production-lon.browserless.io',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/browserless/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Add API token
            const url = new URL(proxyReq.path, 'https://production-lon.browserless.io')
            url.searchParams.set('token', '2TfpPHSu17r0zsSeb55ec0619d36b8451d9d39ca7c43a8a47')
            proxyReq.path = url.pathname + url.search
          })
        }
      }
    },
    watch: {
      ignored: ['**/models/**', '**/*.onnx', '**/*.wasm', '**/.venv/**', '**/.venv_training/**', '**/training/**']
    }
  },

  // Preview configuration
  preview: {
    port: 4173,
    host: true,
    open: false
  },

  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  }
})