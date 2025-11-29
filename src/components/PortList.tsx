import type { JSX } from 'preact'
import type { PortInfo } from '../types'
import { Icons } from './Icons'

interface PortListProps {
  ports: PortInfo[]
  onKill: (portInfo: PortInfo) => void
  killingPort: number | null
}

export function PortList({ ports, onKill, killingPort }: PortListProps): JSX.Element {
  return (
    <div className="space-y-1">
      {ports.map((portInfo) => {
        const isKilling = killingPort === portInfo.port
        const isProtected = portInfo.is_protected

        return (
          <div
            key={`${portInfo.port}-${portInfo.pid}`}
            className={`list-row group ${isProtected ? 'list-row-protected' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`w-2 h-2 rounded-full ${isProtected ? 'bg-accent-yellow' : 'bg-accent-red'}`} />
              
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">:{portInfo.port}</span>
                  <span className="text-gray-500 text-xs px-1.5 py-0.5 bg-dark-700 rounded">
                    {portInfo.protocol}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 truncate">
                  <span className="truncate">{portInfo.process_name}</span>
                  <span className="text-gray-600">PID: {portInfo.pid}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isProtected ? (
                <div className="flex items-center gap-1 text-xs text-accent-yellow">
                  <Icons.ShieldCheck className="w-4 h-4" />
                  <span>Protected</span>
                </div>
              ) : (
                <button
                  onClick={() => onKill(portInfo)}
                  disabled={isKilling}
                  className={`btn btn-danger flex items-center gap-1 ${
                    isKilling ? 'opacity-50 cursor-not-allowed' : ''
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
