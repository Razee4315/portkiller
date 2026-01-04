import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
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

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose()
            }
        }
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [onClose])

    const copyPort = () => {
        navigator.clipboard.writeText(port.port.toString())
        onClose()
    }

    const copyPid = () => {
        navigator.clipboard.writeText(port.pid.toString())
        onClose()
    }

    const openFolder = async () => {
        if (port.process_path) {
            const folder = port.process_path.substring(0, port.process_path.lastIndexOf('\\'))
            await shell.open(folder)
        }
        onClose()
    }

    const openTaskManager = async () => {
        await shell.open('taskmgr.exe')
        onClose()
    }

    const handleKill = () => {
        onKill(port)
        onClose()
    }

    const handleDetails = () => {
        onShowDetails(port)
        onClose()
    }

    // Adjust position to stay within viewport
    const adjustedX = Math.min(x, window.innerWidth - 200)
    const adjustedY = Math.min(y, window.innerHeight - 280)

    return (
        <div className="fixed inset-0 z-50">
            <div
                ref={ref}
                className="absolute bg-dark-800 border border-dark-500 rounded-lg shadow-2xl py-1 w-48 animate-fade-in"
                style={{ left: adjustedX, top: adjustedY }}
            >
                <div className="px-3 py-2 border-b border-dark-600">
                    <p className="text-white text-sm font-semibold truncate">:{port.port}</p>
                    <p className="text-gray-500 text-xs truncate">{port.process_name}</p>
                </div>

                <button
                    onClick={handleDetails}
                    className="w-full px-3 py-2 flex items-center gap-2 text-gray-300 hover:bg-dark-600 text-sm"
                >
                    <Icons.Process className="w-4 h-4" />
                    <span>View Details</span>
                </button>

                {!port.is_protected && (
                    <button
                        onClick={handleKill}
                        className="w-full px-3 py-2 flex items-center gap-2 text-accent-red hover:bg-dark-600 text-sm"
                    >
                        <Icons.Trash className="w-4 h-4" />
                        <span>Kill Process</span>
                    </button>
                )}

                <div className="border-t border-dark-600 my-1" />

                <button
                    onClick={copyPort}
                    className="w-full px-3 py-2 flex items-center gap-2 text-gray-300 hover:bg-dark-600 text-sm"
                >
                    <Icons.Port className="w-4 h-4" />
                    <span>Copy Port</span>
                </button>

                <button
                    onClick={copyPid}
                    className="w-full px-3 py-2 flex items-center gap-2 text-gray-300 hover:bg-dark-600 text-sm"
                >
                    <Icons.Process className="w-4 h-4" />
                    <span>Copy PID</span>
                </button>

                {port.process_path && (
                    <button
                        onClick={openFolder}
                        className="w-full px-3 py-2 flex items-center gap-2 text-gray-300 hover:bg-dark-600 text-sm"
                    >
                        <Icons.Port className="w-4 h-4" />
                        <span>Open Folder</span>
                    </button>
                )}

                <button
                    onClick={openTaskManager}
                    className="w-full px-3 py-2 flex items-center gap-2 text-gray-300 hover:bg-dark-600 text-sm"
                >
                    <Icons.Process className="w-4 h-4" />
                    <span>Task Manager</span>
                </button>
            </div>
        </div>
    )
}
