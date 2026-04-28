import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { Icons } from './Icons'

interface ShortcutsPanelProps {
  onClose: () => void
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['/'], label: 'Focus search' },
  { keys: ['↑', '↓'], label: 'Move selection' },
  { keys: ['Enter'], label: 'Kill selected port (twice to confirm)' },
  { keys: ['Delete'], label: 'Kill selected port' },
  { keys: ['Esc'], label: 'Close menu / cancel pending kill / hide window' },
  { keys: ['Ctrl', 'A'], label: 'Select all visible ports' },
  { keys: ['Alt', 'P'], label: 'Toggle window from anywhere (global)' },
  { keys: ['?'], label: 'Show this cheatsheet' },
]

const COMMANDS: { cmd: string; label: string }[] = [
  { cmd: 'kill 3000', label: 'Kill the process on port 3000' },
  { cmd: 'admin', label: 'Restart as Administrator' },
  { cmd: 'refresh', label: 'Refresh the port list now' },
  { cmd: 'export json', label: 'Copy listening ports to clipboard as JSON' },
  { cmd: 'export csv', label: 'Copy listening ports to clipboard as CSV' },
  { cmd: 'settings', label: 'Open settings' },
  { cmd: 'clear', label: 'Clear search and selection' },
]

export function ShortcutsPanel({ onClose }: ShortcutsPanelProps): JSX.Element {
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
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="modal-content w-[440px] max-h-[80%] overflow-hidden focus:outline-none"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500 bg-dark-800">
          <div className="flex items-center gap-2">
            <Icons.Keyboard className="w-5 h-5 text-accent-blue" />
            <span className="text-white font-semibold text-sm">Keyboard shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
            aria-label="Close shortcuts"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto max-h-[480px]">
          <section>
            <span className="text-gray-300 text-xs font-medium block mb-2">Keys</span>
            <ul className="space-y-1.5">
              {SHORTCUTS.map(({ keys, label }) => (
                <li key={label} className="flex items-center justify-between gap-3">
                  <span className="text-gray-300 text-sm">{label}</span>
                  <span className="flex items-center gap-1 flex-shrink-0">
                    {keys.map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-500 text-[10px]">+</span>}
                        <kbd className="px-1.5 py-0.5 rounded bg-dark-700 border border-dark-500 font-mono text-[11px] text-gray-200">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <span className="text-gray-300 text-xs font-medium block mb-2">
              Commands (type into the search bar)
            </span>
            <ul className="space-y-1.5">
              {COMMANDS.map(({ cmd, label }) => (
                <li key={cmd} className="flex items-center justify-between gap-3">
                  <span className="text-gray-300 text-sm">{label}</span>
                  <code className="px-2 py-0.5 rounded bg-dark-700 border border-dark-500 font-mono text-[11px] text-accent-blue flex-shrink-0">
                    {cmd}
                  </code>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
