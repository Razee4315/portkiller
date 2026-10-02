import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastState {
  message: string
  type: ToastType
}

export type ShowToast = (message: string, type: ToastType) => void

/** One toast at a time; a new one replaces the old and restarts the timer. */
export function useToast(): { toast: ToastState | null; showToast: ShowToast; dismissToast: () => void } {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const dismissToast = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [])

  const showToast = useCallback<ShowToast>((message, type) => {
    clearTimer()
    setToast({ message, type })
    // Errors stay longer: they usually need reading, not just noticing.
    timerRef.current = setTimeout(() => {
      setToast(null)
      timerRef.current = null
    }, type === 'error' ? 5000 : 3000)
  }, [])

  useEffect(() => clearTimer, [])

  return { toast, showToast, dismissToast }
}
