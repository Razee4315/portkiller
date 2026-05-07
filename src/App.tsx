import { useState, useEffect, useCallback, useRef, useMemo } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window'

// In v2 there's no global `appWindow` singleton — each component grabs the
// current window via getCurrentWindow(). One module-level call keeps things
// drop-in compatible with the v1 code below.
const appWindow = getCurrentWindow()
import type { AppState, PortInfo, KillResult, ChangeState } from './types'
import {
  COMMON_PORTS,
  loadCustomPorts,
  saveCustomPorts,
  loadPinnedPorts,
  savePinnedPorts,
  loadKillHistory,
  appendKillHistory,
  clearKillHistory,
} from './types'
import type { KillRecord } from './types'
import type { Preferences } from './preferences'
import {
  loadPreferences,
  savePreferences,
  loadWindowState,
  saveWindowState,
  SORT_OPTIONS,
} from './preferences'
import { Icons } from './components/Icons'
import { PortGrid } from './components/PortGrid'
import { PortList } from './components/PortList'
import { Toast } from './components/Toast'
import { DetailsPanel } from './components/DetailsPanel'
import { ContextMenu } from './components/ContextMenu'
import { SettingsPanel } from './components/SettingsPanel'
import { ShortcutsPanel } from './components/ShortcutsPanel'
import { HistoryPanel } from './components/HistoryPanel'

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

// Port-range query: "3000-4000" matches any port in [3000, 4000]. Detected up
// front so we can short-circuit the fuzzy scorer for an exact numeric filter.
function parsePortRange(query: string): [number, number] | null {
  const m = query.trim().match(/^(\d{1,5})\s*-\s*(\d{1,5})$/)
  if (!m) return null
  const lo = parseInt(m[1], 10)
  const hi = parseInt(m[2], 10)
  if (isNaN(lo) || isNaN(hi) || lo > 65535 || hi > 65535) return null
  return lo <= hi ? [lo, hi] : [hi, lo]
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
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [detailsPort, setDetailsPort] = useState<PortInfo | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; port: PortInfo } | null>(null)
  const [customPorts, setCustomPorts] = useState(loadCustomPorts())
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences())
  const [pinnedPorts, setPinnedPorts] = useState<Set<number>>(() => new Set(loadPinnedPorts()))
  const [killHistory, setKillHistory] = useState<KillRecord[]>(() => loadKillHistory())
  const [showHistory, setShowHistory] = useState(false)
  const protocolFilter = preferences.protocolFilter
  const sortMode = preferences.sortMode
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

  // Poll on the user's chosen interval. Pause polling while the window is
  // hidden — wakes up + does an immediate refresh when shown again.
  useEffect(() => {
    fetchPorts()
    const intervalMs = preferences.pollIntervalMs
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (intervalMs > 0 && !timer) {
        timer = setInterval(fetchPorts, intervalMs)
      }
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    start()

    let unlistenPromise: ReturnType<typeof appWindow.onFocusChanged> | null = null
    appWindow.isVisible().then(visible => {
      if (!visible) stop()
    }).catch(() => {})

    unlistenPromise = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        fetchPorts()
        start()
      } else if (!preferences.minimizeOnBlur) {
        // If we're not hiding on blur, polling can keep running so the list is
        // ready when the user comes back. We only pause when truly hidden via
        // visibilitychange (handled below).
      }
    })

    const handleVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        fetchPorts()
        start()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
      unlistenPromise?.then(fn => fn()).catch(() => {})
      changeTimersRef.current.forEach(t => clearTimeout(t))
      changeTimersRef.current.clear()
    }
  }, [fetchPorts, preferences.pollIntervalMs, preferences.minimizeOnBlur])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Optionally hide on focus loss. Off by default — was the single most-disliked
  // behavior in the old build (window vanishing when you clicked outside).
  useEffect(() => {
    if (!preferences.minimizeOnBlur) return
    let mounted = true
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused && mounted) {
        setContextMenu(null)
        appWindow.hide()
      }
    })
    return () => {
      mounted = false
      unlisten.then(fn => fn())
    }
  }, [preferences.minimizeOnBlur])

  // Apply alwaysOnTop pref to the actual window.
  useEffect(() => {
    appWindow.setAlwaysOnTop(preferences.alwaysOnTop).catch(() => {})
  }, [preferences.alwaysOnTop])

  // Window position + size memory. Restore once on mount, persist after each
  // resize / move (debounced via the events themselves — Tauri only fires
  // when the user releases).
  useEffect(() => {
    let cancelled = false
    const saved = loadWindowState()
    if (saved) {
      ;(async () => {
        try {
          await appWindow.setSize(new LogicalSize(saved.width, saved.height))
          await appWindow.setPosition(new LogicalPosition(saved.x, saved.y))
        } catch {
          // Saved geometry invalid (monitor unplugged etc.) — ignore.
        }
      })()
    }

    const persist = async () => {
      if (cancelled) return
      try {
        const size = await appWindow.outerSize()
        const pos = await appWindow.outerPosition()
        const factor = await appWindow.scaleFactor()
        saveWindowState({
          width: size.width / factor,
          height: size.height / factor,
          x: pos.x / factor,
          y: pos.y / factor,
        })
      } catch {
        // ignore
      }
    }

    const unResize = appWindow.onResized(() => { persist() })
    const unMove = appWindow.onMoved(() => { persist() })

    return () => {
      cancelled = true
      unResize.then(fn => fn()).catch(() => {})
      unMove.then(fn => fn()).catch(() => {})
    }
  }, [])

  const updatePreferences = useCallback((next: Partial<Preferences>) => {
    setPreferences(prev => {
      const merged = { ...prev, ...next }
      savePreferences(merged)
      return merged
    })
  }, [])

  const filteredPortsRef = useRef<PortInfo[]>([])

  const filteredPorts = useMemo(() => {
    if (!state?.ports) return []

    // Apply sort first so all downstream filters preserve order.
    const sorted = [...state.ports].sort((a, b) => {
      switch (sortMode) {
        case 'port-desc': return b.port - a.port
        case 'process':
          return a.process_name.localeCompare(b.process_name) || a.port - b.port
        case 'pid':
          return a.pid - b.pid || a.port - b.port
        case 'port-asc':
        default:
          return a.port - b.port
      }
    })

    const byProtocol = protocolFilter === 'all'
      ? sorted
      : sorted.filter(p => p.protocol.toUpperCase() === protocolFilter.toUpperCase())

    const range = searchQuery ? parsePortRange(searchQuery) : null
    const base = !searchQuery
      ? byProtocol
      : range
        ? byProtocol.filter(p => p.port >= range[0] && p.port <= range[1])
        : byProtocol
            .map(p => ({ port: p, score: fuzzyMatch(searchQuery, p) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .map(({ port }) => port)

    // Sticky-sort pinned ports to the top while preserving the inner ordering
    // (search relevance when searching, port number otherwise).
    if (pinnedPorts.size === 0) return base
    const pinned: PortInfo[] = []
    const rest: PortInfo[] = []
    base.forEach(p => (pinnedPorts.has(p.port) ? pinned : rest).push(p))
    return [...pinned, ...rest]
  }, [state?.ports, searchQuery, protocolFilter, sortMode, pinnedPorts])

  const protocolCounts = useMemo(() => {
    const counts = { tcp: 0, udp: 0 }
    state?.ports.forEach(p => {
      const proto = p.protocol.toUpperCase()
      if (proto === 'TCP') counts.tcp++
      else if (proto === 'UDP') counts.udp++
    })
    return counts
  }, [state?.ports])

  useEffect(() => { filteredPortsRef.current = filteredPorts }, [filteredPorts])

  const portMap = useMemo(() => {
    const map = new Map<number, PortInfo>()
    state?.ports.forEach(p => map.set(p.port, p))
    return map
  }, [state?.ports])

  const getCommonPortStatus = useCallback((port: number): PortInfo | undefined => {
    return portMap.get(port)
  }, [portMap])

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

  const togglePin = useCallback((portNumber: number) => {
    setPinnedPorts(prev => {
      const next = new Set(prev)
      if (next.has(portNumber)) next.delete(portNumber)
      else next.add(portNumber)
      savePinnedPorts(Array.from(next))
      return next
    })
  }, [])

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
        if (showShortcuts) {
          setShowShortcuts(false)
          return
        }
        if (showHistory) {
          setShowHistory(false)
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
        if (searchQuery) {
          e.preventDefault()
          setSearchQuery('')
          setSelectedIndex(-1)
          inputRef.current?.focus()
          return
        }
        if (selectedPorts.size > 0) {
          setSelectedPorts(new Set())
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

      // Open the keyboard cheatsheet with `?` (Shift+/), but only when the
      // search bar isn't focused so users can still type "?" in commands.
      if (e.key === '?' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        setShowShortcuts(s => !s)
        return
      }

      const ports = filteredPortsRef.current
      const isInputFocused = document.activeElement === inputRef.current
      if (e.key === 'ArrowDown' || (e.key === 'j' && !isInputFocused && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, ports.length - 1))
        return
      }
      if (e.key === 'ArrowUp' || (e.key === 'k' && !isInputFocused && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        return
      }

      // p — pin/unpin the currently-selected port
      if (e.key === 'p' && !isInputFocused && !e.ctrlKey && !e.metaKey && selectedIndex >= 0) {
        e.preventDefault()
        const port = ports[selectedIndex]
        if (port) togglePin(port.port)
        return
      }

      // h — open the kill-history panel from anywhere outside the search box
      if (e.key === 'h' && !isInputFocused && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShowHistory(s => !s)
        return
      }

      // Ctrl+C with a port selected (and search not focused) — copy "port:pid"
      if (e.ctrlKey && e.key === 'c' && !isInputFocused && selectedIndex >= 0) {
        const port = ports[selectedIndex]
        if (port) {
          e.preventDefault()
          navigator.clipboard.writeText(`${port.port}:${port.pid}`)
          showToast(`Copied ${port.port}:${port.pid}`, 'success')
          return
        }
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
  }, [selectedIndex, contextMenu, detailsPort, showSettings, showShortcuts, showHistory, pendingKill, pendingBulkKill, searchQuery, selectedPorts, togglePin, showToast])

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-port-item]')
      items[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])


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
        setKillHistory(prev => appendKillHistory({
          port: portInfo.port,
          pid: portInfo.pid,
          processName: portInfo.process_name,
          timestamp: Date.now(),
        }, prev))
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
      // Don't clobber the user's search filter on kill — they may want to
      // immediately re-check the same port or related ones.
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

    // Record each successful kill in history. Spread into a single update so
    // we don't trigger a re-render per row.
    if (killed > 0) {
      const ts = Date.now()
      setKillHistory(prev => {
        let next = prev
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.success) {
            const port = portsToKill[i]
            next = appendKillHistory({
              port: port.port,
              pid: port.pid,
              processName: port.process_name,
              timestamp: ts,
            }, next)
          }
        })
        return next
      })
    }

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
    if (trimmed === 'kill all' || trimmed === 'killall') {
      const currentState = stateRef.current
      const matches = currentState?.ports.filter(p => !p.is_protected) ?? []
      if (matches.length === 0) {
        showToast('No killable ports', 'error')
        return true
      }
      setSelectedPorts(new Set(matches.map(p => `${p.port}-${p.pid}`)))
      showToast(`Selected all ${matches.length} killable ports — confirm with bulk kill button`, 'success')
      return true
    }

    if (trimmed.startsWith('kill ')) {
      const arg = trimmed.slice(5).trim()
      const currentState = stateRef.current
      if (!currentState) return true

      // "kill 3000-4000" — arm a multi-select for the bulk-kill flow rather
      // than terminating without confirmation.
      const range = parsePortRange(arg)
      if (range) {
        const matches = currentState.ports.filter(
          p => p.port >= range[0] && p.port <= range[1] && !p.is_protected
        )
        if (matches.length === 0) {
          showToast(`No killable ports in range ${range[0]}-${range[1]}`, 'error')
          return true
        }
        setSelectedPorts(new Set(matches.map(p => `${p.port}-${p.pid}`)))
        showToast(`Selected ${matches.length} ports — confirm with bulk kill button`, 'success')
        return true
      }

      const portNum = parseInt(arg, 10)
      if (!isNaN(portNum)) {
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

    // Any change to the multi-select set disarms a pending bulk-kill so users
    // can't accidentally confirm killing a different group than they armed.
    if (pendingBulkKill) setPendingBulkKill(false)

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
  }, [selectedIndex, pendingBulkKill])

  const handleContextMenu = useCallback((port: PortInfo, e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, port })
  }, [])

  // Select every row owned by the same PID. Used by "Kill all from this
  // process" — primes the multi-select set so the existing bulk-kill flow
  // (with its confirmation step) handles the actual termination.
  const selectAllByPid = useCallback((pid: number) => {
    const ports = stateRef.current?.ports ?? []
    const keys = ports
      .filter(p => p.pid === pid && !p.is_protected)
      .map(p => `${p.port}-${p.pid}`)
    if (keys.length === 0) {
      showToast('No killable ports for this process', 'error')
      return
    }
    setSelectedPorts(new Set(keys))
    showToast(`Selected ${keys.length} ports — press the bulk kill button to confirm`, 'success')
  }, [showToast])

  const allPorts = useMemo(() =>
    customPorts.length > 0 ? customPorts : COMMON_PORTS
  , [customPorts])


  return (
    <div className="h-full bg-dark-900 rounded-xl border border-dark-500 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
      {/* Draggable title bar with window controls.
          data-tauri-drag-region is the v2-native way to mark a drag region;
          children inherit the drag behavior unless they're interactive
          (buttons, inputs). The `drag-region` CSS class keeps -webkit-app-region
          working as a belt-and-suspenders fallback. */}
      <header
        ref={headerRef}
        data-tauri-drag-region
        className="drag-region flex items-center justify-between px-3 py-2 border-b border-dark-500 bg-dark-800 select-none cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icons.Logo className="w-5 h-5 text-white flex-shrink-0" />
          <span className="text-white font-semibold text-[13px]">
            PortKiller
          </span>
          {selectedPorts.size > 1 && (
            <button
              onClick={requestBulkKill}
              className={`btn text-[10px] flex items-center gap-1 ml-2 py-1 no-drag ${
                pendingBulkKill ? 'btn-danger animate-pulse' : 'btn-danger'
              }`}
              aria-label={pendingBulkKill ? `Confirm killing ${selectedPorts.size} processes` : `Kill ${selectedPorts.size} processes`}
            >
              <Icons.Trash className="w-3 h-3" />
              {pendingBulkKill ? `Confirm Kill ${selectedPorts.size}?` : `Kill ${selectedPorts.size}`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 no-drag">
          {state?.is_admin ? (
            <span className="text-[11px] text-accent-green flex items-center gap-1 mr-1.5 px-1.5 py-0.5 rounded bg-accent-green/10">
              <Icons.ShieldCheck className="w-3 h-3" />
              Admin
            </span>
          ) : (
            <button
              onClick={handleRestartAsAdmin}
              className="text-[11px] text-accent-yellow flex items-center gap-1 mr-1.5 px-1.5 py-0.5 rounded hover:bg-accent-yellow/10 transition-colors"
              title="Restart as Administrator for full control"
              aria-label="Restart as Administrator"
            >
              <Icons.Shield className="w-3 h-3" />
              Admin
            </button>
          )}
          <button
            onClick={() => updatePreferences({ alwaysOnTop: !preferences.alwaysOnTop })}
            className={`p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-accent-blue/40 ${
              preferences.alwaysOnTop
                ? 'text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20'
                : 'text-gray-300 hover:text-white hover:bg-dark-600'
            }`}
            title={preferences.alwaysOnTop ? 'Unpin window (currently always on top)' : 'Pin window on top'}
            aria-label={preferences.alwaysOnTop ? 'Disable always on top' : 'Enable always on top'}
            aria-pressed={preferences.alwaysOnTop}
          >
            {preferences.alwaysOnTop
              ? <Icons.PinFilled className="w-3.5 h-3.5" />
              : <Icons.Pin className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="p-1.5 rounded-md hover:bg-dark-600 text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-accent-blue/40 relative"
            title={`Recently killed (${killHistory.length}) — press h`}
            aria-label="Open kill history"
          >
            <Icons.History className="w-3.5 h-3.5" />
            {killHistory.length > 0 && (
              <span
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent-blue"
                aria-hidden="true"
              />
            )}
          </button>
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
            title="Hide to tray (Alt+P to reopen)"
            aria-label="Hide to tray"
          >
            <Icons.Minimize className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={async () => await appWindow.close()}
            className="p-1.5 rounded-md hover:bg-accent-red/20 text-gray-300 hover:text-accent-red transition-colors focus:outline-none focus:ring-2 focus:ring-accent-red/40"
            title="Quit PortKiller"
            aria-label="Quit application"
          >
            <Icons.Close className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Search bar */}
      <nav className="px-3 py-3 border-b border-dark-500">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder='Search "3000", a process, "3000-4000", or type help'
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
              <Icons.Close className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </nav>

      {/* Common ports grid (toggleable in settings) */}
      {preferences.showCommonPorts && (
        <section className="px-3 py-3 border-b border-dark-500" aria-label="Common ports">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-gray-300 text-[11px] font-medium">Common ports</span>
            <span className="text-gray-400 text-[11px]">{state?.ports.length || 0} listening</span>
          </div>
          <PortGrid
            commonPorts={allPorts}
            getPortStatus={getCommonPortStatus}
            onKill={requestKill}
            killingPort={killingPort}
            pendingKill={pendingKill}
          />
        </section>
      )}

      {/* Port list */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-dark-600 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-300 text-[12px] font-medium">
              {searchQuery ? 'Search results' : 'All listening ports'}
            </span>
            <div role="tablist" aria-label="Filter by protocol" className="flex items-center gap-0.5 ml-1 p-0.5 rounded bg-dark-700 border border-dark-600">
              {(['all', 'tcp', 'udp'] as const).map(opt => {
                const active = protocolFilter === opt
                const count = opt === 'all'
                  ? (state?.ports.length ?? 0)
                  : opt === 'tcp' ? protocolCounts.tcp : protocolCounts.udp
                return (
                  <button
                    key={opt}
                    role="tab"
                    aria-selected={active}
                    onClick={() => updatePreferences({ protocolFilter: opt })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-accent-blue/40 ${
                      active
                        ? 'bg-accent-blue/20 text-accent-blue'
                        : 'text-gray-400 hover:text-white hover:bg-dark-600'
                    }`}
                    title={opt === 'all' ? 'Show all protocols' : `Show only ${opt.toUpperCase()} ports`}
                  >
                    {opt} <span className="opacity-60">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <select
              value={sortMode}
              onChange={(e) => updatePreferences({ sortMode: (e.target as HTMLSelectElement).value as Preferences['sortMode'] })}
              className="bg-dark-700 border border-dark-600 text-gray-300 text-[11px] rounded px-1.5 py-0.5 hover:text-white focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
              title="Sort listening ports"
              aria-label="Sort listening ports"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => handleExport('json')}
              className="text-gray-400 hover:text-white text-[11px] transition-colors px-2 py-0.5 rounded hover:bg-dark-700 focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
              title="Copy listening ports to clipboard as JSON"
              aria-label="Export ports as JSON to clipboard"
            >
              Copy JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="text-gray-400 hover:text-white text-[11px] transition-colors px-2 py-0.5 rounded hover:bg-dark-700 focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
              title="Copy listening ports to clipboard as CSV"
              aria-label="Export ports as CSV to clipboard"
            >
              Copy CSV
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
                {searchQuery
                  ? 'No matching ports found'
                  : protocolFilter !== 'all'
                  ? `No ${protocolFilter.toUpperCase()} ports listening`
                  : 'No listening ports detected'}
              </p>
              {searchQuery && (
                <p className="text-gray-500 text-[10px] mt-1">Try a different search term or type "clear"</p>
              )}
              {!searchQuery && protocolFilter !== 'all' && (state?.ports.length ?? 0) > 0 && (
                <button
                  onClick={() => updatePreferences({ protocolFilter: 'all' })}
                  className="btn btn-ghost mt-2 text-[11px] px-2 py-1"
                >
                  Show all {state?.ports.length ?? 0} ports
                </button>
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
              pinnedPorts={pinnedPorts}
              onTogglePin={togglePin}
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
          className="drag-region px-3 py-1.5 border-t border-dark-500 flex items-center justify-between text-[11px] text-gray-400 bg-dark-900 select-none cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
            <span>{state.ports.length} port{state.ports.length !== 1 ? 's' : ''}</span>
            {pinnedPorts.size > 0 && (
              <>
                <span className="text-gray-600">·</span>
                <span
                  className="text-accent-blue flex items-center gap-1"
                  title={`${pinnedPorts.size} pinned port${pinnedPorts.size !== 1 ? 's' : ''}`}
                >
                  <Icons.PinFilled className="w-2.5 h-2.5" />
                  {pinnedPorts.size}
                </span>
              </>
            )}
            <span className="text-gray-600">·</span>
            <span className="text-gray-500" title="Last refreshed">{lastUpdatedText}</span>
            {preferences.pollIntervalMs === 0 && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-accent-yellow" title="Auto-refresh disabled in settings">paused</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 no-drag">
            <button
              onClick={() => setShowShortcuts(true)}
              className="px-1.5 py-0.5 rounded bg-dark-700 border border-dark-500 font-mono text-[10px] text-gray-300 hover:text-white hover:border-dark-500 transition-colors focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
              title="Show keyboard shortcuts (press ?)"
              aria-label="Show keyboard shortcuts"
            >
              ?
            </button>
            <kbd className="px-1.5 py-0.5 rounded bg-dark-700 border border-dark-500 font-mono text-[10px] text-gray-300" title="Focus search">/</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-dark-700 border border-dark-500 font-mono text-[10px] text-gray-300" title="Clear search / hide window">Esc</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-dark-700 border border-dark-500 font-mono text-[10px] text-gray-300" title="Toggle window from anywhere">Alt+P</kbd>
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
          isPinned={pinnedPorts.has(contextMenu.port.port)}
          siblingPortCount={state?.ports.filter(p => p.pid === contextMenu.port.pid).length ?? 0}
          onClose={() => setContextMenu(null)}
          onKill={requestKill}
          onShowDetails={setDetailsPort}
          onTogglePin={togglePin}
          onSelectAllByPid={selectAllByPid}
        />
      )}

      {showHistory && (
        <HistoryPanel
          history={killHistory}
          onClose={() => setShowHistory(false)}
          onClear={() => { clearKillHistory(); setKillHistory([]) }}
        />
      )}

      {showSettings && (
        <SettingsPanel
          customPorts={customPorts}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
          onSave={(ports) => {
            setCustomPorts(ports)
            saveCustomPorts(ports)
            setShowSettings(false)
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showShortcuts && (
        <ShortcutsPanel onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  )
}
