import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import type { CommonPort } from '../types'
import { COMMON_PORTS } from '../types'
import { Icons } from './Icons'

interface SettingsPanelProps {
    customPorts: CommonPort[]
    onSave: (ports: CommonPort[]) => void
    onClose: () => void
}

export function SettingsPanel({ customPorts, onSave, onClose }: SettingsPanelProps): JSX.Element {
    const [ports, setPorts] = useState<CommonPort[]>(
        customPorts.length > 0 ? customPorts : [...COMMON_PORTS]
    )
    const [newPort, setNewPort] = useState('')
    const [newDesc, setNewDesc] = useState('')

    const addPort = () => {
        const portNum = parseInt(newPort, 10)
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) return
        if (ports.some(p => p.port === portNum)) return

        setPorts([...ports, {
            port: portNum,
            label: portNum.toString(),
            description: newDesc || 'Custom'
        }])
        setNewPort('')
        setNewDesc('')
    }

    const removePort = (port: number) => {
        setPorts(ports.filter(p => p.port !== port))
    }

    const resetToDefault = () => {
        setPorts([...COMMON_PORTS])
    }

    const handleSave = () => {
        // Only save if different from default
        const isDefault = ports.length === COMMON_PORTS.length &&
            ports.every((p, i) => p.port === COMMON_PORTS[i].port)
        onSave(isDefault ? [] : ports)
    }

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in">
            <div className="bg-dark-900 border border-dark-500 rounded-xl w-[420px] max-h-[80%] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500 bg-black">
                    <div className="flex items-center gap-2">
                        <Icons.Settings className="w-5 h-5 text-accent-blue" />
                        <span className="text-white font-semibold">Settings</span>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <Icons.Kill className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto max-h-[400px]">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm font-medium">Common Ports</span>
                            <button
                                onClick={resetToDefault}
                                className="text-xs text-gray-500 hover:text-white"
                            >
                                Reset to Default
                            </button>
                        </div>

                        <div className="space-y-1 max-h-48 overflow-y-auto">
                            {ports.map((port) => (
                                <div
                                    key={port.port}
                                    className="flex items-center gap-2 bg-dark-700 rounded px-3 py-2"
                                >
                                    <span className="text-white font-mono text-sm w-16">{port.port}</span>
                                    <span className="text-gray-400 text-sm flex-1 truncate">{port.description}</span>
                                    <button
                                        onClick={() => removePort(port.port)}
                                        className="text-gray-400 hover:text-accent-red transition-colors"
                                    >
                                        <Icons.Kill className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-dark-500 pt-4">
                        <span className="text-gray-400 text-sm font-medium block mb-2">Add New Port</span>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Port"
                                value={newPort}
                                onInput={(e) => setNewPort((e.target as HTMLInputElement).value)}
                                className="input-field w-24 text-sm py-2"
                                min="1"
                                max="65535"
                            />
                            <input
                                type="text"
                                placeholder="Description"
                                value={newDesc}
                                onInput={(e) => setNewDesc((e.target as HTMLInputElement).value)}
                                className="input-field flex-1 text-sm py-2"
                            />
                            <button
                                onClick={addPort}
                                disabled={!newPort}
                                className="btn btn-ghost px-3 disabled:opacity-50"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 p-4 border-t border-dark-500">
                    <button
                        onClick={onClose}
                        className="btn btn-ghost flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn btn-danger flex-1"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    )
}
