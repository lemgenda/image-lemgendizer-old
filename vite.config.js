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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
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
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-tf': ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
          'vendor-upscaler': ['upscaler', '@upscalerjs/esrgan-slim'],
          'vendor-utils': ['jszip', 'file-saver', 'html2canvas']
        }
      }
    },
    // Reduce chunk size warning
    chunkSizeWarningLimit: 1000
  },

  // Dependency optimization
  optimizeDeps: {
    include: ['@tensorflow-models/coco-ssd']
  },

  // Development server configuration
  server: {
    port: 5173,
    host: true,
    open: true,
    strictPort: true,
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
    setupFiles: ['./src/setupTests.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  }
})