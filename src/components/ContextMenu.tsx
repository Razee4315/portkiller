import type { JSX } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { PortInfo } from '../types'
import { isTcp, localUrl } from '../lib/ports'
import { useConfirm } from '../hooks/useConfirm'
import type { PortActions } from '../hooks/usePortActions'
import { Icons } from './Icons'

interface ContextMenuProps {
  x: number
  y: number
  port: PortInfo
  isPinned: boolean
  /** How many listening ports this PID owns. */
  siblingPortCount: number
  onClose: () => void
  /** Kill without further confirmation — the menu confirms in place. */
  onKill: (port: PortInfo, opts: { tree: boolean }) => void
  onShowDetails: (port: PortInfo) => void
  onTogglePin: (port: number) => void
  onSelectAllByPid: (pid: number) => void
  actions: PortActions
}

interface MenuItem {
  id: string
  label: string
  icon: JSX.Element
  danger?: boolean
  /** Items that need a confirming second activation keep the menu open. */
  keepOpen?: boolean
  run: () => void
}

/** Gap kept between the menu and the window edge. */
const EDGE_MARGIN = 8

export function ContextMenu({
  x,
  y,
  port,
  isPinned,
  siblingPortCount,
  onClose,
  onKill,
  onShowDetails,
  onTogglePin,
  onSelectAllByPid,
  actions,
}: ContextMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const { armed, confirm } = useConfirm<'kill' | 'tree'>()

  const killItem = (id: 'kill' | 'tree', label: string): MenuItem => ({
    id,
    label: armed === id ? 'Click again to confirm' : label,
    icon: armed === id ? <Icons.Warning className="w-4 h-4" /> : <Icons.Trash className="w-4 h-4" />,
    danger: true,
    keepOpen: true,
    run: () => {
      if (confirm(id)) {
        onKill(port, { tree: id === 'tree' })
        onClose()
      }
    },
  })

  const items: MenuItem[] = [
    {
      id: 'details',
      label: 'View Details',
      icon: <Icons.Process className="w-4 h-4" />,
      run: () => onShowDetails(port),
    },
  ]

  if (!port.is_protected) {
    items.push(killItem('kill', 'Kill Process'), killItem('tree', 'Kill Process Tree'))
    if (siblingPortCount > 1) {
      items.push({
        id: 'select-pid',
        label: `Select all ${siblingPortCount} ports from this process`,
        icon: <Icons.Check className="w-4 h-4" />,
        run: () => onSelectAllByPid(port.pid),
      })
    }
  }

  items.push({
    id: 'pin',
    label: isPinned ? 'Unpin Port' : 'Pin Port to Top',
    icon: isPinned ? <Icons.PinFilled className="w-4 h-4" /> : <Icons.Pin className="w-4 h-4" />,
    run: () => onTogglePin(port.port),
  })

  // Any TCP port may be serving HTTP — let the user decide.
  if (isTcp(port)) {
    items.push({
      id: 'open',
      label: `Open ${localUrl(port.port)}`,
      icon: <Icons.ExternalLink className="w-4 h-4" />,
      run: () => actions.openBrowser(port),
    })
  }

  const copyIcon = <Icons.Copy className="w-4 h-4" />
  items.push(
    { id: 'copy-port', label: 'Copy Port', icon: copyIcon, run: () => actions.copy(port.port.toString(), `port ${port.port}`) },
    { id: 'copy-pid', label: 'Copy PID', icon: copyIcon, run: () => actions.copy(port.pid.toString(), `PID ${port.pid}`) },
    { id: 'copy-taskkill', label: 'Copy taskkill command', icon: copyIcon, run: () => actions.copy(`taskkill /F /PID ${port.pid}`, 'taskkill command') },
    { id: 'copy-ps', label: 'Copy PowerShell kill', icon: copyIcon, run: () => actions.copy(`Stop-Process -Id ${port.pid} -Force`, 'PowerShell kill command') },
  )

  if (port.process_path) {
    items.push({
      id: 'folder',
      label: 'Open Folder',
      icon: <Icons.Folder className="w-4 h-4" />,
      run: () => actions.openFolder(port),
    })
  }

  items.push({
    id: 'taskmgr',
    label: 'Task Manager',
    icon: <Icons.Process className="w-4 h-4" />,
    run: actions.openTaskManager,
  })

  const activate = (item: MenuItem) => {
    item.run()
    if (!item.keepOpen) onClose()
  }

  // The handlers below are registered once but must act on the current
  // items, so they read them through a ref.
  const latest = useRef({ items, focusedIndex, activate })
  latest.current = { items, focusedIndex, activate }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }

    // Capture phase, and every handled key is stopped: the menu owns the
    // keyboard while it is open, so arrows and Enter never reach the port
    // list underneath.
    const handleKeyDown = (e: KeyboardEvent) => {
      const { items, focusedIndex, activate } = latest.current
      const count = items.length
      switch (e.key) {
        case 'Escape':
        case 'Tab':
          onClose()
          break
        case 'ArrowDown':
          setFocusedIndex((focusedIndex + 1) % count)
          break
        case 'ArrowUp':
          setFocusedIndex((focusedIndex - 1 + count) % count)
          break
        case 'Home':
          setFocusedIndex(0)
          break
        case 'End':
          setFocusedIndex(count - 1)
          break
        case 'Enter':
        case ' ':
          activate(items[focusedIndex])
          break
        default:
          return
      }
      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onClose])

  // Re-runs once `position` is set: a still-hidden menu cannot take focus.
  useEffect(() => {
    if (!position) return
    const buttons = ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
    buttons?.[focusedIndex]?.focus()
  }, [focusedIndex, position])

  // Measure the rendered menu and pull it back inside the window. The item
  // count varies, so a fixed size guess would clip the bottom entries.
  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) return
    const { width, height } = menu.getBoundingClientRect()
    setPosition({
      left: Math.max(EDGE_MARGIN, Math.min(x, window.innerWidth - width - EDGE_MARGIN)),
      top: Math.max(EDGE_MARGIN, Math.min(y, window.innerHeight - height - EDGE_MARGIN)),
    })
  }, [x, y, items.length])

  return (
    <div className="fixed inset-0 z-50">
      <div
        ref={ref}
        role="menu"
        aria-label={`Actions for port ${port.port}`}
        className="absolute bg-dark-800 border border-dark-500 rounded-lg shadow-2xl py-1 w-60 max-h-[calc(100vh-16px)] overflow-y-auto animate-fade-in"
        style={{
          left: position?.left ?? x,
          top: position?.top ?? y,
          visibility: position ? 'visible' : 'hidden',
        }}
      >
        <div className="px-3 py-2 border-b border-dark-600">
          <p className="text-white text-sm font-semibold font-mono truncate">:{port.port}</p>
          <p className="text-gray-400 text-xs truncate">{port.process_name}</p>
        </div>

        {items.map((item, index) => (
          <button
            key={item.id}
            role="menuitem"
            tabIndex={index === focusedIndex ? 0 : -1}
            onClick={() => activate(item)}
            onMouseEnter={() => setFocusedIndex(index)}
            className={`ctx-menu-item ${item.danger ? 'text-accent-red' : 'text-gray-300'} ${
              index === focusedIndex ? 'bg-dark-600' : ''
            } ${armed === item.id ? 'animate-pulse' : ''}`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
