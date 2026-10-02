import type { JSX } from 'preact'
import { memo } from '../lib/memo'
import type { PortInfo } from '../types'
import { commandHint, isPublicBinding, portKey } from '../lib/ports'
import { Icons } from './Icons'

interface PortListProps {
  ports: PortInfo[]
  /** Row the keyboard is on. Arrow keys move it; Enter and Delete act on it. */
  cursorKey: string | null
  /** Rows ticked for a bulk kill. Independent of the cursor. */
  selectedKeys: Set<string>
  newKeys: Set<string>
  pendingKill: string | null
  killingKeys: Set<string>
  pinnedPorts: Set<number>
  onKill: (port: PortInfo) => void
  onTogglePin: (port: number) => void
  onPortClick: (port: PortInfo, e: MouseEvent) => void
  onContextMenu: (port: PortInfo, e: MouseEvent) => void
  onShowDetails: (port: PortInfo) => void
  /** Tabbing into the list with no cursor yet puts it on the first row. */
  onFocusList: () => void
}

interface PortRowProps {
  port: PortInfo
  isCursor: boolean
  isSelected: boolean
  isNew: boolean
  isPendingKill: boolean
  isKilling: boolean
  isPinned: boolean
  onKill: (port: PortInfo) => void
  onTogglePin: (port: number) => void
  onPortClick: (port: PortInfo, e: MouseEvent) => void
  onContextMenu: (port: PortInfo, e: MouseEvent) => void
  onShowDetails: (port: PortInfo) => void
}

// Memoized: the list re-renders on every cursor move and selection change,
// but only the one or two rows whose flags changed need to do any work.
const PortRow = memo(function PortRow({
  port,
  isCursor,
  isSelected,
  isNew,
  isPendingKill,
  isKilling,
  isPinned,
  onKill,
  onTogglePin,
  onPortClick,
  onContextMenu,
  onShowDetails,
}: PortRowProps): JSX.Element {
  const isProtected = port.is_protected
  const hint = commandHint(port)
  // Row buttons are reachable by Tab only on the cursor row. Otherwise a list
  // of 80 ports would put 240 tab stops between the search box and the footer.
  const tabIndex = isCursor ? 0 : -1

  const rowClass = [
    'list-row group cursor-pointer',
    isProtected ? 'list-row-protected' : '',
    isSelected ? 'list-row-selected' : '',
    isCursor ? 'list-row-cursor' : '',
    isNew ? 'list-row-new' : '',
    isPendingKill ? 'list-row-pending' : '',
  ].join(' ')

  return (
    <div
      data-key={portKey(port)}
      role="listitem"
      aria-current={isCursor ? 'true' : undefined}
      aria-label={`Port ${port.port}, ${port.process_name}, PID ${port.pid}${isProtected ? ', protected' : ''}${isSelected ? ', selected' : ''}`}
      onClick={(e) => onPortClick(port, e)}
      onContextMenu={(e) => onContextMenu(port, e)}
      onDblClick={() => onShowDetails(port)}
      className={rowClass}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {isSelected ? (
          <span
            className="w-3.5 h-3.5 rounded-sm bg-accent-blue flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <Icons.Check className="w-2.5 h-2.5 text-dark-900" />
          </span>
        ) : (
          <span className="w-3.5 flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <span
              className={`w-2 h-2 rounded-full ${
                isNew ? 'bg-accent-green animate-pulse' : isProtected ? 'bg-accent-yellow/60' : 'bg-accent-red/80'
              }`}
            />
          </span>
        )}

        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold font-mono text-[13px]">:{port.port}</span>
            <span className="text-gray-300 text-[10px] px-1.5 py-px bg-dark-600 rounded font-mono">
              {port.protocol}
            </span>
            {isNew && <span className="text-accent-green text-[10px] font-medium">New</span>}
            {isPublicBinding(port.local_address) && (
              <span
                className="text-accent-yellow text-[10px] font-semibold uppercase px-1 py-px bg-accent-yellow/10 rounded tracking-wider"
                title={`Bound to ${port.local_address} — reachable from any network interface`}
              >
                Public
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-gray-300 min-w-0">
            <span className="truncate flex-shrink-0 max-w-[45%]">{port.process_name}</span>
            {hint && (
              <span className="truncate text-gray-400 font-mono text-[11px] min-w-0" title={port.command_line}>
                {hint}
              </span>
            )}
            <span className="text-gray-400 font-mono text-[11px] flex-shrink-0">PID {port.pid}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          tabIndex={tabIndex}
          onClick={(e) => { e.stopPropagation(); onTogglePin(port.port) }}
          className={`row-action ${isPinned ? 'text-accent-blue opacity-100' : ''}`}
          title={isPinned ? `Unpin port ${port.port}` : `Pin port ${port.port} to top`}
          aria-label={isPinned ? `Unpin port ${port.port}` : `Pin port ${port.port}`}
          aria-pressed={isPinned}
        >
          {isPinned ? <Icons.PinFilled className="w-3.5 h-3.5" /> : <Icons.Pin className="w-3.5 h-3.5" />}
        </button>
        <button
          tabIndex={tabIndex}
          onClick={(e) => { e.stopPropagation(); onShowDetails(port) }}
          className="row-action"
          title="View details"
          aria-label={`View details for port ${port.port}`}
        >
          <Icons.Process className="w-3.5 h-3.5" />
        </button>
        {isProtected ? (
          <div className="flex items-center gap-1 text-[11px] text-accent-yellow px-2">
            <Icons.ShieldCheck className="w-3.5 h-3.5" />
            <span>Protected</span>
          </div>
        ) : (
          <button
            tabIndex={tabIndex}
            onClick={(e) => { e.stopPropagation(); onKill(port) }}
            disabled={isKilling}
            className={`btn btn-danger flex items-center gap-1 text-[11px] ${
              isPendingKill
                ? 'opacity-100 animate-pulse'
                : isKilling
                ? 'opacity-100 cursor-wait'
                : 'opacity-70 group-hover:opacity-100 focus:opacity-100'
            }`}
            title={isPendingKill ? 'Click again to confirm' : `Kill ${port.process_name}`}
            aria-label={isPendingKill ? `Confirm kill ${port.process_name}` : `Kill process ${port.process_name} on port ${port.port}`}
          >
            {isKilling ? (
              <Icons.Spinner className="w-3 h-3 animate-spin" />
            ) : isPendingKill ? (
              <Icons.Warning className="w-3 h-3" />
            ) : (
              <Icons.Trash className="w-3 h-3" />
            )}
            <span>{isKilling ? 'Killing' : isPendingKill ? 'Confirm?' : 'Kill'}</span>
          </button>
        )}
      </div>
    </div>
  )
})

export function PortList({
  ports,
  cursorKey,
  selectedKeys,
  newKeys,
  pendingKill,
  killingKeys,
  pinnedPorts,
  onKill,
  onTogglePin,
  onPortClick,
  onContextMenu,
  onShowDetails,
  onFocusList,
}: PortListProps): JSX.Element {
  return (
    <div
      className="space-y-1 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue/40"
      role="list"
      aria-label="Listening ports. Use the arrow keys to move, Enter to kill."
      tabIndex={0}
      onFocus={(e) => { if (e.target === e.currentTarget) onFocusList() }}
    >
      {ports.map(port => {
        const key = portKey(port)
        return (
          <PortRow
            key={key}
            port={port}
            isCursor={cursorKey === key}
            isSelected={selectedKeys.has(key)}
            isNew={newKeys.has(key)}
            isPendingKill={pendingKill === key}
            isKilling={killingKeys.has(key)}
            isPinned={pinnedPorts.has(port.port)}
            onKill={onKill}
            onTogglePin={onTogglePin}
            onPortClick={onPortClick}
            onContextMenu={onContextMenu}
            onShowDetails={onShowDetails}
          />
        )
      })}
    </div>
  )
}
