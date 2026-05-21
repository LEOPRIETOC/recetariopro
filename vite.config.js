import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Version = 2.MES.DIA.N donde N es el numero de commits del dia (hora Colombia).
// El primer deploy del dia da N=1, el segundo N=2, etc.
function getColombiaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  return {
    year:  +parts.find((p) => p.type === 'year').value,
    month: +parts.find((p) => p.type === 'month').value,
    day:   +parts.find((p) => p.type === 'day').value,
  }
}
function computeAppVersion() {
  const { year, month, day } = getColombiaToday()
  let n = 1
  try {
    const since = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`
    const out = execSync(`git log --since="${since}" --oneline`, { encoding: 'utf8' })
    n = out.split('\n').filter(Boolean).length || 1
  } catch { /* sin git fallback a 1 */ }
  return `2.${month}.${day}.${n}`
}

const APP_VERSION = computeAppVersion()
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
