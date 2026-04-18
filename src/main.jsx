import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap-grid.min.css'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/shared/ErrorBoundary.jsx'

// ── Dev environment banner ────────────────────────────────────────────────────
const isDev = window.location.hostname.includes('dev') ||
              window.location.hostname === 'localhost'

if (isDev) {
  document.title = '⚠️ DEV — RecetarioPro'
  document.body.setAttribute('data-env', 'dev')

  const banner = document.createElement('div')
  banner.id = 'dev-banner'
  banner.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'right: 0',
    'background: #F59E0B',
    'color: #111',
    'text-align: center',
    'padding: 6px',
    'font-size: 0.78rem',
    'font-weight: 700',
    'z-index: 999999',
    'font-family: sans-serif',
    'letter-spacing: 0.05em',
  ].join(';')
  banner.textContent = '⚠️ AMBIENTE DE PRUEBAS — No afecta producción'
  document.body.prepend(banner)
  document.body.style.paddingTop = '30px'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
