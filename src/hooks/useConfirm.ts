import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

/** How long an armed destructive action waits for its confirming press. */
export const CONFIRM_WINDOW_MS = 3000

/**
 * Two-step confirmation for a destructive button: the first press arms it,
 * a second press within the window runs the action. `armed` is the id of the
 * armed action, so one hook can serve several buttons.
 */
export function useConfirm<T extends string>(): {
  armed: T | null
  /** Returns true when this call was the confirming press. */
  confirm: (id: T) => boolean
  reset: () => void
} {
  const [armed, setArmed] = useState<T | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setArmed(null)
  }, [])

  const confirm = useCallback((id: T): boolean => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (armed === id) {
      timerRef.current = null
      setArmed(null)
      return true
    }
    setArmed(id)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setArmed(null)
    }, CONFIRM_WINDOW_MS)
    return false
  }, [armed])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { armed, confirm, reset }
}
