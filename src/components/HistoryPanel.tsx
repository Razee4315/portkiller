import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import type { KillRecord } from '../types'
import { Icons } from './Icons'

interface HistoryPanelProps {
  history: KillRecord[]
  onClose: () => void
  onClear: () => void
}

function formatRelative(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function HistoryPanel({ history, onClose, onClear }: HistoryPanelProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => {
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [])

  return (
    <div
      className="modal-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Recently killed processes"
      onClick={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="modal-content w-[420px] max-h-[80vh] flex flex-col overflow-hidden focus:outline-none"
      >
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-dark-500 bg-dark-800">
          <div className="flex items-center gap-2">
            <Icons.History className="w-5 h-5 text-accent-blue" />
            <span className="text-white font-semibold text-sm">Recently killed</span>
            {history.length > 0 && (
              <span className="text-gray-400 text-xs">({history.length})</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
                aria-label="Clear kill history"
                title="Clear kill history"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
              aria-label="Close history"
            >
              <Icons.Close className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Icons.Empty className="w-6 h-6 text-gray-400 mb-2" />
              <p className="text-gray-300 text-sm">No kills recorded yet</p>
              <p className="text-gray-500 text-xs mt-1">
                Successful kills from this session will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-dark-600" role="list">
              {history.map((record) => (
                <li
                  key={`${record.timestamp}-${record.port}-${record.pid}`}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-dark-700/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm">:{record.port}</span>
                      <span className="text-gray-400 font-mono text-[10px]">PID {record.pid}</span>
                    </div>
                    <p className="text-gray-300 text-xs truncate">{record.processName}</p>
                  </div>
                  <span
                    className="text-gray-500 text-[10px] flex-shrink-0"
                    title={new Date(record.timestamp).toLocaleString()}
                  >
                    {formatRelative(record.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
