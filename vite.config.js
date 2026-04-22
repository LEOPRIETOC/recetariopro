import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify('2.11'),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString().slice(0, 16)),
  },
  plugins: [
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
  resolve: {
    alias: { '@': '/src' },
  },
})
