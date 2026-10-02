import type { JSX } from 'preact'
import type { ToastType } from '../hooks/useToast'
import { Icons } from './Icons'

interface ToastProps {
  message: string
  type: ToastType
  onDismiss: () => void
}

export function Toast({ message, type, onDismiss }: ToastProps): JSX.Element {
  return (
    <div className="toast-layer">
      <div
        // Errors interrupt; everything else waits for a pause in speech.
        role={type === 'error' ? 'alert' : 'status'}
        className={`toast toast-${type} flex items-center gap-2`}
        onClick={onDismiss}
      >
        {type === 'error' ? (
          <Icons.Error className="w-4 h-4 flex-shrink-0" />
        ) : type === 'info' ? (
          <Icons.Bell className="w-4 h-4 flex-shrink-0" />
        ) : (
          <Icons.Success className="w-4 h-4 flex-shrink-0" />
        )}
        <span>{message}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          className="ml-2 text-current opacity-60 hover:opacity-100 transition-opacity rounded focus:outline-none focus:ring-1 focus:ring-current"
          aria-label="Dismiss notification"
        >
          <Icons.Close className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
