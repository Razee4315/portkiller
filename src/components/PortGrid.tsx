import type { JSX } from 'preact'
import type { PortInfo, CommonPort } from '../types'
import { portKey } from '../lib/ports'
import { Icons } from './Icons'

interface PortGridProps {
  commonPorts: CommonPort[]
  /** The process to act on for each common port that is in use. */
  owners: Map<number, PortInfo>
  onKill: (portInfo: PortInfo) => void
  killingKeys: Set<string>
  pendingKill: string | null
}

export function PortGrid({ commonPorts, owners, onKill, killingKeys, pendingKill }: PortGridProps): JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-0.5 -m-0.5">
      {commonPorts.map((cp) => {
        const portInfo = owners.get(cp.port)
        const key = portInfo ? portKey(portInfo) : null
        const isUsed = !!portInfo
        const isKilling = key !== null && killingKeys.has(key)
        const isProtected = portInfo?.is_protected === true
        const isPending = key !== null && pendingKill === key
        const name = portInfo?.process_name ?? ''

        return (
          <button
            key={cp.port}
            onClick={() => portInfo && onKill(portInfo)}
            disabled={!isUsed || isKilling || isProtected}
            aria-label={
              isPending
                ? `Confirm kill on port ${cp.port}`
                : isProtected
                ? `Port ${cp.port}: protected, ${name}`
                : isUsed
                ? `Kill ${name} on port ${cp.port}`
                : `Port ${cp.port}: free, ${cp.description}`
            }
            className={`port-card group ${isUsed ? 'port-card-used' : 'port-card-free'} ${
              isProtected ? 'cursor-not-allowed' : ''
            } ${isKilling ? 'animate-pulse' : ''} ${isPending ? 'ring-1 ring-accent-red/60 animate-pulse' : ''}`}
            title={
              isPending
                ? 'Click again to confirm kill'
                : isProtected
                ? `Protected: ${name}`
                : isUsed
                ? `Kill ${name} (PID ${portInfo?.pid})`
                : 'Port is free'
            }
          >
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5">
                <Icons.Dot className={`w-1.5 h-1.5 ${isUsed ? 'text-accent-red' : 'text-accent-green/40'}`} />
                <span className={`text-xs font-mono font-semibold ${isUsed ? 'text-white' : 'text-gray-300'}`}>
                  {cp.label}
                </span>
              </div>
              <span className={`text-[10px] truncate max-w-full ${isPending ? 'text-accent-red' : isUsed ? 'text-gray-300' : 'text-gray-400'}`}>
                {isPending ? 'Confirm?' : isUsed ? name.replace(/\.exe$/i, '') : cp.description}
              </span>
            </div>
            {/* Always visible on a used card: clicking it kills, so say so. */}
            {isUsed && !isProtected && (
              <div className="absolute top-1 right-1 opacity-60 group-hover:opacity-100 transition-opacity">
                {isPending
                  ? <Icons.Warning className="w-3 h-3 text-accent-red" />
                  : <Icons.Trash className="w-3 h-3 text-accent-red" />}
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
