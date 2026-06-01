import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * App-level error boundary — shows a friendly fallback instead of a blank
 * white screen if any descendant throws during render.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the error for diagnostics; hook a real logger (Sentry, etc.) here.
    console.error('ErrorBoundary caught:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            background: '#FFF8EA',
            color: '#2A1E1E',
          }}
        >
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 700, color: '#8B1024' }}>
            Relish
          </span>
          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 15, maxWidth: 320, lineHeight: 1.5, color: '#5b4a44' }}>
            Something went wrong while loading the menu. Please try again.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: '#FFF8EA',
              background: 'linear-gradient(135deg, #7A0E1E, #8B1024)',
              border: 'none',
              borderRadius: 9999,
              padding: '12px 24px',
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
