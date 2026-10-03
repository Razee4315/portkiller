import type { JSX } from 'preact'
import { plural } from '../lib/format'
import { Icons } from './Icons'

interface HeaderProps {
  isAdmin: boolean
  alwaysOnTop: boolean
  historyCount: number
  /** Distinct processes the bulk-kill button would terminate. */
  bulkCount: number
  /** Their names, for the button tooltip. */
  bulkNames: string[]
  pendingBulk: boolean
  bulkBusy: boolean
  elevating: boolean
  onBulkKill: () => void
  onRestartAsAdmin: () => void
  onToggleAlwaysOnTop: () => void
  onOpenHistory: () => void
  onOpenSettings: () => void
  onHide: () => void
  onQuit: () => void
}

const ICON_BUTTON =
  'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-accent-blue/40'

// The title bar doubles as the window's drag handle. data-tauri-drag-region
// marks it for Tauri; interactive children opt out with `no-drag`.
export function Header({
  isAdmin,
  alwaysOnTop,
  historyCount,
  bulkCount,
  bulkNames,
  pendingBulk,
  bulkBusy,
  elevating,
  onBulkKill,
  onRestartAsAdmin,
  onToggleAlwaysOnTop,
  onOpenHistory,
  onOpenSettings,
  onHide,
  onQuit,
}: HeaderProps): JSX.Element {
  return (
    <header
      data-tauri-drag-region
      className="drag-region flex items-center justify-between px-3 py-2 border-b border-dark-500 bg-dark-800 select-none cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icons.Logo className="w-5 h-5 text-white flex-shrink-0" />
        <span className="text-white font-semibold text-[13px]">PortKiller</span>
        {bulkCount > 0 && (
          <button
            onClick={onBulkKill}
            disabled={bulkBusy}
            className={`btn btn-danger text-[11px] flex items-center gap-1 ml-2 py-1 no-drag disabled:cursor-wait ${
              pendingBulk ? 'animate-pulse' : ''
            }`}
            title={bulkNames.join(', ')}
          >
            {bulkBusy
              ? <Icons.Spinner className="w-3 h-3 animate-spin" />
              : <Icons.Trash className="w-3 h-3" />}
            {bulkBusy
              ? 'Killing…'
              : pendingBulk
              ? `Confirm: kill ${plural(bulkCount, 'process')}?`
              : `Kill ${plural(bulkCount, 'process')}`}
          </button>
        )}
      </div>
      <div className="flex items-center gap-0.5 no-drag">
        {isAdmin ? (
          <span className="text-[11px] text-accent-green flex items-center gap-1 mr-1.5 px-1.5 py-0.5 rounded bg-accent-green/10">
            <Icons.ShieldCheck className="w-3 h-3" />
            Admin
          </span>
        ) : (
          <button
            onClick={onRestartAsAdmin}
            disabled={elevating}
            className="text-[11px] text-accent-yellow flex items-center gap-1 mr-1.5 px-1.5 py-0.5 rounded hover:bg-accent-yellow/10 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-yellow/40 disabled:cursor-wait"
            title="Restart as Administrator for full control"
            aria-label="Restart as Administrator"
          >
            {elevating
              ? <Icons.Spinner className="w-3 h-3 animate-spin" />
              : <Icons.Shield className="w-3 h-3" />}
            Admin
          </button>
        )}
        <button
          onClick={onToggleAlwaysOnTop}
          className={`${ICON_BUTTON} ${
            alwaysOnTop
              ? 'text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20'
              : 'text-gray-300 hover:text-white hover:bg-dark-600'
          }`}
          title={alwaysOnTop ? 'Unpin window (currently always on top)' : 'Pin window on top'}
          aria-label="Always on top"
          aria-pressed={alwaysOnTop}
        >
          {alwaysOnTop
            ? <Icons.PinFilled className="w-3.5 h-3.5" />
            : <Icons.Pin className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onOpenHistory}
          className={`${ICON_BUTTON} text-gray-300 hover:text-white hover:bg-dark-600 relative`}
          title={`Recently killed (${historyCount}) — press h`}
          aria-label="Open kill history"
        >
          <Icons.History className="w-3.5 h-3.5" />
          {historyCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent-blue" aria-hidden="true" />
          )}
        </button>
        <button
          onClick={onOpenSettings}
          className={`${ICON_BUTTON} text-gray-300 hover:text-white hover:bg-dark-600`}
          title="Settings"
          aria-label="Open settings"
        >
          <Icons.Settings className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onHide}
          className={`${ICON_BUTTON} text-gray-300 hover:text-white hover:bg-dark-600`}
          title="Hide to tray"
          aria-label="Hide to tray"
        >
          <Icons.Minimize className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onQuit}
          className="p-1.5 rounded-md hover:bg-accent-red/20 text-gray-300 hover:text-accent-red transition-colors focus:outline-none focus:ring-2 focus:ring-accent-red/40"
          title="Quit PortKiller"
          aria-label="Quit application"
        >
          <Icons.Close className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
