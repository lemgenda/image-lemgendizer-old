import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    base: '/',
    server: {
      port: 5173,
      host: true
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      // Removed problematic manual chunks configuration
      rollupOptions: {
        // Let Vite handle chunking automatically
        output: {
          // Vite will handle chunking automatically
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      chunkSizeWarningLimit: 2000, // Increased warning limit
      target: 'es2020'
    },
    optimizeDeps: {
      exclude: ['@sparticuz/chromium-min'],
      include: [
        'react',
        'react-dom',
        'i18next',
        'i18next-browser-languagedetector',
        'react-i18next'
      ]
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.VERCEL': JSON.stringify(process.env.VERCEL || '0'),
      'process.env.VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV || ''),
      'process.env.BROWSERLESS_API_KEY': JSON.stringify(process.env.BROWSERLESS_API_KEY || '')
    }
  }
})