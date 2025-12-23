// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',

  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow-models/coco-ssd',
    ],
    exclude: ['@tensorflow/tfjs-core']
  },

  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'tensorflow': ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
          'vendor': ['react', 'react-dom', 'i18next']
        }
      }
    }
  },

  server: {
    port: 5173
  }
})