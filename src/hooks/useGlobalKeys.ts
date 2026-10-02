import { useEffect, useRef } from 'preact/hooks'
import type { RefObject } from 'preact'

export interface GlobalKeyHandlers {
  searchRef: RefObject<HTMLInputElement>
  /** A dialog or menu is open and owns the keyboard. */
  overlayOpen: boolean
  /** A row is highlighted, so row shortcuts have something to act on. */
  hasCursor: () => boolean
  /** One step of the Escape ladder: cancel, close, clear, then hide. */
  onEscape: () => void
  onMoveCursor: (delta: 1 | -1) => void
  onKillCursor: () => void
  onTogglePinCursor: () => void
  onToggleSelectCursor: () => void
  onCopyCursor: () => void
  onSelectAll: () => void
  onRefresh: () => void
  onToggleHistory: () => void
  onToggleShortcuts: () => void
}

function isTextField(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  )
}

/**
 * App-wide keyboard shortcuts.
 *
 * The rule that keeps this safe: single-key shortcuts only fire when the
 * keyboard is not already doing something else. While a dialog is open, or
 * focus is in any text field, only Escape and the refresh keys are handled —
 * so typing "h" into a form never opens History, and Enter or Delete inside a
 * dialog can never reach the kill action for the row behind it.
 */
export function useGlobalKeys(handlers: GlobalKeyHandlers): void {
  // One listener for the lifetime of the app; it reads the latest handlers
  // through a ref instead of being re-attached on every state change.
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = latest.current

      if (e.key === 'Escape') {
        e.preventDefault()
        h.onEscape()
        return
      }

      // Always swallowed: the default would reload the webview and drop state.
      if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault()
        if (!h.overlayOpen) h.onRefresh()
        return
      }

      if (h.overlayOpen) return

      // Judge by where the key was pressed (the event target), not by where
      // focus is now: a handler on the target may already have moved focus,
      // and the same key press must not then be handled a second time here.
      // The search box handles its own Enter and ArrowDown; every other text
      // field keeps all of its keys.
      if (isTextField(e.target)) return

      const onButton = e.target instanceof HTMLButtonElement
      const modified = e.ctrlKey || e.metaKey || e.altKey

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        h.onMoveCursor(e.key === 'ArrowDown' ? 1 : -1)
        return
      }

      if (e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase()
        if (key === 'a') {
          e.preventDefault()
          h.onSelectAll()
        } else if (key === 'c' && h.hasCursor()) {
          e.preventDefault()
          h.onCopyCursor()
        }
        return
      }

      if (modified) return

      switch (e.key) {
        case '/':
          e.preventDefault()
          h.searchRef.current?.focus()
          return
        case '?':
          e.preventDefault()
          h.onToggleShortcuts()
          return
        case 'j':
          e.preventDefault()
          h.onMoveCursor(1)
          return
        case 'k':
          e.preventDefault()
          h.onMoveCursor(-1)
          return
        case 'h':
          e.preventDefault()
          h.onToggleHistory()
          return
        case 'Delete':
          if (h.hasCursor()) {
            e.preventDefault()
            h.onKillCursor()
          }
          return
        case 'Enter':
          // A focused button keeps Enter for itself.
          if (h.hasCursor() && !onButton) {
            e.preventDefault()
            h.onKillCursor()
          }
          return
        case ' ':
          if (h.hasCursor() && !onButton) {
            e.preventDefault()
            h.onToggleSelectCursor()
          }
          return
        case 'p':
          if (h.hasCursor()) {
            e.preventDefault()
            h.onTogglePinCursor()
            return
          }
          break
      }

      // Type-to-search: any other printable key starts a search. Focusing the
      // box during keydown routes this very keystroke into it.
      if (e.key.length === 1) h.searchRef.current?.focus()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
