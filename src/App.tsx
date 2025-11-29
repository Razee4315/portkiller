import { useState, useEffect, useCallback, useRef } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/tauri'
import { appWindow } from '@tauri-apps/api/window'
import type { AppState, PortInfo, KillResult } from './types'
import { COMMON_PORTS } from './types'
import { Icons } from './components/Icons'
import { PortGrid } from './components/PortGrid'
import { PortList } from './components/PortList'
import { Toast } from './components/Toast'

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [killingPort, setKillingPort] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchPorts = useCallback(async () => {
    try {
      const data = await invoke<AppState>('get_listening_ports')
      setState(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPorts()
    const interval = setInterval(fetchPorts, 2000)
    return () => clearInterval(interval)
  }, [fetchPorts])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        await appWindow.hide()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleKill = async (portInfo: PortInfo) => {
    if (portInfo.is_protected) {
      showToast(`Cannot kill protected process: ${portInfo.process_name}`, 'error')
      return
    }

    setKillingPort(portInfo.port)
    try {
      const result = await invoke<KillResult>('kill_process', {
        pid: portInfo.pid,
        port: portInfo.port,
        processName: portInfo.process_name,
      })
      
      if (result.success) {
        showToast(result.message, 'success')
        setTimeout(fetchPorts, 500)
      } else {
        showToast(result.message, 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setKillingPort(null)
      setSearchQuery('')
    }
  }

  const handleRestartAsAdmin = async () => {
    try {
      showToast('Restarting as Administrator...', 'success')
      await invoke('restart_as_admin')
    } catch (err) {
      showToast('Failed to restart as admin: ' + (err instanceof Error ? err.message : String(err)), 'error')
    }
  }

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const portNum = parseInt(searchQuery, 10)
      if (!isNaN(portNum) && state) {
        const portInfo = state.ports.find(p => p.port === portNum)
        if (portInfo) {
          handleKill(portInfo)
        } else {
          showToast(`Port ${portNum} is not in use`, 'error')
        }
      }
    }
  }

  const filteredPorts = state?.ports.filter(p => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      p.port.toString().includes(query) ||
      p.process_name.toLowerCase().includes(query) ||
      p.pid.toString().includes(query)
    )
  }) || []

  const getCommonPortStatus = (port: number): PortInfo | undefined => {
    return state?.ports.find(p => p.port === port)
  }

  return (
    <div className="h-full bg-dark-800/95 backdrop-blur-sm rounded-xl border border-dark-500 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
      <header className="flex items-center justify-between px-4 py-3 border-b border-dark-600 bg-dark-900/50">
        <div className="flex items-center gap-2">
          <Icons.Logo className="w-5 h-5 text-accent-red" />
          <span className="text-white font-semibold text-sm">PortKiller</span>
        </div>
        <div className="flex items-center gap-2">
          {state?.is_admin ? (
            <span className="text-xs text-accent-green flex items-center gap-1">
              <Icons.ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </span>
          ) : (
            <button
              onClick={handleRestartAsAdmin}
              className="btn btn-ghost text-xs flex items-center gap-1 text-accent-yellow"
              title="Restart as Administrator to kill protected processes"
            >
              <Icons.Shield className="w-3.5 h-3.5" />
              <span>Run as Admin</span>
            </button>
          )}
          <span className="text-gray-500 text-xs">Esc to hide</span>
        </div>
      </header>

      <div className="p-4 border-b border-dark-600">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type port number to kill..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            onKeyDown={handleInputKeyDown}
            className="input-field pl-10"
            autoFocus
          />
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        </div>
      </div>

      <div className="p-4 border-b border-dark-600">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Common Ports</span>
          <span className="text-gray-500 text-xs">{state?.ports.length || 0} listening</span>
        </div>
        <PortGrid
          commonPorts={COMMON_PORTS}
          getPortStatus={getCommonPortStatus}
          onKill={handleKill}
          killingPort={killingPort}
        />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-dark-700">
          <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
            {searchQuery ? 'Search Results' : 'All Listening Ports'}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Icons.Spinner className="w-6 h-6 text-gray-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Icons.Warning className="w-8 h-8 text-accent-yellow mb-2" />
              <p className="text-gray-400 text-sm">{error}</p>
              <button onClick={fetchPorts} className="btn btn-ghost mt-2">
                Retry
              </button>
            </div>
          ) : filteredPorts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Icons.Empty className="w-8 h-8 text-gray-600 mb-2" />
              <p className="text-gray-500 text-sm">
                {searchQuery ? 'No matching ports found' : 'No listening ports detected'}
              </p>
            </div>
          ) : (
            <PortList
              ports={filteredPorts}
              onKill={handleKill}
              killingPort={killingPort}
            />
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
