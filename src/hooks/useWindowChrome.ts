import { useEffect } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalPosition, LogicalSize, availableMonitors } from '@tauri-apps/api/window'
import { loadWindowState, saveWindowState } from '../preferences'
import type { WindowState } from '../preferences'

/** Wait for a drag or resize to settle before writing the geometry. */
const PERSIST_DEBOUNCE_MS = 300

// A saved rect is only restored when enough of it lies on a connected monitor
// for the title bar to be grabbed. Otherwise unplugging an external display
// would strand the window off-screen.
async function isOnScreen(saved: WindowState): Promise<boolean> {
  const monitors = await availableMonitors().catch(() => [])
  if (monitors.length === 0) return true
  return monitors.some(m => {
    const factor = m.scaleFactor || 1
    const mx = m.position.x / factor
    const my = m.position.y / factor
    const mw = m.size.width / factor
    const mh = m.size.height / factor
    const overlapX = Math.min(saved.x + saved.width, mx + mw) - Math.max(saved.x, mx)
    const overlapY = Math.min(saved.y + saved.height, my + mh) - Math.max(saved.y, my)
    return overlapX >= 100 && overlapY >= 60
  })
}

interface WindowChromeOptions {
  alwaysOnTop: boolean
  minimizeOnBlur: boolean
  /** Called whenever the window gains focus (shown by hotkey, tray, click). */
  onFocus: () => void
  /** Called just before the window auto-hides on blur. */
  onAutoHide: () => void
}

/**
 * Everything about the native window that the UI owns: restoring and saving
 * its geometry, telling the backend when it is safe to show it, and the
 * always-on-top and hide-on-blur preferences.
 */
export function useWindowChrome({ alwaysOnTop, minimizeOnBlur, onFocus, onAutoHide }: WindowChromeOptions): void {
  // Restore geometry, then let the backend reveal the window. Doing it in
  // this order means the window never appears at the default spot and jumps.
  useEffect(() => {
    const appWindow = getCurrentWindow()
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    ;(async () => {
      const saved = loadWindowState()
      try {
        if (saved && await isOnScreen(saved)) {
          await appWindow.setSize(new LogicalSize(saved.width, saved.height))
          await appWindow.setPosition(new LogicalPosition(saved.x, saved.y))
        }
      } catch {
        // Saved geometry invalid — keep the default centered window.
      }
      if (!cancelled) invoke('frontend_ready').catch(() => {})
    })()

    const persist = async () => {
      try {
        // A minimized window reports a parked off-screen position; saving it
        // would lose the real one.
        if (await appWindow.isMinimized()) return
        const [size, pos, factor] = await Promise.all([
          appWindow.outerSize(),
          appWindow.outerPosition(),
          appWindow.scaleFactor(),
        ])
        if (cancelled) return
        saveWindowState({
          width: size.width / factor,
          height: size.height / factor,
          x: pos.x / factor,
          y: pos.y / factor,
        })
      } catch {
        // Window is closing — nothing to save.
      }
    }

    // Move and resize events fire continuously during a drag.
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(persist, PERSIST_DEBOUNCE_MS)
    }

    const unResize = appWindow.onResized(schedule)
    const unMove = appWindow.onMoved(schedule)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      unResize.then(fn => fn()).catch(() => {})
      unMove.then(fn => fn()).catch(() => {})
    }
  }, [])

  useEffect(() => {
    getCurrentWindow().setAlwaysOnTop(alwaysOnTop).catch(() => {})
  }, [alwaysOnTop])

  useEffect(() => {
    const appWindow = getCurrentWindow()
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        onFocus()
      } else if (minimizeOnBlur) {
        onAutoHide()
        appWindow.hide().catch(() => {})
      }
    })
    return () => {
      unlisten.then(fn => fn()).catch(() => {})
    }
  }, [minimizeOnBlur, onFocus, onAutoHide])
}
