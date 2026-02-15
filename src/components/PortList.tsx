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
            className={`list-row group ${isProtected ? 'list-row-protected' : ''} ${isSelected ? 'list-row-selected' : ''
              } ${getChangeClass(changeState)} cursor-pointer`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${changeState === 'new' ? 'bg-accent-green animate-pulse' :
                  isProtected ? 'bg-accent-yellow/60' : 'bg-accent-red/80'
                }`} />

              <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-xs">:{portInfo.port}</span>
                  <span className="text-gray-400 text-[10px] px-1.5 py-px bg-dark-600 rounded">
                    {portInfo.protocol}
                  </span>
                  {changeState === 'new' && (
                    <span className="text-accent-green text-[10px] font-medium">NEW</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-300 truncate">
                  <span className="truncate">{portInfo.process_name}</span>
                  <span className="text-gray-400">PID {portInfo.pid}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {onShowDetails && (
                <button
                  onClick={(e) => { e.stopPropagation(); onShowDetails(portInfo) }}
                  className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-dark-600 text-gray-400 hover:text-white transition-all"
                  title="View details"
                >
                  <Icons.Process className="w-3.5 h-3.5" />
                </button>
              )}
              {isProtected ? (
                <div className="flex items-center gap-1 text-[10px] text-accent-yellow px-2">
                  <Icons.ShieldCheck className="w-3.5 h-3.5" />
                  <span>Protected</span>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onKill(portInfo) }}
                  disabled={isKilling}
                  className={`btn btn-danger flex items-center gap-1 text-[11px] opacity-0 group-hover:opacity-100 transition-all ${isKilling ? 'opacity-100 cursor-not-allowed' : ''
                    }`}
                  title={`Kill ${portInfo.process_name}`}
                >
                  {isKilling ? (
                    <Icons.Spinner className="w-3 h-3 animate-spin" />
                  ) : (
                    <Icons.Trash className="w-3 h-3" />
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
