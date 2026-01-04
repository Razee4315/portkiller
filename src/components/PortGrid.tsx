import type { JSX } from 'preact'
import type { PortInfo, CommonPort } from '../types'
import { Icons } from './Icons'

interface PortGridProps {
  commonPorts: CommonPort[]
  getPortStatus: (port: number) => PortInfo | undefined
  onKill: (portInfo: PortInfo) => void
  killingPort: number | null
}

export function PortGrid({ commonPorts, getPortStatus, onKill, killingPort }: PortGridProps): JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-2">
      {commonPorts.map((cp) => {
        const portInfo = getPortStatus(cp.port)
        const isUsed = !!portInfo
        const isKilling = killingPort === cp.port
        const isProtected = portInfo?.is_protected

        return (
          <button
            key={cp.port}
            onClick={() => portInfo && onKill(portInfo)}
            disabled={!isUsed || isKilling || isProtected}
            className={`port-card group ${isUsed ? 'port-card-used' : 'port-card-free'} ${
              isProtected ? 'cursor-not-allowed' : ''
            } ${isKilling ? 'animate-pulse' : ''}`}
            title={
              isProtected
                ? `Protected: ${portInfo?.process_name}`
                : isUsed
                ? `Kill ${portInfo?.process_name} (PID: ${portInfo?.pid})`
                : 'Port is free'
            }
          >
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                {isUsed ? (
                  <Icons.DotUsed className="w-2.5 h-2.5 text-accent-red" />
                ) : (
                  <Icons.DotFree className="w-2.5 h-2.5 text-accent-green opacity-50" />
                )}
                <span className={`text-sm font-semibold ${isUsed ? 'text-white' : 'text-gray-500'}`}>
                  {cp.label}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 truncate max-w-full">
                {isUsed ? portInfo?.process_name.replace('.exe', '') : cp.description}
              </span>
            </div>
            {isUsed && !isProtected && (
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Icons.Kill className="w-3 h-3 text-accent-red" />
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
