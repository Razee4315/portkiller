// User preferences persisted in localStorage.
// Kept tiny and synchronous so we can apply defaults before the window is shown.

export type ProtocolFilter = 'all' | 'tcp' | 'udp'
export type SortMode = 'port-asc' | 'port-desc' | 'process' | 'pid'

export interface Preferences {
  alwaysOnTop: boolean
  minimizeOnBlur: boolean
  pollIntervalMs: number
  showCommonPorts: boolean
  protocolFilter: ProtocolFilter
  sortMode: SortMode
  /** Global show/hide shortcut, e.g. "Alt+P". */
  hotkey: string
  checkUpdatesOnLaunch: boolean
  /** Lower-cased process names the user never wants to kill by accident. */
  protectedNames: string[]
}

export const DEFAULT_HOTKEY = 'Alt+P'

export const DEFAULT_PREFERENCES: Preferences = {
  alwaysOnTop: false,
  minimizeOnBlur: false,
  pollIntervalMs: 2000,
  showCommonPorts: true,
  protocolFilter: 'all',
  sortMode: 'port-asc',
  hotkey: DEFAULT_HOTKEY,
  checkUpdatesOnLaunch: true,
  protectedNames: [],
}

export const SORT_OPTIONS: { label: string; value: SortMode }[] = [
  { label: 'Port (low → high)', value: 'port-asc' },
  { label: 'Port (high → low)', value: 'port-desc' },
  { label: 'Process name', value: 'process' },
  { label: 'PID', value: 'pid' },
]

export const POLL_OPTIONS: { label: string; value: number }[] = [
  { label: '1s (fast)', value: 1000 },
  { label: '2s (default)', value: 2000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: 'Manual only', value: 0 },
]

const KEY = 'portkiller_preferences_v1'

const PROTOCOLS: readonly ProtocolFilter[] = ['all', 'tcp', 'udp']

/**
 * Take whatever was in storage and keep only fields that have the right type
 * and an allowed value. Anything else falls back to the default, so a
 * hand-edited or older preferences blob can never put the app in a bad state.
 */
export function sanitizePreferences(input: unknown): Preferences {
  const d = DEFAULT_PREFERENCES
  if (typeof input !== 'object' || input === null) return { ...d }
  const p = input as Record<string, unknown>
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  return {
    alwaysOnTop: bool(p.alwaysOnTop, d.alwaysOnTop),
    minimizeOnBlur: bool(p.minimizeOnBlur, d.minimizeOnBlur),
    pollIntervalMs: POLL_OPTIONS.some(o => o.value === p.pollIntervalMs)
      ? (p.pollIntervalMs as number)
      : d.pollIntervalMs,
    showCommonPorts: bool(p.showCommonPorts, d.showCommonPorts),
    protocolFilter: PROTOCOLS.includes(p.protocolFilter as ProtocolFilter)
      ? (p.protocolFilter as ProtocolFilter)
      : d.protocolFilter,
    sortMode: SORT_OPTIONS.some(o => o.value === p.sortMode)
      ? (p.sortMode as SortMode)
      : d.sortMode,
    hotkey: typeof p.hotkey === 'string' && p.hotkey ? p.hotkey : d.hotkey,
    checkUpdatesOnLaunch: bool(p.checkUpdatesOnLaunch, d.checkUpdatesOnLaunch),
    protectedNames: Array.isArray(p.protectedNames)
      ? p.protectedNames.filter((n): n is string => typeof n === 'string').map(n => n.toLowerCase())
      : [],
  }
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? sanitizePreferences(JSON.parse(raw)) : { ...DEFAULT_PREFERENCES }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // localStorage full or unavailable — ignore.
  }
}

// Window position + size memory. Stored separately so it can be wiped
// independently if a user moves to a smaller display.
export interface WindowState {
  width: number
  height: number
  x: number
  y: number
}

const WINDOW_STATE_KEY = 'portkiller_window_state_v1'

export function loadWindowState(): WindowState | null {
  try {
    const raw = localStorage.getItem(WINDOW_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WindowState> | null
    if (
      !parsed ||
      typeof parsed.width !== 'number' || typeof parsed.height !== 'number' ||
      typeof parsed.x !== 'number' || typeof parsed.y !== 'number'
    ) return null
    return { width: parsed.width, height: parsed.height, x: parsed.x, y: parsed.y }
  } catch {
    return null
  }
}

export function saveWindowState(state: WindowState): void {
  try {
    localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}
