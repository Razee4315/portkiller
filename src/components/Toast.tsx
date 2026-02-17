import type { JSX } from 'preact'
import { Icons } from './Icons'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onDismiss?: () => void
}

export function Toast({ message, type, onDismiss }: ToastProps): JSX.Element {
  return (
    <div
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-label={`${type === 'success' ? 'Success' : 'Error'}: ${message}`}
      className={`toast ${type === 'success' ? 'toast-success' : 'toast-error'}`}
      onClick={onDismiss}
    >
      <div className="flex items-center gap-2">
        {type === 'success' ? (
          <Icons.Success className="w-4 h-4 flex-shrink-0" />
        ) : (
          <Icons.Error className="w-4 h-4 flex-shrink-0" />
        )}
        <span>{message}</span>
        {onDismiss && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            className="ml-2 text-current opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notification"
          >
            <Icons.Kill className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
