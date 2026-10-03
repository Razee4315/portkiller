import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { RefObject } from 'preact'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { AppState, PortInfo } from '../types'
import { portKey, samePorts } from '../lib/ports'
import { errorMessage } from '../lib/system'

/** How long a newly opened port keeps its "New" highlight. */
const NEW_HIGHLIGHT_MS = 3000
/** Keep the refresh spinner up long enough to be seen. */
const MIN_SPINNER_MS = 350

// Guard the IPC boundary: the UI indexes into these fields constantly, so a
// malformed payload should surface as one error, not as scattered crashes.
function parseAppState(data: unknown): AppState {
  if (typeof data !== 'object' || data === null) throw new Error('Unexpected response from the backend')
  const { ports, is_admin } = data as { ports?: unknown; is_admin?: unknown }
  if (!Array.isArray(ports)) throw new Error('Unexpected response from the backend')
  return {
    is_admin: is_admin === true,
    ports: ports
      .filter((p): p is PortInfo =>
        typeof p === 'object' && p !== null &&
        typeof (p as PortInfo).port === 'number' &&
        typeof (p as PortInfo).pid === 'number',
      )
      .map(p => ({
        pid: p.pid,
        port: p.port,
        protocol: String(p.protocol ?? ''),
        process_name: String(p.process_name ?? 'Unknown'),
        process_path: String(p.process_path ?? ''),
        command_line: String(p.command_line ?? ''),
        is_protected: p.is_protected === true,
        local_address: String(p.local_address ?? ''),
      })),
  }
}

interface UsePortsOptions {
  pollIntervalMs: number
  /** Lower-cased process names the user has marked as never-kill. */
  protectedNames: string[]
}

export interface UsePorts {
  state: AppState | null
  /** True until the first fetch settles. */
  loading: boolean
  /** True while a user-requested refresh is in flight. */
  refreshing: boolean
  error: string | null
  /** Row keys that appeared in the last few seconds. */
  newKeys: Set<string>
  /** Time of the last successful fetch. A ref so ticking it re-renders nothing. */
  lastUpdatedRef: RefObject<number>
  /** Fetch now. Resolves with the fresh state, or null if the fetch failed. */
  refresh: (opts?: { manual?: boolean }) => Promise<AppState | null>
}

const EMPTY_KEYS = new Set<string>()

export function usePorts({ pollIntervalMs, protectedNames }: UsePortsOptions): UsePorts {
  const [raw, setRaw] = useState<AppState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newKeys, setNewKeys] = useState<Set<string>>(EMPTY_KEYS)

  const rawRef = useRef<AppState | null>(null)
  const prevKeysRef = useRef<Set<string> | null>(null)
  const lastUpdatedRef = useRef<number>(Date.now())
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const later = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer)
      fn()
    }, ms)
    timersRef.current.add(timer)
  }, [])

  const refresh = useCallback(async ({ manual = false }: { manual?: boolean } = {}) => {
    const started = Date.now()
    if (manual) setRefreshing(true)
    try {
      const data = parseAppState(await invoke('get_listening_ports'))

      const keys = new Set(data.ports.map(portKey))
      const prev = prevKeysRef.current
      prevKeysRef.current = keys
      // Skip the very first fetch: everything would be "new".
      if (prev) {
        const fresh = [...keys].filter(k => !prev.has(k))
        if (fresh.length > 0) {
          setNewKeys(current => new Set([...current, ...fresh]))
          later(() => {
            setNewKeys(current => {
              const next = new Set(current)
              fresh.forEach(k => next.delete(k))
              return next.size === 0 ? EMPTY_KEYS : next
            })
          }, NEW_HIGHLIGHT_MS)
        }
      }

      // Most polls return exactly what the last one did. Keeping the old
      // object then means no re-render at all.
      const current = rawRef.current
      if (!current || current.is_admin !== data.is_admin || !samePorts(current.ports, data.ports)) {
        rawRef.current = data
        setRaw(data)
      }
      lastUpdatedRef.current = Date.now()
      setError(null)
      return rawRef.current
    } catch (err) {
      setError(errorMessage(err))
      return null
    } finally {
      setLoading(false)
      if (manual) later(() => setRefreshing(false), Math.max(0, MIN_SPINNER_MS - (Date.now() - started)))
    }
  }, [later])

  // Poll on the user's chosen interval, but only while the window is actually
  // on screen: a tray app must not scan every process every two seconds for
  // nobody. Coming back into focus refreshes immediately.
  useEffect(() => {
    const appWindow = getCurrentWindow()
    refresh()

    const timer = pollIntervalMs > 0
      ? setInterval(async () => {
          const visible = await appWindow.isVisible().catch(() => true)
          if (visible) refresh()
        }, pollIntervalMs)
      : null

    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) refresh()
    })

    return () => {
      if (timer) clearInterval(timer)
      unlisten.then(fn => fn()).catch(() => {})
    }
  }, [refresh, pollIntervalMs])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(t => clearTimeout(t))
      timers.clear()
    }
  }, [])

  // Fold the user's never-kill list into `is_protected` so every kill path —
  // row, grid, bulk, command — honors it without knowing it exists.
  const state = useMemo<AppState | null>(() => {
    if (!raw || protectedNames.length === 0) return raw
    const names = new Set(protectedNames)
    return {
      ...raw,
      ports: raw.ports.map(p =>
        !p.is_protected && names.has(p.process_name.toLowerCase())
          ? { ...p, is_protected: true }
          : p,
      ),
    }
  }, [raw, protectedNames])

  return { state, loading, refreshing, error, newKeys, lastUpdatedRef, refresh }
}
