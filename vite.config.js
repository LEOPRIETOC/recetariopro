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
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        // Code-splitting manual para que el bundle inicial sea pequeno y los
        // libs pesados se carguen solo cuando alguna pagina los necesita.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase')) return 'firebase'
          if (id.includes('xlsx')) return 'xlsx'
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('@radix-ui')) return 'radix'
          if (id.includes('lucide-react')) return 'lucide'
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) return 'forms'
          if (id.includes('@dnd-kit')) return 'dnd'
          return undefined
        },
      },
    },
  },
  resolve: {
    alias: { '@': '/src' },
  },
})
