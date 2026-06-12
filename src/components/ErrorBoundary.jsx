import { Component } from 'react'

// Top-level error boundary — without this, any render crash white-screens
// the whole app (was CLAUDE.md known-bug #3).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[error-boundary]', error, info?.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-dark flex items-center justify-center p-6">
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 max-w-md text-center">
          <p className="text-5xl mb-4">🔥</p>
          <h1 className="text-white font-bold text-xl mb-2">
            Well, something got cooked. It was us.
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            The app hit an unexpected error. Reload and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-white text-black font-mono text-sm font-bold px-6 py-2 rounded-md hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
