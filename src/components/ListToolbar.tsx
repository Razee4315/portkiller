import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { ProtocolFilter, SortMode } from '../preferences'
import { SORT_OPTIONS } from '../preferences'
import { Icons } from './Icons'

interface ListToolbarProps {
  searching: boolean
  protocolFilter: ProtocolFilter
  counts: Record<ProtocolFilter, number>
  sortMode: SortMode
  /** Initial load or a user-requested refresh is in flight. */
  busy: boolean
  onProtocolChange: (filter: ProtocolFilter) => void
  onSortChange: (mode: SortMode) => void
  onRefresh: () => void
  onExport: (format: 'json' | 'csv') => void
}

const PROTOCOLS: ProtocolFilter[] = ['all', 'tcp', 'udp']

const TOOL_BUTTON =
  'text-gray-300 hover:text-white text-[11px] transition-colors px-1.5 py-0.5 rounded hover:bg-dark-700 focus:outline-none focus:ring-1 focus:ring-accent-blue/40 flex items-center gap-1'

function ExportMenu({ onExport }: { onExport: (format: 'json' | 'csv') => void }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    // Capture phase so Escape closes this menu and nothing else.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const choose = (format: 'json' | 'csv') => {
    setOpen(false)
    onExport(format)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={TOOL_BUTTON}
        title="Copy the visible ports to the clipboard"
        aria-label="Copy the visible ports"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icons.Copy className="w-3 h-3" />
        <Icons.ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-40 bg-dark-800 border border-dark-500 rounded-lg shadow-2xl py-1 w-36 animate-fade-in"
        >
          <button role="menuitem" onClick={() => choose('json')} className="ctx-menu-item text-gray-300 hover:bg-dark-600 text-[12px] py-1.5">
            Copy as JSON
          </button>
          <button role="menuitem" onClick={() => choose('csv')} className="ctx-menu-item text-gray-300 hover:bg-dark-600 text-[12px] py-1.5">
            Copy as CSV
          </button>
        </div>
      )}
    </div>
  )
}

export function ListToolbar({
  searching,
  protocolFilter,
  counts,
  sortMode,
  busy,
  onProtocolChange,
  onSortChange,
  onRefresh,
  onExport,
}: ListToolbarProps): JSX.Element {
  return (
    <div className="px-3 py-2 border-b border-dark-600 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-gray-300 text-[12px] font-medium truncate">
          {searching ? 'Search results' : 'Listening ports'}
        </span>
        <div
          role="radiogroup"
          aria-label="Filter by protocol"
          className="flex items-center gap-0.5 ml-1 p-0.5 rounded bg-dark-700 border border-dark-600 flex-shrink-0"
        >
          {PROTOCOLS.map(opt => {
            const active = protocolFilter === opt
            return (
              <button
                key={opt}
                role="radio"
                aria-checked={active}
                onClick={() => onProtocolChange(opt)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-accent-blue/40 ${
                  active
                    ? 'bg-accent-blue/20 text-accent-blue'
                    : 'text-gray-300 hover:text-white hover:bg-dark-600'
                }`}
                title={opt === 'all' ? 'Show all protocols' : `Show only ${opt.toUpperCase()} ports`}
              >
                {opt} <span className="opacity-70">{counts[opt]}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onRefresh}
          disabled={busy}
          className={`${TOOL_BUTTON} disabled:cursor-wait`}
          title="Refresh now (F5)"
          aria-label="Refresh listening ports"
        >
          <Icons.Refresh className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
        </button>
        <select
          value={sortMode}
          onChange={(e) => onSortChange(e.currentTarget.value as SortMode)}
          className="bg-dark-700 border border-dark-600 text-gray-300 text-[11px] rounded px-1.5 py-0.5 hover:text-white focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
          title="Sort listening ports"
          aria-label="Sort listening ports"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ExportMenu onExport={onExport} />
      </div>
    </div>
  )
}
