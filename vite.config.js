// Root: vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',  // Change from GitHub Pages to Vercel root

  root: './src',  // Point to src directory

  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow-models/coco-ssd',
      '@tensorflow/tfjs-backend-webgl'
    ],
    exclude: ['@tensorflow/tfjs-core']
  },

  build: {
    outDir: '../dist',  // Output to root/dist
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
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5173',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})