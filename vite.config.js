import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  base: '/',

  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },

  server: {
    port: 5173,
    host: true,
    open: true,

    // Browserless proxy configuration
    proxy: {
      '/api/browserless': {
        target: 'https://production-lon.browserless.io',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => {
          // Remove the /api/browserless prefix
          const newPath = path.replace(/^\/api\/browserless/, '')
          console.log('🔧 Path rewrite:', path, '->', newPath)
          return newPath
        },
        configure: (proxy, options) => {
          // Store the original target for logging
          const target = options.target

          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add token to the query string
            const url = new URL(proxyReq.path, target)
            url.searchParams.set('token', '2TfpPHSu17r0zsSeb55ec0619d36b8451d9d39ca7c43a8a47')
            proxyReq.path = url.pathname + url.search

            console.log('➡️  PROXY REQUEST:')
            console.log('   Local URL:', req.url)
            console.log('   Proxying to:', target + proxyReq.path)
            console.log('   Method:', req.method)
            console.log('   Headers:', req.headers)

            // Log request body if it exists
            if (req.body && req.method === 'POST') {
              let bodyData = ''
              req.on('data', chunk => {
                bodyData += chunk.toString()
              })
              req.on('end', () => {
                try {
                  const parsed = JSON.parse(bodyData)
                  console.log('   Request body (parsed):', {
                    url: parsed.url,
                    viewport: parsed.viewport,
                    options: parsed.options
                  })
                } catch {
                  console.log('   Request body (raw, first 200 chars):', bodyData.substring(0, 200))
                }
              })
            }
          })

          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('⬅️  PROXY RESPONSE:')
            console.log('   Status:', proxyRes.statusCode, proxyRes.statusMessage)
            console.log('   Headers:', {
              'content-type': proxyRes.headers['content-type'],
              'content-length': proxyRes.headers['content-length']
            })
            console.log('   For request:', req.url)

            // Log response body for errors
            if (proxyRes.statusCode >= 400) {
              let responseData = ''
              proxyRes.on('data', chunk => {
                responseData += chunk.toString()
              })
              proxyRes.on('end', () => {
                console.log('   Error response:', responseData.substring(0, 500))
              })
            }
          })

          proxy.on('error', (err, req, res) => {
            console.error('❌ PROXY ERROR:')
            console.error('   Error:', err.message)
            console.error('   Request URL:', req.url)
            console.error('   Target:', target)

            // Send a proper error response
            if (!res.headersSent) {
              res.writeHead(500, {
                'Content-Type': 'application/json'
              })
              res.end(JSON.stringify({
                error: 'Proxy Error',
                message: err.message,
                target: target,
                requestUrl: req.url
              }))
            }
          })
        }
      }
    }
  },

  preview: {
    port: 4173,
    host: true
  }
})