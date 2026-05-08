import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { Icons } from './Icons'

interface ShortcutsPanelProps {
  onClose: () => void
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['/'], label: 'Focus search' },
  { keys: ['↑', '↓'], label: 'Move selection' },
  { keys: ['j', 'k'], label: 'Move selection (vim-style)' },
  { keys: ['Enter'], label: 'Kill selected port (twice to confirm)' },
  { keys: ['Delete'], label: 'Kill selected port' },
  { keys: ['p'], label: 'Pin / unpin selected port' },
  { keys: ['h'], label: 'Show recently killed processes' },
  { keys: ['Ctrl', 'C'], label: 'Copy selected port:pid' },
  { keys: ['Esc'], label: 'Close menu / cancel pending kill / hide window' },
  { keys: ['Space'], label: 'Toggle multi-select on focused row' },
  { keys: ['Ctrl', 'A'], label: 'Select all visible ports' },
  { keys: ['F5'], label: 'Refresh port list now' },
  { keys: ['Ctrl', 'R'], label: 'Refresh port list now' },
  { keys: ['Alt', 'P'], label: 'Toggle window from anywhere (global)' },
  { keys: ['?'], label: 'Show this cheatsheet' },
]

const COMMANDS: { cmd: string; label: string }[] = [
  { cmd: 'kill 3000', label: 'Kill the process on port 3000' },
  { cmd: 'kill 3000-4000', label: 'Select every port in a range for bulk kill' },
  { cmd: 'kill all', label: 'Select all killable ports for bulk kill' },
  { cmd: 'pin 3000', label: 'Pin port 3000 to the top of the list' },
  { cmd: 'unpin 3000', label: 'Unpin port 3000' },
  { cmd: 'unpin all', label: 'Clear every pinned port' },
  { cmd: 'history', label: 'Open the kill history panel' },
  { cmd: '3000-4000', label: 'Filter the list to ports in that range' },
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
        className="modal-content w-[440px] max-h-[90vh] flex flex-col overflow-hidden focus:outline-none"
      >
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-dark-500 bg-dark-800">
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

        <div className="flex-1 min-h-0 p-4 space-y-5 overflow-y-auto">
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
