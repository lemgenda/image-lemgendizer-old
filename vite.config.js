import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Use relative paths for GitHub Pages
  base: '/image-lemgendizer-old/',

  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    // Optimize for GitHub Pages
    rollupOptions: {
      output: {
        chunkFileNames: '[name]-[hash].js',
        entryFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash].[ext]'
      }
    }
  },

  server: {
    port: 5173,
    host: true,
    open: true,

    // Browserless proxy configuration (only for dev)
    proxy: {
      '/api/browserless': {
        target: 'https://production-lon.browserless.io',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => {
          const newPath = path.replace(/^\/api\/browserless/, '')
          console.log('🔧 Path rewrite:', path, '->', newPath)
          return newPath
        },
        configure: (proxy, options) => {
          const target = options.target

          proxy.on('proxyReq', (proxyReq, req, res) => {
            const url = new URL(proxyReq.path, target)
            url.searchParams.set('token', '2TfpPHSu17r0zsSeb55ec0619d36b8451d9d39ca7c43a8a47')
            proxyReq.path = url.pathname + url.search

            console.log('➡️  PROXY REQUEST:', target + proxyReq.path)
          })

          proxy.on('error', (err, req, res) => {
            console.error('❌ PROXY ERROR:', err.message)
            if (!res.headersSent) {
              res.writeHead(500, {
                'Content-Type': 'application/json'
              })
              res.end(JSON.stringify({
                error: 'Proxy Error',
                message: err.message
              }))
            }
          })
        }
      }
    }
  },

  preview: {
    port: 4173,
    host: true,
    open: true
  }
})