// vite.config.gh-pages.js - Build-only config
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],

    base: './',

    build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'terser',
        target: 'es2020',
        rollupOptions: {
            output: {
                entryFileNames: '[name]-[hash].js',
                chunkFileNames: '[name]-[hash].js',
                assetFileNames: '[name]-[hash].[ext]'
            }
        }
    }
})