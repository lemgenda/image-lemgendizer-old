import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Base path for assets
  base: '/',

  // Build configuration
  build: {
    outDir: 'dist',           // Output directory
    sourcemap: false,         // No sourcemaps for production
    emptyOutDir: true,        // Clean before building

    // Use esbuild for minification (built-in, no extra dependencies)
    minify: 'esbuild',

    // Optimize build size
    target: 'es2020',
    cssCodeSplit: true,

    // Rollup options (optional)
    rollupOptions: {
      output: {
        // Organize output files
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },

  // Development server
  server: {
    port: 5173,
    host: true,
    open: true,  // Open browser automatically

    // Proxy API requests to your backend during development
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },

  // Preview server (for built files)
  preview: {
    port: 4173,
    host: true
  }
})