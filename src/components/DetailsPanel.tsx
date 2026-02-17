import type { JSX } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/tauri'
import { shell } from '@tauri-apps/api'
import type { PortInfo, ProcessDetails } from '../types'
import { Icons } from './Icons'

interface DetailsPanelProps {
    port: PortInfo
    onClose: () => void
    onKill: (port: PortInfo) => void
}

// Fixed formatBytes: clamp index and add TB unit (fixes #15)
function formatBytes(bytes: number): string {
    if (bytes === 0) return 'N/A'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export function DetailsPanel({ port, onClose, onKill }: DetailsPanelProps): JSX.Element {
    const [details, setDetails] = useState<ProcessDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const modalRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const data = await invoke<ProcessDetails>('get_process_details', { pid: port.pid })
                setDetails(data)
            } catch {
                // Fallback to basic info
                setDetails({
                    pid: port.pid,
                    name: port.process_name,
                    path: port.process_path,
                    memory_bytes: 0,
                    cpu_percent: 0,
                    children: [],
                })
            } finally {
                setLoading(false)
            }
        }

        fetchDetails()

        // Refresh process details every 3s for live memory/CPU (fixes #12)
        intervalRef.current = setInterval(fetchDetails, 3000)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [port.pid])

    // Focus trap for modal accessibility (fixes UI-6)
    useEffect(() => {
        const modal = modalRef.current
        if (!modal) return

        const focusableSelector = 'button, [tabindex]:not([tabindex="-1"])'
        const getFocusable = () => modal.querySelectorAll<HTMLElement>(focusableSelector)

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

        return () => document.removeEventListener('keydown', handleTab)
    }, [loading])

    const openFolder = async () => {
        if (port.process_path) {
            try {
                const folder = port.process_path.substring(0, port.process_path.lastIndexOf('\\'))
                await shell.open(folder)
            } catch { }
        }
    }

    const openTaskManager = async () => {
        try {
            await invoke('open_task_manager')
        } catch {
            await shell.open('taskmgr.exe')
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    return (
        <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label={`Process details for port ${port.port}`}
        >
            <div ref={modalRef} className="bg-dark-900 border border-dark-500 rounded-xl w-[400px] max-h-[80%] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500 bg-black">
                    <div className="flex items-center gap-2">
                        <Icons.Process className="w-5 h-5 text-accent-blue" />
                        <span className="text-white font-semibold">Process Details</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                        aria-label="Close details"
                    >
                        <Icons.Kill className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8" aria-label="Loading process details">
                            <Icons.Spinner className="w-6 h-6 text-gray-500 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-400 text-sm">Port</span>
                                    <span className="text-white font-mono text-sm">:{port.port}</span>
                                </div>
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-400 text-sm">Protocol</span>
                                    <span className="text-white text-sm">{port.protocol}</span>
                                </div>
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-400 text-sm">PID</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-mono text-sm">{port.pid}</span>
                                        <button
                                            onClick={() => copyToClipboard(port.pid.toString())}
                                            className="text-gray-500 hover:text-white p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
                                            title="Copy PID"
                                            aria-label="Copy PID to clipboard"
                                        >
                                            <Icons.Copy className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-400 text-sm">Process</span>
                                    <span className="text-white text-sm truncate max-w-[200px]">{port.process_name}</span>
                                </div>
                                {port.process_path && (
                                    <div>
                                        <span className="text-gray-400 text-sm block mb-1">Path</span>
                                        <p className="text-gray-400 text-xs font-mono bg-dark-700 p-2 rounded break-all">
                                            {port.process_path}
                                        </p>
                                    </div>
                                )}
                                {details && (
                                    <>
                                        <div className="flex justify-between items-start">
                                            <span className="text-gray-400 text-sm">Memory</span>
                                            <span className="text-white text-sm">{formatBytes(details.memory_bytes)}</span>
                                        </div>
                                        {details.cpu_percent > 0 && (
                                            <div className="flex justify-between items-start">
                                                <span className="text-gray-400 text-sm">CPU</span>
                                                <span className="text-white text-sm">{details.cpu_percent.toFixed(1)}%</span>
                                            </div>
                                        )}
                                        {details.children.length > 0 && (
                                            <div className="flex justify-between items-start">
                                                <span className="text-gray-400 text-sm">Children</span>
                                                <span className="text-white text-sm">{details.children.length} processes</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-400 text-sm">Status</span>
                                    <span className={`text-sm ${port.is_protected ? 'text-accent-yellow' : 'text-accent-green'}`}>
                                        {port.is_protected ? 'Protected' : 'Killable'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-dark-500">
                                {port.process_path && (
                                    <button
                                        onClick={openFolder}
                                        className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
                                        aria-label="Open containing folder"
                                    >
                                        <Icons.Folder className="w-4 h-4" />
                                        <span>Open Folder</span>
                                    </button>
                                )}
                                <button
                                    onClick={openTaskManager}
                                    className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
                                    aria-label="Open Task Manager"
                                >
                                    <Icons.Process className="w-4 h-4" />
                                    <span>Task Manager</span>
                                </button>
                            </div>

                            {!port.is_protected && (
                                <button
                                    onClick={() => { onKill(port); onClose() }}
                                    className="btn btn-danger w-full flex items-center justify-center gap-2"
                                    aria-label={`Kill process ${port.process_name}`}
                                >
                                    <Icons.Trash className="w-4 h-4" />
                                    <span>Kill Process</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
