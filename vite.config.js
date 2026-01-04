import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// Get base URL from environment or use default
const base = process.env.VITE_BASE_URL || './'

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait()
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
  optimizeDeps: {
    exclude: ['@jsquash/webp', '@jsquash/jpeg', '@jsquash/avif']
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
    setupFiles: ['./src/setupTests.js'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  }
})