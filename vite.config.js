// vite.config.js (correct filename)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'tensorflow': ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
          'vendor': ['react', 'react-dom', 'i18next', 'jszip']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['@sparticuz/chromium-min'] // Exclude serverless package from frontend build
  }
})