import { useEffect } from 'preact/hooks'
import type { RefObject } from 'preact'

const FOCUSABLE_SELECTOR =
  'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'

/**
 * Trap Tab / Shift+Tab focus inside the given container while it is mounted,
 * focus the first interactive element on mount, and return focus to whatever
 * was focused before the modal opened on unmount.
 *
 * Wraps the boilerplate that DetailsPanel and SettingsPanel previously
 * duplicated. WCAG 2.4.3 (Focus Order) requires this for modal dialogs.
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
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTab)
    const focusable = getFocusable()
    if (focusable.length > 0) focusable[0].focus()

    return () => {
      document.removeEventListener('keydown', handleTab)
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
