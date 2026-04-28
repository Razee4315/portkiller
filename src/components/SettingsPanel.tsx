import type { JSX } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import type { CommonPort } from '../types'
import { COMMON_PORTS } from '../types'
import type { Preferences } from '../preferences'
import { POLL_OPTIONS } from '../preferences'
import { Icons } from './Icons'

interface SettingsPanelProps {
    customPorts: CommonPort[]
    preferences: Preferences
    onUpdatePreferences: (next: Partial<Preferences>) => void
    onSave: (ports: CommonPort[]) => void
    onClose: () => void
}

export function SettingsPanel({
    customPorts,
    preferences,
    onUpdatePreferences,
    onSave,
    onClose,
}: SettingsPanelProps): JSX.Element {
    const [ports, setPorts] = useState<CommonPort[]>(
        customPorts.length > 0 ? customPorts : [...COMMON_PORTS]
    )
    const [newPort, setNewPort] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const modalRef = useRef<HTMLDivElement>(null)

    // Focus trap + return focus to the trigger when closed.
    useEffect(() => {
        const modal = modalRef.current
        if (!modal) return

        const previouslyFocused = document.activeElement as HTMLElement | null

        const focusableSelector = 'button, input, select, [tabindex]:not([tabindex="-1"])'
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

        return () => {
            document.removeEventListener('keydown', handleTab)
            if (previouslyFocused && document.body.contains(previouslyFocused)) {
                previouslyFocused.focus()
            }
        }
    }, [])

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

    const handleAddKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && newPort) {
            e.preventDefault()
            addPort()
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
        >
            <div ref={modalRef} className="bg-dark-900 border border-dark-500 rounded-xl w-[420px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-dark-500 bg-dark-800">
                    <div className="flex items-center gap-2">
                        <Icons.Settings className="w-5 h-5 text-accent-blue" />
                        <span className="text-white font-semibold text-sm">Settings</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                        aria-label="Close settings"
                    >
                        <Icons.Close className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 p-4 space-y-5 overflow-y-auto">
                    <section className="space-y-3">
                        <span className="text-gray-300 text-sm font-medium">Behavior</span>

                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={preferences.alwaysOnTop}
                                onChange={(e) =>
                                    onUpdatePreferences({ alwaysOnTop: (e.target as HTMLInputElement).checked })
                                }
                                className="mt-0.5 accent-accent-blue"
                                aria-describedby="pref-aot-desc"
                            />
                            <div className="flex-1">
                                <div className="text-white text-sm">Always on top</div>
                                <div id="pref-aot-desc" className="text-gray-400 text-xs">
                                    Keep the window above other apps. Toggle anytime with the pin icon in the title bar.
                                </div>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={preferences.minimizeOnBlur}
                                onChange={(e) =>
                                    onUpdatePreferences({ minimizeOnBlur: (e.target as HTMLInputElement).checked })
                                }
                                className="mt-0.5 accent-accent-blue"
                                aria-describedby="pref-blur-desc"
                            />
                            <div className="flex-1">
                                <div className="text-white text-sm">Hide when window loses focus</div>
                                <div id="pref-blur-desc" className="text-gray-400 text-xs">
                                    Auto-hide to tray as soon as you click another app. Off by default.
                                </div>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={preferences.showCommonPorts}
                                onChange={(e) =>
                                    onUpdatePreferences({ showCommonPorts: (e.target as HTMLInputElement).checked })
                                }
                                className="mt-0.5 accent-accent-blue"
                            />
                            <div className="flex-1">
                                <div className="text-white text-sm">Show common ports grid</div>
                                <div className="text-gray-400 text-xs">
                                    Hide the dev-port shortcuts at the top of the window.
                                </div>
                            </div>
                        </label>

                        <div>
                            <label htmlFor="poll-interval" className="text-white text-sm block mb-1">
                                Refresh rate
                            </label>
                            <select
                                id="poll-interval"
                                value={preferences.pollIntervalMs}
                                onChange={(e) =>
                                    onUpdatePreferences({
                                        pollIntervalMs: parseInt((e.target as HTMLSelectElement).value, 10),
                                    })
                                }
                                className="input-field py-1.5 text-sm"
                            >
                                {POLL_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <p className="text-gray-400 text-xs mt-1">
                                How often the port list is refreshed. Polling pauses while the window is hidden.
                            </p>
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-300 text-sm font-medium">Common Ports</span>
                            <button
                                onClick={resetToDefault}
                                className="text-xs text-gray-400 hover:text-white focus:outline-none focus:text-white"
                            >
                                Reset to Default
                            </button>
                        </div>

                        <div className="space-y-1 max-h-44 overflow-y-auto">
                            {ports.map((port) => (
                                <div
                                    key={port.port}
                                    className="flex items-center gap-2 bg-dark-700 rounded px-3 py-2"
                                >
                                    <span className="text-white font-mono text-sm w-16">{port.port}</span>
                                    <span className="text-gray-400 text-sm flex-1 truncate">{port.description}</span>
                                    <button
                                        onClick={() => removePort(port.port)}
                                        className="text-gray-400 hover:text-accent-red transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-accent-red/40"
                                        aria-label={`Remove port ${port.port}`}
                                    >
                                        <Icons.Close className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="border-t border-dark-500 pt-4">
                        <span className="text-gray-300 text-sm font-medium block mb-2">Add New Port</span>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Port"
                                value={newPort}
                                onInput={(e) => setNewPort((e.target as HTMLInputElement).value)}
                                onKeyDown={handleAddKeyDown}
                                className="input-field w-24 text-sm py-2"
                                min="1"
                                max="65535"
                                aria-label="Port number"
                            />
                            <input
                                type="text"
                                placeholder="Description"
                                value={newDesc}
                                onInput={(e) => setNewDesc((e.target as HTMLInputElement).value)}
                                onKeyDown={handleAddKeyDown}
                                className="input-field flex-1 text-sm py-2"
                                aria-label="Port description"
                            />
                            <button
                                onClick={addPort}
                                disabled={!newPort}
                                className="btn btn-ghost px-3 disabled:opacity-50"
                            >
                                Add
                            </button>
                        </div>
                    </section>
                </div>

                <div className="flex-shrink-0 flex gap-2 p-4 border-t border-dark-500 bg-dark-900">
                    <button
                        onClick={onClose}
                        className="btn btn-ghost flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn btn-primary flex-1"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    )
}
