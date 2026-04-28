// User preferences persisted in localStorage.
// Kept tiny and synchronous so we can apply defaults before the window is shown.

export interface Preferences {
  alwaysOnTop: boolean
  minimizeOnBlur: boolean
  pollIntervalMs: number
  showCommonPorts: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  alwaysOnTop: false,
  minimizeOnBlur: false,
  pollIntervalMs: 2000,
  showCommonPorts: true,
}

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
