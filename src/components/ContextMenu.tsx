import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { shell } from '@tauri-apps/api'
import type { PortInfo } from '../types'
import { Icons } from './Icons'

interface ContextMenuProps {
    x: number
    y: number
    port: PortInfo
    onClose: () => void
    onKill: (port: PortInfo) => void
    onShowDetails: (port: PortInfo) => void
}

export function ContextMenu({ x, y, port, onClose, onKill, onShowDetails }: ContextMenuProps): JSX.Element {
    const ref = useRef<HTMLDivElement>(null)
    const [focusedIndex, setFocusedIndex] = useState(0)

    // Build menu items list for keyboard navigation
    const menuItems: { label: string; action: () => void; icon: JSX.Element; className?: string }[] = [
        {
            label: 'View Details',
            action: () => { onShowDetails(port); onClose() },
            icon: <Icons.Process className="w-4 h-4" />,
        },
    ]

    if (!port.is_protected) {
        menuItems.push({
            label: 'Kill Process',
            action: () => { onKill(port); onClose() },
            icon: <Icons.Trash className="w-4 h-4" />,
            className: 'text-accent-red',
        })
    }

    menuItems.push(
        {
            label: 'Copy Port',
            action: () => { navigator.clipboard.writeText(port.port.toString()); onClose() },
            icon: <Icons.Copy className="w-4 h-4" />,
        },
        {
            label: 'Copy PID',
            action: () => { navigator.clipboard.writeText(port.pid.toString()); onClose() },
            icon: <Icons.Copy className="w-4 h-4" />,
        },
    )

    if (port.process_path) {
        menuItems.push({
            label: 'Open Folder',
            action: async () => {
                const folder = port.process_path.substring(0, port.process_path.lastIndexOf('\\'))
                await shell.open(folder)
                onClose()
            },
            icon: <Icons.Folder className="w-4 h-4" />,
        })
    }

    menuItems.push({
        label: 'Task Manager',
        action: async () => { await shell.open('taskmgr.exe'); onClose() },
        icon: <Icons.Process className="w-4 h-4" />,
    })

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose()
            }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    e.preventDefault()
                    e.stopPropagation()
                    onClose()
                    break
                case 'ArrowDown':
                    e.preventDefault()
                    setFocusedIndex(prev => (prev + 1) % menuItems.length)
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    setFocusedIndex(prev => (prev - 1 + menuItems.length) % menuItems.length)
                    break
                case 'Enter':
                case ' ':
                    e.preventDefault()
                    menuItems[focusedIndex]?.action()
                    break
                case 'Home':
                    e.preventDefault()
                    setFocusedIndex(0)
                    break
                case 'End':
                    e.preventDefault()
                    setFocusedIndex(menuItems.length - 1)
                    break
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [onClose, focusedIndex, menuItems.length])

    // Focus the active menu item
    useEffect(() => {
        const buttons = ref.current?.querySelectorAll('[role="menuitem"]')
        if (buttons?.[focusedIndex]) {
            (buttons[focusedIndex] as HTMLElement).focus()
        }
    }, [focusedIndex])

    // Adjust position to stay within viewport
    const adjustedX = Math.min(x, window.innerWidth - 200)
    const adjustedY = Math.min(y, window.innerHeight - 280)

    return (
        <div className="fixed inset-0 z-50" aria-label="Context menu">
            <div
                ref={ref}
                role="menu"
                aria-label={`Actions for port ${port.port}`}
                className="absolute bg-dark-800 border border-dark-500 rounded-lg shadow-2xl py-1 w-48 animate-fade-in"
                style={{ left: adjustedX, top: adjustedY }}
            >
                <div className="px-3 py-2 border-b border-dark-600">
                    <p className="text-white text-sm font-semibold truncate">:{port.port}</p>
                    <p className="text-gray-500 text-xs truncate">{port.process_name}</p>
                </div>

                {menuItems.map((item, index) => (
                    <button
                        key={item.label}
                        role="menuitem"
                        tabIndex={index === focusedIndex ? 0 : -1}
                        onClick={item.action}
                        className={`ctx-menu-item ${item.className || 'text-gray-300'} ${
                            index === focusedIndex ? 'bg-dark-600' : 'hover:bg-dark-600'
                        }`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
