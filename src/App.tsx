import { useState, useEffect, useCallback, useRef, useMemo } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getVersion } from '@tauri-apps/api/app'
import type { CommonPort, KillRecord, PortInfo } from './types'
import {
  COMMON_PORTS,
  loadCustomPorts,
  saveCustomPorts,
  loadPinnedPorts,
  savePinnedPorts,
  loadKillHistory,
  appendKillHistory,
  clearKillHistory,
  hasSeenOnboarding,
  markOnboardingSeen,
} from './types'
import type { Preferences } from './preferences'
import { loadPreferences, savePreferences } from './preferences'
import { buildView, findPortOwner, portKey, uniqueByPid } from './lib/ports'
import type { Command } from './lib/commands'
import { parseCommand, searchQueryOf } from './lib/commands'
import { plural, toCsv, toJson } from './lib/format'
import { hotkeyParts } from './lib/hotkey'
import { copyText, errorMessage, setHotkey } from './lib/system'
import { useToast } from './hooks/useToast'
import { usePorts } from './hooks/usePorts'
import { useKill } from './hooks/useKill'
import { usePortActions } from './hooks/usePortActions'
import { useUpdater } from './hooks/useUpdater'
import { useWindowChrome } from './hooks/useWindowChrome'
import { useGlobalKeys } from './hooks/useGlobalKeys'
import { Icons } from './components/Icons'
import { Header } from './components/Header'
import { SearchBar } from './components/SearchBar'
import { ListToolbar } from './components/ListToolbar'
import { Footer } from './components/Footer'
import { PortGrid } from './components/PortGrid'
import { PortList } from './components/PortList'
import { Toast } from './components/Toast'
import { DetailsPanel } from './components/DetailsPanel'
import { ContextMenu } from './components/ContextMenu'
import { SettingsPanel } from './components/SettingsPanel'
import { ShortcutsPanel } from './components/ShortcutsPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { UpdateDialog } from './components/UpdateDialog'

const appWindow = getCurrentWindow()

const NO_SELECTION = new Set<string>()
const NO_PORTS: PortInfo[] = []

export function App() {
  const { toast, showToast, dismissToast } = useToast()

  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences())
  const updatePreferences = useCallback((next: Partial<Preferences>) => {
    setPreferences(prev => {
      const merged = { ...prev, ...next }
      savePreferences(merged)
      return merged
    })
  }, [])

  const { state, loading, refreshing, error, newKeys, lastUpdatedRef, refresh } = usePorts({
    pollIntervalMs: preferences.pollIntervalMs,
    protectedNames: preferences.protectedNames,
  })
  const allPorts = state?.ports ?? NO_PORTS
  const isAdmin = state?.is_admin ?? false

  const [killHistory, setKillHistory] = useState<KillRecord[]>(() => loadKillHistory())
  const recordKill = useCallback((port: PortInfo) => {
    setKillHistory(prev => appendKillHistory({
      port: port.port,
      pid: port.pid,
      processName: port.process_name,
      timestamp: Date.now(),
    }, prev))
  }, [])

  const kill = useKill({ isAdmin, refresh, showToast, onKilled: recordKill })
  const actions = usePortActions(showToast)
  const updater = useUpdater(showToast, preferences.checkUpdatesOnLaunch)

  const [searchQuery, setSearchQuery] = useState('')
  // The cursor is the row the keyboard acts on. It is stored by row identity,
  // not by index, so it stays on the same process when a poll reorders the list.
  const [cursorKey, setCursorKeyState] = useState<string | null>(null)
  // Mirrors `cursorKey` synchronously. Key handlers read the cursor from here
  // so that a fast "move, then Enter" always acts on the row just moved to,
  // even if the move has not been rendered yet.
  const cursorKeyRef = useRef<string | null>(null)
  const setCursorKey = useCallback((key: string | null) => {
    cursorKeyRef.current = key
    setCursorKeyState(key)
  }, [])
  // Rows ticked for a bulk kill. Separate from the cursor, and drawn differently.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(NO_SELECTION)
  const [showSettings, setShowSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [detailsPort, setDetailsPort] = useState<PortInfo | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; port: PortInfo } | null>(null)
  const [customPorts, setCustomPorts] = useState<CommonPort[] | null>(() => loadCustomPorts())
  const [pinnedPorts, setPinnedPorts] = useState<Set<number>>(() => new Set(loadPinnedPorts()))
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding())
  const [appVersion, setAppVersion] = useState('')
  const [elevating, setElevating] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const overlayOpen = !!(
    showSettings || showShortcuts || showHistory || detailsPort || contextMenu || updater.update
  )

  const filteredPorts = useMemo(() => buildView(allPorts, {
    query: searchQueryOf(searchQuery),
    protocol: preferences.protocolFilter,
    sort: preferences.sortMode,
    pinned: pinnedPorts,
  }), [allPorts, searchQuery, preferences.protocolFilter, preferences.sortMode, pinnedPorts])

  // Event handlers below are created once and read the current view through
  // this ref, so the memoized rows are not re-rendered by handler identity.
  const view = useRef({ filteredPorts, allPorts, overlayOpen })
  view.current = { filteredPorts, allPorts, overlayOpen }

  /** Index of the cursor row in the visible list, or -1. Always current. */
  const liveCursorIndex = useCallback(() => {
    const key = cursorKeyRef.current
    return key === null ? -1 : view.current.filteredPorts.findIndex(p => portKey(p) === key)
  }, [])
  const liveCursorPort = useCallback((): PortInfo | null => {
    return view.current.filteredPorts[liveCursorIndex()] ?? null
  }, [liveCursorIndex])

  const protocolCounts = useMemo(() => {
    const counts = { all: allPorts.length, tcp: 0, udp: 0 }
    allPorts.forEach(p => {
      const proto = p.protocol.toUpperCase()
      if (proto === 'TCP') counts.tcp++
      else if (proto === 'UDP') counts.udp++
    })
    return counts
  }, [allPorts])

  // What the bulk-kill button would actually terminate: one entry per
  // process, protected ones excluded. The button shows this count.
  const bulkTargets = useMemo(
    () => uniqueByPid(allPorts.filter(p => selectedKeys.has(portKey(p)) && !p.is_protected)),
    [allPorts, selectedKeys],
  )

  const gridPorts = customPorts ?? COMMON_PORTS
  const gridOwners = useMemo(() => {
    const owners = new Map<number, PortInfo>()
    gridPorts.forEach(cp => {
      const owner = findPortOwner(allPorts, cp.port)
      if (owner) owners.set(cp.port, owner)
    })
    return owners
  }, [gridPorts, allPorts])

  // Pinned ports with nothing listening have no row, so they get a line of
  // their own; otherwise a pin would silently disappear until the port is back.
  const idlePins = useMemo(() => {
    const listening = new Set(allPorts.map(p => p.port))
    return [...pinnedPorts].filter(n => !listening.has(n)).sort((a, b) => a - b)
  }, [pinnedPorts, allPorts])

  const changeSelection = useCallback((next: Set<string>) => {
    // Any change to the set disarms a pending bulk kill, so a confirm can
    // never apply to a different group than the one that was armed.
    kill.cancelPending()
    setSelectedKeys(next.size === 0 ? NO_SELECTION : next)
  }, [kill.cancelPending])

  // Drop ticks for rows that have left the list (the process exited).
  useEffect(() => {
    if (selectedKeys.size === 0) return
    const live = new Set(allPorts.map(portKey))
    const next = new Set([...selectedKeys].filter(key => live.has(key)))
    if (next.size !== selectedKeys.size) changeSelection(next)
  }, [allPorts])

  // A new query is a new list; the old cursor position means nothing in it.
  const changeSearch = useCallback((value: string) => {
    setSearchQuery(value)
    setCursorKey(null)
  }, [setCursorKey])

  const focusSearch = useCallback(() => {
    searchRef.current?.focus()
  }, [])

  // Keep the acted-on row in view: the cursor as it moves, and a row waiting
  // for its confirming press even when it was armed from the search bar.
  useEffect(() => {
    const key = kill.pendingKill ?? cursorKey
    if (!key) return
    listRef.current
      ?.querySelector(`[data-key="${key}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursorKey, kill.pendingKill])

  useEffect(() => {
    const count = allPorts.length
    const text = !state
      ? 'PortKiller'
      : count === 0
      ? 'PortKiller — no listening ports'
      : `PortKiller — ${plural(count, 'listening port')}`
    invoke('set_tray_tooltip', { text }).catch(() => {})
  }, [state, allPorts.length])

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {})
  }, [])

  // Apply the saved shortcut once at start. If another app owns it, say so
  // instead of leaving the user with a hotkey that silently does nothing.
  useEffect(() => {
    const hotkey = preferences.hotkey
    setHotkey(hotkey).catch(() => {
      showToast(
        `${hotkeyParts(hotkey).join('+')} is in use by another app. Pick a different shortcut in Settings.`,
        'error',
      )
    })
  }, [])

  const changeHotkey = useCallback(async (accelerator: string): Promise<string | null> => {
    const previous = preferences.hotkey
    try {
      await setHotkey(accelerator)
      updatePreferences({ hotkey: accelerator })
      return null
    } catch (err) {
      // Registering unregisters the old one first; put it back.
      setHotkey(previous).catch(() => {})
      return errorMessage(err)
    }
  }, [preferences.hotkey, updatePreferences])

  useWindowChrome({
    alwaysOnTop: preferences.alwaysOnTop,
    minimizeOnBlur: preferences.minimizeOnBlur,
    // Summoned by the hotkey: be ready for typing, with the old query
    // selected so the next keystroke replaces it.
    onFocus: useCallback(() => {
      if (view.current.overlayOpen) return
      searchRef.current?.focus()
      searchRef.current?.select()
    }, []),
    onAutoHide: useCallback(() => setContextMenu(null), []),
  })

  const hideWindow = useCallback(() => {
    appWindow.hide().catch(() => {})
  }, [])

  const dismissOnboarding = useCallback(() => {
    markOnboardingSeen()
    setShowOnboarding(false)
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

  const changeGridPorts = useCallback((ports: CommonPort[] | null) => {
    setCustomPorts(ports)
    saveCustomPorts(ports)
  }, [])

  const restartAsAdmin = useCallback(async () => {
    setElevating(true)
    showToast('Approve the Windows prompt to restart as Administrator', 'info')
    try {
      await invoke('restart_as_admin')
    } catch (err) {
      showToast(`Still running without Administrator rights: ${errorMessage(err)}`, 'error')
    } finally {
      setElevating(false)
    }
  }, [showToast])

  const exportPorts = useCallback(async (format: 'json' | 'csv') => {
    const ports = view.current.filteredPorts
    try {
      await copyText(format === 'json' ? toJson(ports) : toCsv(ports))
      showToast(`Copied ${plural(ports.length, 'port')} as ${format.toUpperCase()}`, 'success')
    } catch (err) {
      showToast(`Could not copy to the clipboard: ${errorMessage(err)}`, 'error')
    }
  }, [showToast])

  const selectForBulkKill = useCallback((ports: PortInfo[], emptyMessage: string) => {
    const killable = ports.filter(p => !p.is_protected)
    if (killable.length === 0) {
      showToast(emptyMessage, 'error')
      return
    }
    changeSelection(new Set(killable.map(portKey)))
    showToast(
      `Selected ${plural(killable.length, 'port')} — press the Kill button in the title bar to confirm`,
      'success',
    )
  }, [changeSelection, showToast])

  const selectAllByPid = useCallback((pid: number) => {
    selectForBulkKill(
      view.current.allPorts.filter(p => p.pid === pid),
      'No killable ports for this process',
    )
  }, [selectForBulkKill])

  /** Runs a parsed command. Returns whether the search text should be kept. */
  const runCommand = (command: Command): 'keep' | 'clear' => {
    switch (command.type) {
      case 'admin':
        restartAsAdmin()
        return 'clear'
      case 'refresh':
        refresh({ manual: true })
        return 'clear'
      case 'clear':
        changeSelection(NO_SELECTION)
        return 'clear'
      case 'settings':
        setShowSettings(true)
        return 'clear'
      case 'help':
        setShowShortcuts(true)
        return 'clear'
      case 'history':
        setShowHistory(true)
        return 'clear'
      case 'pin':
      case 'unpin': {
        const wantPinned = command.type === 'pin'
        if (pinnedPorts.has(command.port) === wantPinned) {
          showToast(`Port ${command.port} is ${wantPinned ? 'already' : 'not'} pinned`, wantPinned ? 'info' : 'error')
        } else {
          togglePin(command.port)
          showToast(`${wantPinned ? 'Pinned' : 'Unpinned'} port ${command.port}`, 'success')
        }
        return 'clear'
      }
      case 'unpin-all':
        if (pinnedPorts.size === 0) {
          showToast('No pinned ports', 'error')
        } else {
          showToast(`Unpinned ${plural(pinnedPorts.size, 'port')}`, 'success')
          setPinnedPorts(new Set())
          savePinnedPorts([])
        }
        return 'clear'
      case 'kill-all':
        // Scoped to what is on screen, never to everything on the machine.
        selectForBulkKill(filteredPorts, 'No killable ports in the list')
        return 'clear'
      case 'kill-range': {
        const [lo, hi] = command.range
        selectForBulkKill(
          allPorts.filter(p => p.port >= lo && p.port <= hi),
          `No killable ports in range ${lo}-${hi}`,
        )
        return 'clear'
      }
      case 'kill-port': {
        const owner = findPortOwner(allPorts, command.port)
        if (!owner) {
          showToast(`Port ${command.port} is not in use`, 'error')
          return 'keep'
        }
        setCursorKey(portKey(owner))
        const outcome = kill.requestKill(owner)
        if (outcome === 'armed') {
          showToast(
            `Press Enter again to kill ${owner.process_name} (PID ${owner.pid}) on port ${owner.port}`,
            'info',
          )
        }
        // The text stays until the kill is confirmed, so the second Enter
        // lands on the same command.
        return outcome === 'executed' ? 'clear' : 'keep'
      }
      case 'export':
        exportPorts(command.format)
        return 'clear'
    }
  }

  const submitSearch = () => {
    const command = parseCommand(searchQuery)
    if (command) {
      if (runCommand(command) === 'clear') setSearchQuery('')
      return
    }
    // Plain search text: Enter steps into the results.
    const first = filteredPorts[0]
    if (first) {
      setCursorKey(portKey(first))
      searchRef.current?.blur()
    }
  }

  const moveCursor = useCallback((delta: 1 | -1) => {
    const { filteredPorts } = view.current
    if (filteredPorts.length === 0) return
    const nextIndex = liveCursorIndex() + delta
    if (nextIndex < 0) {
      // Moving up past the first row returns to the search box.
      setCursorKey(null)
      searchRef.current?.focus()
      return
    }
    setCursorKey(portKey(filteredPorts[Math.min(nextIndex, filteredPorts.length - 1)]))
  }, [liveCursorIndex, setCursorKey])

  const enterList = useCallback(() => {
    const { filteredPorts } = view.current
    if (filteredPorts.length === 0) return
    if (liveCursorIndex() < 0) setCursorKey(portKey(filteredPorts[0]))
    searchRef.current?.blur()
  }, [liveCursorIndex, setCursorKey])

  const handlePortClick = useCallback((port: PortInfo, e: MouseEvent) => {
    const key = portKey(port)
    const { filteredPorts } = view.current
    const cursorIndex = liveCursorIndex()

    if (e.ctrlKey || e.metaKey) {
      setSelectedKeys(prev => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next.size === 0 ? NO_SELECTION : next
      })
      kill.cancelPending()
    } else if (e.shiftKey && cursorIndex >= 0) {
      const clicked = filteredPorts.findIndex(p => portKey(p) === key)
      const [start, end] = clicked < cursorIndex ? [clicked, cursorIndex] : [cursorIndex, clicked]
      changeSelection(new Set(filteredPorts.slice(start, end + 1).map(portKey)))
      // Keep the cursor as the anchor so the range can be extended.
      return
    } else {
      // A plain click only moves the cursor. Ticking rows is deliberate.
      changeSelection(NO_SELECTION)
    }
    setCursorKey(key)
  }, [changeSelection, kill.cancelPending, liveCursorIndex, setCursorKey])

  const handleContextMenu = useCallback((port: PortInfo, e: MouseEvent) => {
    e.preventDefault()
    setCursorKey(portKey(port))
    setContextMenu({ x: e.clientX, y: e.clientY, port })
  }, [setCursorKey])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const toggleCursorSelection = () => {
    const key = cursorKeyRef.current
    if (key === null) return
    kill.cancelPending()
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next.size === 0 ? NO_SELECTION : next
    })
  }

  // Escape undoes one thing at a time, innermost first, and only hides the
  // window once there is nothing left to back out of.
  const handleEscape = () => {
    if (kill.pendingKill || kill.pendingBulk) kill.cancelPending()
    else if (contextMenu) setContextMenu(null)
    else if (updater.update) {
      if (updater.phase !== 'downloading' && updater.phase !== 'installed') updater.dismiss()
    }
    else if (showShortcuts) setShowShortcuts(false)
    else if (showHistory) setShowHistory(false)
    else if (detailsPort) setDetailsPort(null)
    else if (showSettings) setShowSettings(false)
    else if (searchQuery) {
      changeSearch('')
      focusSearch()
    }
    else if (selectedKeys.size > 0) changeSelection(NO_SELECTION)
    else if (cursorKey) {
      setCursorKey(null)
      focusSearch()
    }
    else hideWindow()
  }

  useGlobalKeys({
    searchRef,
    overlayOpen,
    hasCursor: () => liveCursorPort() !== null,
    onEscape: handleEscape,
    onMoveCursor: moveCursor,
    onKillCursor: () => {
      const port = liveCursorPort()
      if (port) kill.requestKill(port)
    },
    onTogglePinCursor: () => {
      const port = liveCursorPort()
      if (port) togglePin(port.port)
    },
    onToggleSelectCursor: toggleCursorSelection,
    onCopyCursor: () => {
      const port = liveCursorPort()
      if (port) actions.copy(`${port.port}:${port.pid}`, `${port.port}:${port.pid}`)
    },
    onSelectAll: () => changeSelection(new Set(filteredPorts.filter(p => !p.is_protected).map(portKey))),
    onRefresh: () => { refresh({ manual: true }) },
    onToggleHistory: () => setShowHistory(s => !s),
    onToggleShortcuts: () => setShowShortcuts(s => !s),
  })

  const searching = searchQueryOf(searchQuery) !== ''
  const protocolFilter = preferences.protocolFilter

  return (
    <div className="h-full bg-dark-900 rounded-xl border border-dark-500 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
      <Header
        isAdmin={isAdmin}
        alwaysOnTop={preferences.alwaysOnTop}
        historyCount={killHistory.length}
        bulkCount={bulkTargets.length}
        bulkNames={bulkTargets.map(p => `${p.process_name} (${p.pid})`)}
        pendingBulk={kill.pendingBulk}
        bulkBusy={kill.bulkBusy}
        elevating={elevating}
        onBulkKill={async () => {
          if (await kill.requestBulkKill(bulkTargets) === 'executed') setSelectedKeys(NO_SELECTION)
        }}
        onRestartAsAdmin={restartAsAdmin}
        onToggleAlwaysOnTop={() => updatePreferences({ alwaysOnTop: !preferences.alwaysOnTop })}
        onOpenHistory={() => setShowHistory(true)}
        onOpenSettings={() => setShowSettings(true)}
        onHide={hideWindow}
        onQuit={() => { appWindow.close().catch(() => {}) }}
      />

      {showOnboarding && (
        <div className="px-3 py-2 border-b border-dark-500 bg-accent-blue/10 flex items-center gap-2 text-[12px] text-gray-200" role="note">
          <Icons.Keyboard className="w-4 h-4 text-accent-blue flex-shrink-0" />
          <span className="flex-1">
            PortKiller keeps running in the system tray. Press{' '}
            <kbd className="kbd">{hotkeyParts(preferences.hotkey).join('+')}</kbd>{' '}
            in any app to show or hide it.
          </span>
          <button onClick={dismissOnboarding} className="btn btn-primary py-1 text-[11px] flex-shrink-0">
            Got it
          </button>
        </div>
      )}

      <SearchBar
        inputRef={searchRef}
        value={searchQuery}
        onChange={changeSearch}
        onSubmit={submitSearch}
        onArrowDown={enterList}
      />

      {preferences.showCommonPorts && gridPorts.length > 0 && (
        <section className="px-3 py-3 border-b border-dark-500" aria-label="Common ports">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-gray-300 text-[11px] font-medium">Common ports</span>
            <span className="text-gray-400 text-[11px]">{gridOwners.size} of {gridPorts.length} in use</span>
          </div>
          <PortGrid
            commonPorts={gridPorts}
            owners={gridOwners}
            onKill={kill.requestKill}
            killingKeys={kill.killingKeys}
            pendingKill={kill.pendingKill}
          />
        </section>
      )}

      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <ListToolbar
          searching={searching}
          protocolFilter={protocolFilter}
          counts={protocolCounts}
          sortMode={preferences.sortMode}
          busy={loading || refreshing}
          onProtocolChange={(next) => updatePreferences({ protocolFilter: next })}
          onSortChange={(sortMode) => updatePreferences({ sortMode })}
          onRefresh={() => { refresh({ manual: true }) }}
          onExport={exportPorts}
        />

        {idlePins.length > 0 && !searching && (
          <div className="px-3 pt-2 flex items-center gap-1.5 flex-wrap text-[11px] text-gray-400">
            <Icons.PinFilled className="w-2.5 h-2.5 text-accent-blue flex-shrink-0" />
            <span>Pinned, not listening:</span>
            {idlePins.map(port => (
              <span key={port} className="chip">
                <span className="font-mono">:{port}</span>
                <button
                  onClick={() => togglePin(port)}
                  className="text-gray-400 hover:text-white rounded focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
                  aria-label={`Unpin port ${port}`}
                  title={`Unpin port ${port}`}
                >
                  <Icons.Close className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32" role="status" aria-label="Loading ports">
              <Icons.Spinner className="w-5 h-5 text-white animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-32 text-center" role="alert">
              <Icons.Warning className="w-6 h-6 text-accent-yellow mb-2" />
              <p className="text-white text-xs">Could not read the port list</p>
              <p className="text-gray-400 text-[11px] mt-1 break-words max-w-full">{error}</p>
              <button onClick={() => { refresh({ manual: true }) }} className="btn btn-ghost mt-2 text-xs">
                Retry
              </button>
            </div>
          ) : filteredPorts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Icons.Empty className="w-6 h-6 text-gray-300 mb-2" />
              <p className="text-gray-300 text-xs">
                {searching
                  ? 'No matching ports found'
                  : protocolFilter !== 'all'
                  ? `No ${protocolFilter.toUpperCase()} ports listening`
                  : 'No listening ports detected'}
              </p>
              {searching && (
                <p className="text-gray-400 text-[11px] mt-1">Try a different search term, or press Esc to clear</p>
              )}
              {!searching && protocolFilter !== 'all' && allPorts.length > 0 && (
                <button
                  onClick={() => updatePreferences({ protocolFilter: 'all' })}
                  className="btn btn-ghost mt-2 text-[11px] px-2 py-1"
                >
                  Show all {plural(allPorts.length, 'port')}
                </button>
              )}
            </div>
          ) : (
            <PortList
              ports={filteredPorts}
              cursorKey={cursorKey}
              selectedKeys={selectedKeys}
              newKeys={newKeys}
              pendingKill={kill.pendingKill}
              killingKeys={kill.killingKeys}
              pinnedPorts={pinnedPorts}
              onKill={kill.requestKill}
              onTogglePin={togglePin}
              onPortClick={handlePortClick}
              onContextMenu={handleContextMenu}
              onShowDetails={setDetailsPort}
              onFocusList={enterList}
            />
          )}
        </div>
      </main>

      <Footer
        portCount={allPorts.length}
        pinnedCount={pinnedPorts.size}
        paused={preferences.pollIntervalMs === 0}
        lastUpdatedRef={lastUpdatedRef}
        hotkey={preferences.hotkey}
        onShowShortcuts={() => setShowShortcuts(true)}
      />

      {detailsPort && (
        <DetailsPanel
          port={detailsPort}
          onClose={() => setDetailsPort(null)}
          onKill={kill.executeKill}
          actions={actions}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          port={contextMenu.port}
          isPinned={pinnedPorts.has(contextMenu.port.port)}
          siblingPortCount={allPorts.filter(p => p.pid === contextMenu.port.pid).length}
          onClose={closeContextMenu}
          onKill={kill.executeKill}
          onShowDetails={setDetailsPort}
          onTogglePin={togglePin}
          onSelectAllByPid={selectAllByPid}
          actions={actions}
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
          gridPorts={gridPorts}
          isCustomGrid={customPorts !== null}
          onChangeGridPorts={changeGridPorts}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
          onChangeHotkey={changeHotkey}
          onClose={() => setShowSettings(false)}
          appVersion={appVersion}
          onCheckForUpdates={updater.checkNow}
          checkingForUpdates={updater.checking}
          showToast={showToast}
        />
      )}

      {showShortcuts && (
        <ShortcutsPanel hotkey={preferences.hotkey} onClose={() => setShowShortcuts(false)} />
      )}

      {/* Startup update check; renders nothing unless an update is available
          or a download/install is in flight. */}
      <UpdateDialog {...updater} />

      {/* Last in the tree and on a higher layer, so it shows above dialogs. */}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  )
}
