import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APP_VERSION = '2.13'
const BUILD_ID = String(Date.now())
const BUILD_TIME = new Date().toISOString()

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(BUILD_TIME.slice(0, 16)),
  },
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({
            version: APP_VERSION,
            buildId: BUILD_ID,
            buildTime: BUILD_TIME,
          }),
        })
      },
    },
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
