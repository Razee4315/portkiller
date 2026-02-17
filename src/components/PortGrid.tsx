import type { JSX } from 'preact'
import type { PortInfo, CommonPort } from '../types'
import { Icons } from './Icons'

interface PortGridProps {
  commonPorts: CommonPort[]
  getPortStatus: (port: number) => PortInfo | undefined
  onKill: (portInfo: PortInfo) => void
  killingPort: number | null
  pendingKill?: string | null
}

export function PortGrid({ commonPorts, getPortStatus, onKill, killingPort, pendingKill = null }: PortGridProps): JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto" role="grid" aria-label="Common ports">
      {commonPorts.map((cp) => {
        const portInfo = getPortStatus(cp.port)
        const isUsed = !!portInfo
        const isKilling = killingPort === cp.port
        const isProtected = portInfo?.is_protected
        const isPending = portInfo ? pendingKill === `${portInfo.port}-${portInfo.pid}` : false

        return (
          <button
            key={cp.port}
            onClick={() => portInfo && onKill(portInfo)}
            disabled={!isUsed || isKilling || isProtected}
            aria-label={
              isPending
                ? `Confirm kill on port ${cp.port}`
                : isProtected
                ? `Port ${cp.port}: protected, ${portInfo?.process_name}`
                : isUsed
                ? `Kill ${portInfo?.process_name} on port ${cp.port}`
                : `Port ${cp.port}: free, ${cp.description}`
            }
            className={`port-card group ${isUsed ? 'port-card-used' : 'port-card-free'} ${
              isProtected ? 'cursor-not-allowed' : ''
            } ${isKilling ? 'animate-pulse' : ''} ${isPending ? 'ring-1 ring-accent-red/60 animate-pulse' : ''}`}
            title={
              isPending
                ? 'Click again to confirm kill'
                : isProtected
                ? `Protected: ${portInfo?.process_name}`
                : isUsed
                ? `Kill ${portInfo?.process_name} (PID: ${portInfo?.pid})`
                : 'Port is free'
            }
          >
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5">
                {isUsed ? (
                  <Icons.DotUsed className="w-1.5 h-1.5 text-accent-red" />
                ) : (
                  <Icons.DotFree className="w-1.5 h-1.5 text-accent-green/40" />
                )}
                <span className={`text-xs font-semibold ${isUsed ? 'text-white' : 'text-gray-300'}`}>
                  {cp.label}
                </span>
              </div>
              <span className={`text-[9px] truncate max-w-full ${isPending ? 'text-accent-red' : isUsed ? 'text-gray-300' : 'text-gray-400'}`}>
                {isPending ? 'Confirm?' : isUsed ? portInfo?.process_name.replace('.exe', '') : cp.description}
              </span>
            </div>
            {isUsed && !isProtected && !isPending && (
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Icons.Kill className="w-3 h-3 text-accent-red" />
              </div>
            )}
            {isPending && (
              <div className="absolute top-1 right-1">
                <Icons.Warning className="w-3 h-3 text-accent-red" />
              </div>
            )}
            {isProtected && (
              <div className="absolute top-1 right-1">
                <Icons.ShieldCheck className="w-3 h-3 text-accent-yellow" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
