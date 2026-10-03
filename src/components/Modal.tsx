import type { ComponentChildren, JSX } from 'preact'
import { useRef } from 'preact/hooks'
import { Icons } from './Icons'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ModalProps {
  /** Accessible name; also the visible title when `icon` is given. */
  label: string
  /** Renders the standard title bar (icon, label, close button) when set. */
  icon?: JSX.Element
  /** Extra controls placed left of the close button. */
  headerActions?: ComponentChildren
  footer?: ComponentChildren
  /** Tailwind width class for the panel. */
  widthClass?: string
  /** False while the dialog cannot be dismissed (e.g. mid-install). */
  dismissible?: boolean
  onClose: () => void
  /** Re-run the focus trap when these change (content swapped in). */
  trapDeps?: unknown[]
  children: ComponentChildren
}

/**
 * The one modal shell: dimmed overlay, focus trap, click-outside to close,
 * and a scrolling body between a fixed header and footer. Escape is handled
 * by the app-level key handler so the dismissal order stays in one place.
 */
export function Modal({
  label,
  icon,
  headerActions,
  footer,
  widthClass = 'w-[420px]',
  dismissible = true,
  onClose,
  trapDeps = [],
  children,
}: ModalProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, trapDeps)

  return (
    <div
      className="modal-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`modal-content ${widthClass} max-w-[92vw] max-h-[90vh] flex flex-col focus:outline-none`}
      >
        {icon && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-dark-500 bg-dark-800">
            <div className="flex items-center gap-2 min-w-0">
              {icon}
              <span className="text-white font-semibold text-sm truncate">{label}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {headerActions}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                aria-label={`Close ${label.toLowerCase()}`}
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex-shrink-0 border-t border-dark-500 bg-dark-900">{footer}</div>
        )}
      </div>
    </div>
  )
}
