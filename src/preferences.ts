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
}

export const DEFAULT_PREFERENCES: Preferences = {
  alwaysOnTop: false,
  minimizeOnBlur: false,
  pollIntervalMs: 2000,
  showCommonPorts: true,
  protocolFilter: 'all',
  sortMode: 'port-asc',
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

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<Preferences>
    return { ...DEFAULT_PREFERENCES, ...parsed }
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
    const parsed = JSON.parse(raw) as WindowState
    if (
      typeof parsed.width !== 'number' || typeof parsed.height !== 'number' ||
      typeof parsed.x !== 'number' || typeof parsed.y !== 'number'
    ) return null
    return parsed
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
