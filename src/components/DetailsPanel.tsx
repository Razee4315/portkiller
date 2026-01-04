import type { JSX } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/tauri'
import { shell } from '@tauri-apps/api'
import type { PortInfo, ProcessDetails } from '../types'
import { Icons } from './Icons'

interface DetailsPanelProps {
    port: PortInfo
    onClose: () => void
    onKill: (port: PortInfo) => void
}

export function DetailsPanel({ port, onClose, onKill }: DetailsPanelProps): JSX.Element {
    const [details, setDetails] = useState<ProcessDetails | null>(null)
    const [loading, setLoading] = useState(true)

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
    }, [port.pid])

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
            // Fallback: try shell
            await shell.open('taskmgr.exe')
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return 'N/A'
        const units = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(1024))
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
            <div className="bg-dark-800 border border-dark-500 rounded-xl w-[400px] max-h-[80%] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600 bg-dark-900/50">
                    <div className="flex items-center gap-2">
                        <Icons.Process className="w-5 h-5 text-accent-blue" />
                        <span className="text-white font-semibold">Process Details</span>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <Icons.Kill className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Icons.Spinner className="w-6 h-6 text-gray-500 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-500 text-sm">Port</span>
                                    <span className="text-white font-mono text-sm">:{port.port}</span>
                                </div>
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-500 text-sm">Protocol</span>
                                    <span className="text-white text-sm">{port.protocol}</span>
                                </div>
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-500 text-sm">PID</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-mono text-sm">{port.pid}</span>
                                        <button
                                            onClick={() => copyToClipboard(port.pid.toString())}
                                            className="text-gray-500 hover:text-white"
                                            title="Copy PID"
                                        >
                                            <Icons.Port className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-500 text-sm">Process</span>
                                    <span className="text-white text-sm truncate max-w-[200px]">{port.process_name}</span>
                                </div>
                                {port.process_path && (
                                    <div>
                                        <span className="text-gray-500 text-sm block mb-1">Path</span>
                                        <p className="text-gray-400 text-xs font-mono bg-dark-700 p-2 rounded break-all">
                                            {port.process_path}
                                        </p>
                                    </div>
                                )}
                                {details && (
                                    <>
                                        <div className="flex justify-between items-start">
                                            <span className="text-gray-500 text-sm">Memory</span>
                                            <span className="text-white text-sm">{formatBytes(details.memory_bytes)}</span>
                                        </div>
                                        {details.cpu_percent > 0 && (
                                            <div className="flex justify-between items-start">
                                                <span className="text-gray-500 text-sm">CPU</span>
                                                <span className="text-white text-sm">{details.cpu_percent.toFixed(1)}%</span>
                                            </div>
                                        )}
                                        {details.children.length > 0 && (
                                            <div className="flex justify-between items-start">
                                                <span className="text-gray-500 text-sm">Children</span>
                                                <span className="text-white text-sm">{details.children.length} processes</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-500 text-sm">Status</span>
                                    <span className={`text-sm ${port.is_protected ? 'text-accent-yellow' : 'text-accent-green'}`}>
                                        {port.is_protected ? 'Protected' : 'Killable'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-dark-600">
                                {port.process_path && (
                                    <button
                                        onClick={openFolder}
                                        className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
                                    >
                                        <Icons.Port className="w-4 h-4" />
                                        <span>Open Folder</span>
                                    </button>
                                )}
                                <button
                                    onClick={openTaskManager}
                                    className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
                                >
                                    <Icons.Process className="w-4 h-4" />
                                    <span>Task Manager</span>
                                </button>
                            </div>

                            {!port.is_protected && (
                                <button
                                    onClick={() => { onKill(port); onClose() }}
                                    className="btn btn-danger w-full flex items-center justify-center gap-2"
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
