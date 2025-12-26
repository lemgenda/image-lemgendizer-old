import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    base: '/',
    server: {
      port: 5173
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',  // Use esbuild instead of terser
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
      exclude: ['@sparticuz/chromium-min']
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode)
    }
  }
})