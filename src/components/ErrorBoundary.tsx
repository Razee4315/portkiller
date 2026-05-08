import { Component } from 'preact'
import type { ComponentChildren } from 'preact'
import { Icons } from './Icons'

interface ErrorBoundaryProps {
  children: ComponentChildren
}

interface ErrorBoundaryState {
  error: Error | null
}

// Catches render errors anywhere in the tree so a single broken component
// doesn't leave the user staring at a transparent-window white screen.
// preact's class-based componentDidCatch is the supported way to do this.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[PortKiller] render error:', error)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = this.state.error.message || String(this.state.error)
    return (
      <div
        className="h-full bg-dark-900 rounded-xl border border-accent-red/40 shadow-2xl flex flex-col items-center justify-center p-6 gap-3 text-center"
        role="alert"
      >
        <Icons.Warning className="w-8 h-8 text-accent-red" />
        <div>
          <p className="text-white text-sm font-semibold">PortKiller hit an unexpected error</p>
          <p className="text-gray-400 text-xs mt-1 break-words max-w-[420px]">{message}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={this.reset}
            className="btn btn-primary text-xs"
            aria-label="Try to recover"
          >
            Try again
          </button>
          <button
            onClick={() => location.reload()}
            className="btn btn-ghost text-xs border border-dark-500"
            aria-label="Reload the window"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
