// Footer global con la version instalada — visible en todas las paginas.
// No interfiere con clics gracias a pointer-events: none en el wrapper.
const VERSION = import.meta.env.VITE_APP_VERSION || '—'
const BUILD_TIME = import.meta.env.VITE_BUILD_TIME || ''

export function VersionFooter() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        padding: '4px 8px',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <span
        style={{
          pointerEvents: 'auto',
          background: 'rgba(15, 23, 42, 0.55)',
          color: 'rgba(255, 255, 255, 0.78)',
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '3px 10px',
          borderRadius: 999,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          userSelect: 'none',
        }}
        title={BUILD_TIME ? `Build ${BUILD_TIME}` : undefined}
      >
        v{VERSION}
      </span>
    </div>
  )
}
