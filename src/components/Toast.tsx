import type { JSX } from 'preact'
import { Icons } from './Icons'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  duration?: number
  onDismiss?: () => void
}

export function Toast({ message, type, onDismiss }: ToastProps): JSX.Element {
  return (
    <div
      className={`toast ${type === 'success' ? 'toast-success' : 'toast-error'}`}
      onClick={onDismiss}
    >
      <div className="flex items-center gap-2">
        {type === 'success' ? (
          <Icons.Success className="w-4 h-4" />
        ) : (
          <Icons.Error className="w-4 h-4" />
        )}
        <span>{message}</span>
      </div>
    </div>
  )
}
