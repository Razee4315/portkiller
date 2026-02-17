import { useState, useEffect, useCallback, useRef, useMemo } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/tauri'
import { appWindow } from '@tauri-apps/api/window'
import type { AppState, PortInfo, KillResult, ChangeState } from './types'
import { COMMON_PORTS, loadCustomPorts, saveCustomPorts } from './types'
import { Icons } from './components/Icons'
import { PortGrid } from './components/PortGrid'
import { PortList } from './components/PortList'
import { Toast } from './components/Toast'
import { DetailsPanel } from './components/DetailsPanel'
import { ContextMenu } from './components/ContextMenu'
import { SettingsPanel } from './components/SettingsPanel'

// Fuzzy search scoring
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t.includes(q)) return 100 + (q.length / t.length) * 50
  let score = 0, qIdx = 0
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) { score += 10; qIdx++ }
  }
  return qIdx === q.length ? score : 0
}

function fuzzyMatch(query: string, port: PortInfo): number {
  const scores = [
    fuzzyScore(query, port.port.toString()) * 2,
    fuzzyScore(query, port.process_name),
    fuzzyScore(query, port.pid.toString()),
  ]
  return Math.max(...scores)
}

// Format relative time for "last updated" display
function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 2) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

// Provide actionable error guidance (H9)
function formatErrorMessage(err: unknown, isAdmin: boolean): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Access is denied') || msg.includes('os error 5')) {
    return isAdmin
      ? 'Access denied even as Admin. This process is protected by the OS.'
      : 'Access denied. Try running as Administrator (type "admin").'
  }
  if (msg.includes('process has exited') || msg.includes('not found')) {
    return 'Process has already exited. Refreshing port list...'
  }
  return msg
}

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [portChanges, setPortChanges] = useState<Map<string, ChangeState>>(new Map())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [killingPort, setKillingPort] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [selectedPorts, setSelectedPorts] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [detailsPort, setDetailsPort] = useState<PortInfo | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; port: PortInfo } | null>(null)
  const [customPorts, setCustomPorts] = useState(loadCustomPorts())
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())
  const [lastUpdatedText, setLastUpdatedText] = useState('...')
  // Kill confirmation state (H5 - Error Prevention)
  const [pendingKill, setPendingKill] = useState<string | null>(null)
  const [pendingBulkKill, setPendingBulkKill] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const footerRef = useRef<HTMLElement>(null)

  // Refs to solve stale closure issues
  const prevPortsRef = useRef<Map<string, PortInfo>>(new Map())
  const stateRef = useRef<AppState | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const changeTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = state }, [state])

  // Update "last updated" text every second
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdatedText(timeAgo(lastUpdated))
    }, 1000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  // Auto-cancel kill confirmation after 3 seconds
  useEffect(() => {
    if (pendingKill || pendingBulkKill) {
      confirmTimerRef.current = setTimeout(() => {
        setPendingKill(null)
        setPendingBulkKill(false)
      }, 3000)
      return () => {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      }
    }
  }, [pendingKill, pendingBulkKill])

  // Stable fetchPorts using refs to avoid stale closures
  const fetchPorts = useCallback(async () => {
    try {
      const data = await invoke<AppState>('get_listening_ports')
      const prevPorts = prevPortsRef.current
      const hadPorts = prevPorts.size > 0

      if (hadPorts) {
        const newChanges = new Map<string, ChangeState>()
        const currentKeys = new Set(data.ports.map(p => `${p.port}-${p.pid}`))

        data.ports.forEach(p => {
          const key = `${p.port}-${p.pid}`
          if (!prevPorts.has(key)) {
            newChanges.set(key, 'new')
            const timer = setTimeout(() => {
              changeTimersRef.current.delete(timer)
              setPortChanges(prev => {
                const next = new Map(prev)
                next.delete(key)
                return next
              })
            }, 3000)
            changeTimersRef.current.add(timer)
          }
        })

        prevPorts.forEach((_, key) => {
          if (!currentKeys.has(key)) {
            newChanges.set(key, 'removed')
          }
        })

        if (newChanges.size > 0) {
          setPortChanges(prev => new Map([...prev, ...newChanges]))
        }
      }

      prevPortsRef.current = new Map(data.ports.map(p => [`${p.port}-${p.pid}`, p]))
      setState(data)
      setError(null)
      setLastUpdated(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPorts()
    const interval = setInterval(fetchPorts, 2000)
    return () => {
      clearInterval(interval)
      changeTimersRef.current.forEach(t => clearTimeout(t))
      changeTimersRef.current.clear()
    }
  }, [fetchPorts])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Hide on focus loss
  useEffect(() => {
    let mounted = true
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused && mounted) {
        setContextMenu(null)
        setDetailsPort(null)
        setShowSettings(false)
        appWindow.hide()
      }
    })
    return () => {
      mounted = false
      unlisten.then(fn => fn())
    }
  }, [])

  const filteredPortsRef = useRef<PortInfo[]>([])

  const filteredPorts = useMemo(() => {
    if (!state?.ports) return []
    if (!searchQuery) return state.ports

    return state.ports
      .map(p => ({ port: p, score: fuzzyMatch(searchQuery, p) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ port }) => port)
  }, [state?.ports, searchQuery])

  useEffect(() => { filteredPortsRef.current = filteredPorts }, [filteredPorts])

  const portMap = useMemo(() => {
    const map = new Map<number, PortInfo>()
    state?.ports.forEach(p => map.set(p.port, p))
    return map
  }, [state?.ports])

  const getCommonPortStatus = useCallback((port: number): PortInfo | undefined => {
    return portMap.get(port)
  }, [portMap])

  // Global keyboard handler
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel any pending confirmations first
        if (pendingKill || pendingBulkKill) {
          setPendingKill(null)
          setPendingBulkKill(false)
          return
        }
        if (contextMenu) {
          setContextMenu(null)
          return
        }
        if (detailsPort) {
          setDetailsPort(null)
          return
        }
        if (showSettings) {
          setShowSettings(false)
          return
        }
        e.preventDefault()
        await appWindow.hide()
        return
      }

      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }

      const ports = filteredPortsRef.current
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, ports.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        return
      }

      if (e.key === 'Enter' && selectedIndex >= 0 && document.activeElement !== inputRef.current) {
        e.preventDefault()
        const port = ports[selectedIndex]
        if (port) requestKill(port)
        return
      }

      if (e.key === 'Delete' && selectedIndex >= 0) {
        e.preventDefault()
        const port = ports[selectedIndex]
        if (port) requestKill(port)
        return
      }

      if (e.ctrlKey && e.key === 'a' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        setSelectedPorts(new Set(ports.map(p => `${p.port}-${p.pid}`)))
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, contextMenu, detailsPort, showSettings, pendingKill, pendingBulkKill])

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-port-item]')
      items[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    setToast({ message, type })
    const duration = type === 'error' ? 5000 : 3000
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, duration)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Kill with confirmation (H5 - Error Prevention)
  const requestKill = useCallback((portInfo: PortInfo) => {
    if (portInfo.is_protected) {
      showToast(`Cannot kill protected process: ${portInfo.process_name}`, 'error')
      return
    }
    const key = `${portInfo.port}-${portInfo.pid}`
    if (pendingKill === key) {
      // Second click = confirmed
      executeKill(portInfo)
      setPendingKill(null)
    } else {
      // First click = request confirmation
      setPendingKill(key)
    }
  }, [pendingKill, showToast])

  const executeKill = useCallback(async (portInfo: PortInfo) => {
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
        showToast(formatErrorMessage(result.message, state?.is_admin ?? false), 'error')
      }
    } catch (err) {
      showToast(formatErrorMessage(err, state?.is_admin ?? false), 'error')
      // If process not found, auto-refresh
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('not found') || msg.includes('exited')) {
        setTimeout(fetchPorts, 500)
      }
    } finally {
      setKillingPort(null)
      setSearchQuery('')
    }
  }, [fetchPorts, showToast, state?.is_admin])

  // Bulk kill with confirmation
  const requestBulkKill = useCallback(() => {
    const portsToKill = filteredPortsRef.current.filter(p =>
      selectedPorts.has(`${p.port}-${p.pid}`) && !p.is_protected
    )

    if (portsToKill.length === 0) {
      showToast('No killable ports selected', 'error')
      return
    }

    if (pendingBulkKill) {
      executeBulkKill()
      setPendingBulkKill(false)
    } else {
      setPendingBulkKill(true)
    }
  }, [selectedPorts, pendingBulkKill, showToast])

  const executeBulkKill = useCallback(async () => {
    const portsToKill = filteredPortsRef.current.filter(p =>
      selectedPorts.has(`${p.port}-${p.pid}`) && !p.is_protected
    )

    const results = await Promise.allSettled(
      portsToKill.map(port =>
        invoke<KillResult>('kill_process', {
          pid: port.pid,
          port: port.port,
          processName: port.process_name,
        })
      )
    )

    const killed = results.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length

    showToast(`Killed ${killed}/${portsToKill.length} processes`, killed > 0 ? 'success' : 'error')
    setSelectedPorts(new Set())
    setTimeout(fetchPorts, 500)
  }, [selectedPorts, fetchPorts, showToast])

  const handleRestartAsAdmin = useCallback(async () => {
    try {
      showToast('Restarting as Administrator...', 'success')
      await invoke('restart_as_admin')
    } catch (err) {
      showToast('Failed to restart as admin: ' + (err instanceof Error ? err.message : String(err)), 'error')
    }
  }, [showToast])

  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    const currentState = stateRef.current
    if (!currentState) return

    let content: string
    if (format === 'json') {
      content = JSON.stringify(currentState.ports, null, 2)
    } else {
      const headers = 'Port,PID,Protocol,Process,Path,Protected'
      const rows = currentState.ports.map(p =>
        `${p.port},${p.pid},${p.protocol},"${p.process_name}","${p.process_path}",${p.is_protected}`
      )
      content = [headers, ...rows].join('\n')
    }

    await navigator.clipboard.writeText(content)
    showToast(`Copied ${currentState.ports.length} ports as ${format.toUpperCase()}`, 'success')
  }, [showToast])

  const executeCommand = useCallback((cmd: string): boolean => {
    const trimmed = cmd.trim().toLowerCase()

    if (trimmed === 'admin' || trimmed === 'sudo') {
      handleRestartAsAdmin()
      return true
    }
    if (trimmed === 'refresh' || trimmed === 'r') {
      fetchPorts()
      showToast('Refreshed port list', 'success')
      return true
    }
    if (trimmed === 'clear' || trimmed === 'c') {
      setSearchQuery('')
      setSelectedPorts(new Set())
      return true
    }
    if (trimmed === 'settings' || trimmed === 'config') {
      setShowSettings(true)
      return true
    }
    if (trimmed === 'help' || trimmed === '?') {
      showToast('Commands: admin, refresh, clear, settings, kill [port], export [json|csv]', 'success')
      return true
    }
    if (trimmed.startsWith('kill ')) {
      const portNum = parseInt(trimmed.slice(5), 10)
      const currentState = stateRef.current
      if (!isNaN(portNum) && currentState) {
        const portInfo = currentState.ports.find(p => p.port === portNum)
        if (portInfo) {
          requestKill(portInfo)
          return true
        }
        showToast(`Port ${portNum} is not in use`, 'error')
        return true
      }
    }
    if (trimmed.startsWith('export')) {
      handleExport(trimmed.includes('csv') ? 'csv' : 'json')
      return true
    }

    return false
  }, [fetchPorts, showToast, handleRestartAsAdmin, handleExport, requestKill])

  const handleInputKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (executeCommand(searchQuery)) {
        setSearchQuery('')
        return
      }

      const portNum = parseInt(searchQuery, 10)
      const currentState = stateRef.current
      if (!isNaN(portNum) && currentState) {
        const portInfo = currentState.ports.find(p => p.port === portNum)
        if (portInfo) {
          requestKill(portInfo)
        } else {
          showToast(`Port ${portNum} is not in use`, 'error')
        }
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(0)
      inputRef.current?.blur()
    }
  }, [searchQuery, executeCommand, requestKill, showToast])

  const handlePortClick = useCallback((port: PortInfo, e: MouseEvent) => {
    const key = `${port.port}-${port.pid}`

    if (e.ctrlKey || e.metaKey) {
      setSelectedPorts(prev => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    } else if (e.shiftKey && selectedIndex >= 0) {
      const ports = filteredPortsRef.current
      const currentIdx = ports.findIndex(p => `${p.port}-${p.pid}` === key)
      const start = Math.min(selectedIndex, currentIdx)
      const end = Math.max(selectedIndex, currentIdx)
      const range = ports.slice(start, end + 1).map(p => `${p.port}-${p.pid}`)
      setSelectedPorts(new Set(range))
    } else {
      setSelectedPorts(new Set([key]))
      setSelectedIndex(filteredPortsRef.current.findIndex(p => `${p.port}-${p.pid}` === key))
    }
  }, [selectedIndex])

  const handleContextMenu = useCallback((port: PortInfo, e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, port })
  }, [])

  const allPorts = useMemo(() =>
    customPorts.length > 0 ? customPorts : COMMON_PORTS
  , [customPorts])

  useEffect(() => {
    const handleDrag = (e: Event) => {
      if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return
      e.preventDefault()
      appWindow.startDragging()
    }
    const header = headerRef.current
    const footer = footerRef.current
    header?.addEventListener('mousedown', handleDrag)
    footer?.addEventListener('mousedown', handleDrag)
    return () => {
      header?.removeEventListener('mousedown', handleDrag)
      footer?.removeEventListener('mousedown', handleDrag)
    }
  }, [])

  return (
    <div className="h-full bg-dark-900 rounded-xl border border-dark-500 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
      {/* Draggable title bar with window controls */}
      <header
        ref={headerRef}
        data-tauri-drag-region
        className="flex items-center justify-between px-3 py-2 border-b border-dark-500 bg-black select-none cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 pointer-events-none">
          <Icons.Logo className="w-5 h-5 text-white flex-shrink-0" />
          <span className="text-white font-medium text-[11px] tracking-widest uppercase">
            PortKiller
          </span>
          {selectedPorts.size > 1 && (
            <button
              onClick={requestBulkKill}
              className={`btn text-[10px] flex items-center gap-1 ml-2 py-1 pointer-events-auto ${
                pendingBulkKill ? 'btn-danger animate-pulse' : 'btn-danger'
              }`}
              aria-label={pendingBulkKill ? `Confirm killing ${selectedPorts.size} processes` : `Kill ${selectedPorts.size} processes`}
            >
              <Icons.Trash className="w-3 h-3" />
              {pendingBulkKill ? `Confirm Kill ${selectedPorts.size}?` : `Kill ${selectedPorts.size}`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 pointer-events-auto">
          {state?.is_admin ? (
            <span className="text-[10px] text-accent-green flex items-center gap-1 mr-1.5 px-1.5 py-0.5 rounded bg-accent-green/10">
              <Icons.ShieldCheck className="w-3 h-3" />
              Admin
            </span>
          ) : (
            <button
              onClick={handleRestartAsAdmin}
              className="text-[10px] text-accent-yellow flex items-center gap-1 mr-1.5 px-1.5 py-0.5 rounded hover:bg-accent-yellow/10 transition-colors"
              title="Restart as Administrator for full control"
              aria-label="Restart as Administrator"
            >
              <Icons.Shield className="w-3 h-3" />
              Admin
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-md hover:bg-dark-600 text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
            title="Settings"
            aria-label="Open settings"
          >
            <Icons.Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={async () => await appWindow.hide()}
            className="p-1.5 rounded-md hover:bg-dark-600 text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
            title="Minimize to tray"
            aria-label="Minimize to tray"
          >
            <Icons.Minimize className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={async () => await appWindow.hide()}
            className="p-1.5 rounded-md hover:bg-accent-red/20 text-gray-300 hover:text-accent-red transition-colors focus:outline-none focus:ring-2 focus:ring-accent-red/40"
            title="Close"
            aria-label="Close window"
          >
            <Icons.Kill className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Search bar */}
      <nav className="px-3 py-3 border-b border-dark-500">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder='Search or command (type "help" for commands)...'
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            onKeyDown={handleInputKeyDown}
            className="input-field pl-9"
            autoFocus
            aria-label="Search ports and processes, or type a command"
            role="combobox"
            aria-expanded="false"
            aria-autocomplete="list"
          />
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" aria-hidden="true" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white transition-colors focus:outline-none focus:text-white"
              aria-label="Clear search"
            >
              <Icons.Kill className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </nav>

      {/* Common ports grid */}
      <section className="px-3 py-3 border-b border-dark-500" aria-label="Common ports">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-gray-300 text-[10px] font-medium uppercase tracking-widest">Common Ports</span>
          <span className="text-gray-400 text-[10px]">{state?.ports.length || 0} listening</span>
        </div>
        <PortGrid
          commonPorts={allPorts}
          getPortStatus={getCommonPortStatus}
          onKill={requestKill}
          killingPort={killingPort}
          pendingKill={pendingKill}
        />
      </section>

      {/* Port list */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-dark-600 flex items-center justify-between">
          <span className="text-gray-300 text-[10px] font-medium uppercase tracking-widest">
            {searchQuery ? 'Search Results' : 'All Listening Ports'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('json')}
              className="text-gray-400 hover:text-white text-[10px] uppercase tracking-wider transition-colors px-1.5 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
              title="Copy as JSON"
              aria-label="Export ports as JSON to clipboard"
            >
              JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="text-gray-400 hover:text-white text-[10px] uppercase tracking-wider transition-colors px-1.5 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
              title="Copy as CSV"
              aria-label="Export ports as CSV to clipboard"
            >
              CSV
            </button>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32" role="status" aria-label="Loading ports">
              <Icons.Spinner className="w-5 h-5 text-white animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-32 text-center" role="alert">
              <Icons.Warning className="w-6 h-6 text-accent-yellow mb-2" />
              <p className="text-white text-xs">{error}</p>
              {!state?.is_admin && error.includes('denied') && (
                <p className="text-gray-400 text-[10px] mt-1">Try running as Administrator</p>
              )}
              <button onClick={fetchPorts} className="btn btn-ghost mt-2 text-xs">
                Retry
              </button>
            </div>
          ) : filteredPorts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Icons.Empty className="w-6 h-6 text-gray-300 mb-2" />
              <p className="text-gray-300 text-xs">
                {searchQuery ? 'No matching ports found' : 'No listening ports detected'}
              </p>
              {searchQuery && (
                <p className="text-gray-500 text-[10px] mt-1">Try a different search term or type "clear"</p>
              )}
            </div>
          ) : (
            <PortList
              ports={filteredPorts}
              onKill={requestKill}
              killingPort={killingPort}
              selectedIndex={selectedIndex}
              selectedPorts={selectedPorts}
              portChanges={portChanges}
              pendingKill={pendingKill}
              onPortClick={handlePortClick}
              onContextMenu={handleContextMenu}
              onShowDetails={setDetailsPort}
            />
          )}
        </div>
      </main>

      {/* Footer status bar with refresh indicator and shortcuts */}
      {state && (
        <footer
          ref={footerRef}
          data-tauri-drag-region
          className="px-3 py-1.5 border-t border-dark-500 flex items-center justify-between text-[10px] text-gray-400 bg-black select-none cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
            <span>{state.ports.length} port{state.ports.length !== 1 ? 's' : ''}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-500" title="Last refreshed">{lastUpdatedText}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600" title="Press / to search">/</span>
            <span className="text-gray-600" title="Press Alt+P to toggle window">Alt+P</span>
          </div>
        </footer>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {detailsPort && (
        <DetailsPanel
          port={detailsPort}
          onClose={() => setDetailsPort(null)}
          onKill={requestKill}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          port={contextMenu.port}
          onClose={() => setContextMenu(null)}
          onKill={requestKill}
          onShowDetails={setDetailsPort}
        />
      )}

      {showSettings && (
        <SettingsPanel
          customPorts={customPorts}
          onSave={(ports) => {
            setCustomPorts(ports)
            saveCustomPorts(ports)
            setShowSettings(false)
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
