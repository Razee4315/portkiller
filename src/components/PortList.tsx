import type { JSX } from 'preact'
import type { PortInfo, ChangeState } from '../types'
import { Icons } from './Icons'

interface PortListProps {
  ports: PortInfo[]
  onKill: (portInfo: PortInfo) => void
  killingPort: number | null
  selectedIndex?: number
  selectedPorts?: Set<string>
  portChanges?: Map<string, ChangeState>
  onPortClick?: (port: PortInfo, e: MouseEvent) => void
  onContextMenu?: (port: PortInfo, e: MouseEvent) => void
  onShowDetails?: (port: PortInfo) => void
}

function getChangeClass(change?: ChangeState): string {
  switch (change) {
    case 'new': return 'bg-accent-green/10 border-l-2 border-l-accent-green'
    case 'removed': return 'bg-accent-red/10 opacity-50'
    default: return ''
  }
}

export function PortList({
  ports,
  onKill,
  killingPort,
  selectedIndex = -1,
  selectedPorts = new Set(),
  portChanges = new Map(),
  onPortClick,
  onContextMenu,
  onShowDetails,
}: PortListProps): JSX.Element {
  return (
    <div className="space-y-1">
      {ports.map((portInfo, index) => {
        const key = `${portInfo.port}-${portInfo.pid}`
        const isKilling = killingPort === portInfo.port
        const isProtected = portInfo.is_protected
        const isSelected = selectedIndex === index || selectedPorts.has(key)
        const changeState = portChanges.get(key)

        return (
          <div
            key={key}
            data-port-item
            onClick={(e) => onPortClick?.(portInfo, e as unknown as MouseEvent)}
            onContextMenu={(e) => onContextMenu?.(portInfo, e as unknown as MouseEvent)}
            onDblClick={() => onShowDetails?.(portInfo)}
            className={`list-row group ${isProtected ? 'list-row-protected' : ''} ${isSelected ? 'bg-dark-500 ring-1 ring-accent-blue/50' : ''
              } ${getChangeClass(changeState)} cursor-pointer`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${changeState === 'new' ? 'bg-accent-green animate-pulse' :
                  isProtected ? 'bg-accent-yellow' : 'bg-accent-red'
                }`} />

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">:{portInfo.port}</span>
                  <span className="text-gray-500 text-xs px-1.5 py-0.5 bg-dark-700 rounded">
                    {portInfo.protocol}
                  </span>
                  {changeState === 'new' && (
                    <span className="text-accent-green text-xs">NEW</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 truncate">
                  <span className="truncate">{portInfo.process_name}</span>
                  <span className="text-gray-600">PID: {portInfo.pid}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onShowDetails && (
                <button
                  onClick={(e) => { e.stopPropagation(); onShowDetails(portInfo) }}
                  className="btn btn-ghost p-1 opacity-0 group-hover:opacity-100"
                  title="View details"
                >
                  <Icons.Process className="w-3.5 h-3.5" />
                </button>
              )}
              {isProtected ? (
                <div className="flex items-center gap-1 text-xs text-accent-yellow">
                  <Icons.ShieldCheck className="w-4 h-4" />
                  <span>Protected</span>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onKill(portInfo) }}
                  disabled={isKilling}
                  className={`btn btn-danger flex items-center gap-1 ${isKilling ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  title={`Kill ${portInfo.process_name}`}
                >
                  {isKilling ? (
                    <Icons.Spinner className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Icons.Trash className="w-3.5 h-3.5" />
                  )}
                  <span>Kill</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
