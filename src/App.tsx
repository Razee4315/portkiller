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
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const footerRef = useRef<HTMLElement>(null)

  // Refs to solve stale closure issues
  const prevPortsRef = useRef<Map<string, PortInfo>>(new Map())
  const stateRef = useRef<AppState | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const changeTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = state }, [state])

  // Stable fetchPorts using refs to avoid stale closures (fixes #1, #5)
  const fetchPorts = useCallback(async () => {
    try {
      const data = await invoke<AppState>('get_listening_ports')
      const prevPorts = prevPortsRef.current
      const hadPorts = prevPorts.size > 0

      // Track changes only after first successful load
      if (hadPorts) {
        const newChanges = new Map<string, ChangeState>()
        const currentKeys = new Set(data.ports.map(p => `${p.port}-${p.pid}`))

        // Find new ports
        data.ports.forEach(p => {
          const key = `${p.port}-${p.pid}`
          if (!prevPorts.has(key)) {
            newChanges.set(key, 'new')
            // Clear 'new' state after 3s with tracked timer (fixes #2)
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

        // Find removed ports
        prevPorts.forEach((_, key) => {
          if (!currentKeys.has(key)) {
            newChanges.set(key, 'removed')
          }
        })

        if (newChanges.size > 0) {
          setPortChanges(prev => new Map([...prev, ...newChanges]))
        }
      }

      // Update ref (not state) for prev ports - avoids re-render cascade
      prevPortsRef.current = new Map(data.ports.map(p => [`${p.port}-${p.pid}`, p]))
      setState(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, []) // No dependencies - uses refs for mutable state

  // Polling interval with stable fetchPorts ref (fixes #5)
  useEffect(() => {
    fetchPorts()
    const interval = setInterval(fetchPorts, 2000)
    return () => {
      clearInterval(interval)
      // Clean up all pending change timers (fixes #2)
      changeTimersRef.current.forEach(t => clearTimeout(t))
      changeTimersRef.current.clear()
    }
  }, [fetchPorts])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Hide on focus loss (click outside the window)
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

  // Ref for filteredPorts to avoid stale closure in keyboard handler (fixes #3)
  const filteredPortsRef = useRef<PortInfo[]>([])

  // Fuzzy filtered and sorted ports
  const filteredPorts = useMemo(() => {
    if (!state?.ports) return []
    if (!searchQuery) return state.ports

    return state.ports
      .map(p => ({ port: p, score: fuzzyMatch(searchQuery, p) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ port }) => port)
  }, [state?.ports, searchQuery])

  // Keep ref in sync with computed value
  useEffect(() => { filteredPortsRef.current = filteredPorts }, [filteredPorts])

  // Memoized port map for O(1) lookups instead of O(n) per common port (fixes #8)
  const portMap = useMemo(() => {
    const map = new Map<number, PortInfo>()
    state?.ports.forEach(p => map.set(p.port, p))
    return map
  }, [state?.ports])

  const getCommonPortStatus = useCallback((port: number): PortInfo | undefined => {
    return portMap.get(port)
  }, [portMap])

  // Global keyboard handler using refs for stable access (fixes #3)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Escape to hide
      if (e.key === 'Escape') {
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

      // Focus search with /
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }

      // Navigation with arrow keys
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

      // Kill selected with Enter (when not in input)
      if (e.key === 'Enter' && selectedIndex >= 0 && document.activeElement !== inputRef.current) {
        e.preventDefault()
        const port = ports[selectedIndex]
        if (port) handleKill(port)
        return
      }

      // Delete key to kill selected
      if (e.key === 'Delete' && selectedIndex >= 0) {
        e.preventDefault()
        const port = ports[selectedIndex]
        if (port) handleKill(port)
        return
      }

      // Ctrl+A to select all
      if (e.ctrlKey && e.key === 'a' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        setSelectedPorts(new Set(ports.map(p => `${p.port}-${p.pid}`)))
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, contextMenu, detailsPort, showSettings])

  // Scroll selected into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-port-item]')
      items[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  // Toast with proper timer cleanup (fixes #6)
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    // Clear previous timer to prevent premature dismissal
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

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Command palette execution
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
    if (trimmed.startsWith('kill ')) {
      const portNum = parseInt(trimmed.slice(5), 10)
      const currentState = stateRef.current
      if (!isNaN(portNum) && currentState) {
        const portInfo = currentState.ports.find(p => p.port === portNum)
        if (portInfo) {
          handleKill(portInfo)
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
  }, [fetchPorts, showToast])

  const handleKill = useCallback(async (portInfo: PortInfo) => {
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
  }, [fetchPorts, showToast])

  // Parallel bulk kill using Promise.allSettled (fixes #7)
  const handleBulkKill = useCallback(async () => {
    const portsToKill = filteredPortsRef.current.filter(p =>
      selectedPorts.has(`${p.port}-${p.pid}`) && !p.is_protected
    )

    if (portsToKill.length === 0) {
      showToast('No killable ports selected', 'error')
      return
    }

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

  // Consolidated arrow key handling from input (fixes #13)
  const handleInputKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Try command first
      if (executeCommand(searchQuery)) {
        setSearchQuery('')
        return
      }

      // Then try port number
      const portNum = parseInt(searchQuery, 10)
      const currentState = stateRef.current
      if (!isNaN(portNum) && currentState) {
        const portInfo = currentState.ports.find(p => p.port === portNum)
        if (portInfo) {
          handleKill(portInfo)
        } else {
          showToast(`Port ${portNum} is not in use`, 'error')
        }
      }
    }

    // Arrow down to navigate into list
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(0)
      inputRef.current?.blur()
    }
  }, [searchQuery, executeCommand, handleKill, showToast])

  const handlePortClick = useCallback((port: PortInfo, e: MouseEvent) => {
    const key = `${port.port}-${port.pid}`

    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedPorts(prev => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    } else if (e.shiftKey && selectedIndex >= 0) {
      // Range selection
      const ports = filteredPortsRef.current
      const currentIdx = ports.findIndex(p => `${p.port}-${p.pid}` === key)
      const start = Math.min(selectedIndex, currentIdx)
      const end = Math.max(selectedIndex, currentIdx)
      const range = ports.slice(start, end + 1).map(p => `${p.port}-${p.pid}`)
      setSelectedPorts(new Set(range))
    } else {
      // Single selection
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

  // Window dragging via native DOM listeners (bypasses Preact's synthetic events)
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
              onClick={handleBulkKill}
              className="btn btn-danger text-[10px] flex items-center gap-1 ml-2 py-1 pointer-events-auto"
            >
              <Icons.Trash className="w-3 h-3" />
              Kill {selectedPorts.size}
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
              title="Restart as Administrator"
            >
              <Icons.Shield className="w-3 h-3" />
              Admin
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-md hover:bg-dark-600 text-gray-300 hover:text-white transition-colors"
            title="Settings"
          >
            <Icons.Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={async () => await appWindow.hide()}
            className="p-1.5 rounded-md hover:bg-dark-600 text-gray-300 hover:text-white transition-colors"
            title="Minimize to tray"
          >
            <Icons.Minimize className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={async () => await appWindow.hide()}
            className="p-1.5 rounded-md hover:bg-accent-red/20 text-gray-300 hover:text-accent-red transition-colors"
            title="Close"
          >
            <Icons.Kill className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Search bar */}
      <div className="px-3 py-3 border-b border-dark-500">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search ports, processes, or type a command..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            onKeyDown={handleInputKeyDown}
            className="input-field pl-9"
            autoFocus
          />
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white transition-colors"
            >
              <Icons.Kill className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Common ports grid */}
      <div className="px-3 py-3 border-b border-dark-500">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-gray-300 text-[10px] font-medium uppercase tracking-widest">Common Ports</span>
          <span className="text-gray-400 text-[10px]">{state?.ports.length || 0} listening</span>
        </div>
        <PortGrid
          commonPorts={allPorts}
          getPortStatus={getCommonPortStatus}
          onKill={handleKill}
          killingPort={killingPort}
        />
      </div>

      {/* Port list */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-dark-600 flex items-center justify-between">
          <span className="text-gray-300 text-[10px] font-medium uppercase tracking-widest">
            {searchQuery ? 'Search Results' : 'All Listening Ports'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('json')}
              className="text-gray-400 hover:text-white text-[10px] uppercase tracking-wider transition-colors px-1.5 py-0.5"
              title="Copy as JSON"
            >
              JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="text-gray-400 hover:text-white text-[10px] uppercase tracking-wider transition-colors px-1.5 py-0.5"
              title="Copy as CSV"
            >
              CSV
            </button>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Icons.Spinner className="w-5 h-5 text-white animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Icons.Warning className="w-6 h-6 text-accent-yellow mb-2" />
              <p className="text-white text-xs">{error}</p>
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
            </div>
          ) : (
            <PortList
              ports={filteredPorts}
              onKill={handleKill}
              killingPort={killingPort}
              selectedIndex={selectedIndex}
              selectedPorts={selectedPorts}
              portChanges={portChanges}
              onPortClick={handlePortClick}
              onContextMenu={handleContextMenu}
              onShowDetails={setDetailsPort}
            />
          )}
        </div>
      </div>

      {/* Footer status bar */}
      {state && (
        <footer
          ref={footerRef}
          data-tauri-drag-region
          className="px-3 py-1.5 border-t border-dark-500 flex items-center justify-between text-[10px] text-gray-400 bg-black select-none cursor-grab active:cursor-grabbing"
        >
          <span>{state.ports.length} port{state.ports.length !== 1 ? 's' : ''} active</span>
          <span>Alt+P to toggle</span>
        </footer>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {detailsPort && (
        <DetailsPanel
          port={detailsPort}
          onClose={() => setDetailsPort(null)}
          onKill={handleKill}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          port={contextMenu.port}
          onClose={() => setContextMenu(null)}
          onKill={handleKill}
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
