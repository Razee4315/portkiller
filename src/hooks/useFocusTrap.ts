import { useEffect } from 'preact/hooks'
import type { RefObject } from 'preact'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * Trap Tab / Shift+Tab focus inside the given container while it is mounted,
 * focus the first interactive element on mount, and return focus to whatever
 * was focused before the modal opened on unmount.
 *
 * WCAG 2.4.3 (Focus Order) requires this for modal dialogs.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, deps: unknown[] = []): void {
  useEffect(() => {
    const container = ref.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const getFocusable = () =>
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      // Focus that has wandered outside (a click on the overlay, say) is
      // pulled back in rather than left to tab through the page behind.
      if (!container.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTab)
    // Keep focus where it is if it is already inside (a re-run after content
    // changed must not yank it back to the first button).
    if (!container.contains(document.activeElement)) {
      const focusable = getFocusable()
      if (focusable.length > 0) focusable[0].focus()
      else container.focus()
    }

    return () => {
      document.removeEventListener('keydown', handleTab)
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
    // The caller chooses when the trap re-runs; `ref` itself is stable.
  }, deps)
}
