import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/image-lemgendizer-old/',

  // ✅ Add this to optimize TensorFlow.js loading
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow-models/coco-ssd',
      '@tensorflow/tfjs-backend-webgl'
    ],
    exclude: ['@tensorflow/tfjs-core'] // Prevent duplicate core loading
  },

  // ✅ Add build optimization
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'tensorflow': ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
          'vendor': ['react', 'react-dom', 'i18next']
        }
      }
    }
  }
})