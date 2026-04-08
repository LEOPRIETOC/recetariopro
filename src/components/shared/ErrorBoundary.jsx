import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'monospace', maxWidth: '900px', margin: '0 auto' }}>
          <h1 style={{ color: '#dc2626', fontFamily: 'sans-serif' }}>⚠ Error en la aplicación</h1>
          <p style={{ color: '#6b7280', fontFamily: 'sans-serif' }}>Copia este mensaje y repórtalo:</p>
          <pre style={{
            background: '#fee2e2', padding: '16px', borderRadius: '8px',
            overflowX: 'auto', fontSize: '13px', color: '#7f1d1d', whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.info?.componentStack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px', padding: '8px 16px', background: '#d97706', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            Recargar aplicación
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
