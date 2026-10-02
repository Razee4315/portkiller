import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import type { CommonPort } from '../types'
import type { Preferences } from '../preferences'
import { DEFAULT_HOTKEY, POLL_OPTIONS } from '../preferences'
import { parsePortNumber } from '../lib/ports'
import { captureHotkey, hotkeyParts } from '../lib/hotkey'
import { errorMessage, getAutostart, setAutostart } from '../lib/system'
import type { ShowToast } from '../hooks/useToast'
import { Icons } from './Icons'
import { Modal } from './Modal'

interface SettingsPanelProps {
  /** The grid as currently shown: the user's list, or the defaults. */
  gridPorts: CommonPort[]
  isCustomGrid: boolean
  /** Null restores the built-in defaults. Applied immediately. */
  onChangeGridPorts: (ports: CommonPort[] | null) => void
  preferences: Preferences
  onUpdatePreferences: (next: Partial<Preferences>) => void
  /** Registers the shortcut; resolves with an error message, or null on success. */
  onChangeHotkey: (accelerator: string) => Promise<string | null>
  onClose: () => void
  appVersion: string
  onCheckForUpdates: () => void
  checkingForUpdates: boolean
  showToast: ShowToast
}

interface ToggleProps {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  title: string
  children: ComponentChildren
}

function Toggle({ checked, disabled, onChange, title, children }: ToggleProps): JSX.Element {
  return (
    <label className={`flex items-start gap-3 select-none ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="mt-0.5 accent-accent-blue"
      />
      <div className="flex-1">
        <div className="text-white text-sm">{title}</div>
        <div className="text-gray-400 text-xs">{children}</div>
      </div>
    </label>
  )
}

function SectionTitle({ children }: { children: ComponentChildren }): JSX.Element {
  return <h3 className="text-gray-300 text-sm font-medium">{children}</h3>
}

const HOTKEY_HINTS = {
  'needs-modifier': 'Add Ctrl, Alt or Win — a bare key would be swallowed in every app.',
  'unsupported-key': 'Use a letter, a digit or a function key.',
} as const

// Every change in this panel applies as soon as it is made. There is no
// Save / Cancel pair to wonder about: "Done" only closes.
export function SettingsPanel({
  gridPorts,
  isCustomGrid,
  onChangeGridPorts,
  preferences,
  onUpdatePreferences,
  onChangeHotkey,
  onClose,
  appVersion,
  onCheckForUpdates,
  checkingForUpdates,
  showToast,
}: SettingsPanelProps): JSX.Element {
  const [newPort, setNewPort] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [portError, setPortError] = useState('')
  const [newProtected, setNewProtected] = useState('')
  const [recording, setRecording] = useState(false)
  const [hotkeyNote, setHotkeyNote] = useState('')
  // null until the registry has been read.
  const [autostart, setAutostartState] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    getAutostart().then(
      enabled => { if (!cancelled) setAutostartState(enabled) },
      () => { if (!cancelled) setAutostartState(false) },
    )
    return () => { cancelled = true }
  }, [])

  const toggleAutostart = async (enabled: boolean) => {
    setAutostartState(enabled)
    try {
      await setAutostart(enabled)
    } catch (err) {
      setAutostartState(!enabled)
      showToast(`Could not change the startup setting: ${errorMessage(err)}`, 'error')
    }
  }

  const addPort = () => {
    const port = parsePortNumber(newPort)
    if (port === null) {
      setPortError('Enter a port between 1 and 65535.')
      return
    }
    if (gridPorts.some(p => p.port === port)) {
      setPortError(`Port ${port} is already in the grid.`)
      return
    }
    onChangeGridPorts([...gridPorts, {
      port,
      label: port.toString(),
      description: (newDesc.trim() || 'Custom').slice(0, 32),
    }])
    setNewPort('')
    setNewDesc('')
    setPortError('')
  }

  const handleAddKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPort()
    }
  }

  const addProtected = () => {
    const name = newProtected.trim().toLowerCase()
    if (!name || preferences.protectedNames.includes(name)) {
      setNewProtected('')
      return
    }
    onUpdatePreferences({ protectedNames: [...preferences.protectedNames, name] })
    setNewProtected('')
  }

  const applyHotkey = async (accelerator: string) => {
    setRecording(false)
    if (accelerator === preferences.hotkey) {
      setHotkeyNote('')
      return
    }
    const error = await onChangeHotkey(accelerator)
    setHotkeyNote(error ? `${hotkeyParts(accelerator).join(' + ')} could not be registered: ${error}` : '')
  }

  const handleHotkeyKeyDown = (e: KeyboardEvent) => {
    if (!recording) return
    // Keep the key press away from the app-wide handlers while recording.
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') {
      setRecording(false)
      setHotkeyNote('')
      return
    }
    const result = captureHotkey(e)
    if (result.ok) applyHotkey(result.accelerator)
    else if (result.reason !== 'pending') setHotkeyNote(HOTKEY_HINTS[result.reason])
  }

  return (
    <Modal
      label="Settings"
      icon={<Icons.Settings className="w-5 h-5 text-accent-blue flex-shrink-0" />}
      onClose={onClose}
      footer={
        <div className="flex justify-end p-3">
          <button onClick={onClose} className="btn btn-primary px-5">Done</button>
        </div>
      }
    >
      <div className="p-4 space-y-5">
        <section className="space-y-3">
          <SectionTitle>Behavior</SectionTitle>

          <Toggle
            title="Start with Windows"
            checked={autostart === true}
            disabled={autostart === null}
            onChange={toggleAutostart}
          >
            Launch quietly into the tray when you sign in, so the shortcut is always ready.
          </Toggle>

          <Toggle
            title="Always on top"
            checked={preferences.alwaysOnTop}
            onChange={(alwaysOnTop) => onUpdatePreferences({ alwaysOnTop })}
          >
            Keep the window above other apps. Toggle anytime with the pin icon in the title bar.
          </Toggle>

          <Toggle
            title="Hide when window loses focus"
            checked={preferences.minimizeOnBlur}
            onChange={(minimizeOnBlur) => onUpdatePreferences({ minimizeOnBlur })}
          >
            Auto-hide to tray as soon as you click another app.
          </Toggle>

          <Toggle
            title="Show common ports grid"
            checked={preferences.showCommonPorts}
            onChange={(showCommonPorts) => onUpdatePreferences({ showCommonPorts })}
          >
            The dev-port shortcuts at the top of the window.
          </Toggle>

          <div>
            <span id="hotkey-label" className="text-white text-sm block mb-1">Show / hide shortcut</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setRecording(true); setHotkeyNote('') }}
                onKeyDown={handleHotkeyKeyDown}
                onBlur={() => setRecording(false)}
                aria-labelledby="hotkey-label"
                aria-describedby="hotkey-desc"
                className={`input-field py-1.5 text-sm text-left flex items-center gap-1 ${recording ? 'border-accent-blue/60 ring-1 ring-accent-blue/30' : ''}`}
              >
                {recording ? (
                  <span className="text-accent-blue">Press the new shortcut… (Esc to cancel)</span>
                ) : (
                  hotkeyParts(preferences.hotkey).map((part, i) => (
                    <span key={part} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-400 text-[10px]">+</span>}
                      <kbd className="kbd">{part}</kbd>
                    </span>
                  ))
                )}
              </button>
              {preferences.hotkey !== DEFAULT_HOTKEY && (
                <button
                  onClick={() => applyHotkey(DEFAULT_HOTKEY)}
                  className="btn btn-ghost px-2 whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
            <p id="hotkey-desc" className={`text-xs mt-1 ${hotkeyNote ? 'text-accent-yellow' : 'text-gray-400'}`} role={hotkeyNote ? 'alert' : undefined}>
              {hotkeyNote || 'Works from any app. Click the field, then press the keys you want.'}
            </p>
          </div>

          <div>
            <label htmlFor="poll-interval" className="text-white text-sm block mb-1">
              Refresh rate
            </label>
            <select
              id="poll-interval"
              value={preferences.pollIntervalMs}
              onChange={(e) => onUpdatePreferences({ pollIntervalMs: parseInt(e.currentTarget.value, 10) })}
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

        <section className="border-t border-dark-500 pt-4">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>Common ports</SectionTitle>
            {isCustomGrid && (
              <button
                onClick={() => { onChangeGridPorts(null); setPortError('') }}
                className="text-xs text-gray-400 hover:text-white rounded px-1 focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
              >
                Reset to defaults
              </button>
            )}
          </div>

          {gridPorts.length === 0 ? (
            <p className="text-gray-400 text-xs py-2">No ports in the grid. Add one below, or reset to the defaults.</p>
          ) : (
            <ul className="space-y-1 max-h-44 overflow-y-auto">
              {gridPorts.map((port) => (
                <li key={port.port} className="flex items-center gap-2 bg-dark-700 rounded px-3 py-2">
                  <span className="text-white font-mono text-sm w-16">{port.port}</span>
                  <span className="text-gray-400 text-sm flex-1 truncate">{port.description}</span>
                  <button
                    onClick={() => onChangeGridPorts(gridPorts.filter(p => p.port !== port.port))}
                    className="text-gray-400 hover:text-accent-red transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-accent-red/40"
                    aria-label={`Remove port ${port.port}`}
                  >
                    <Icons.Close className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 mt-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Port"
              value={newPort}
              onInput={(e) => { setNewPort(e.currentTarget.value); setPortError('') }}
              onKeyDown={handleAddKeyDown}
              className="input-field w-24 text-sm py-2"
              aria-label="Port number"
              aria-invalid={portError ? 'true' : undefined}
              aria-describedby={portError ? 'port-error' : undefined}
              maxLength={5}
            />
            <input
              type="text"
              placeholder="Description"
              value={newDesc}
              onInput={(e) => setNewDesc(e.currentTarget.value)}
              onKeyDown={handleAddKeyDown}
              className="input-field flex-1 text-sm py-2"
              aria-label="Port description"
              maxLength={32}
            />
            <button onClick={addPort} disabled={!newPort.trim()} className="btn btn-ghost px-3 disabled:opacity-50">
              Add
            </button>
          </div>
          {portError && (
            <p id="port-error" role="alert" className="text-accent-red text-xs mt-1">{portError}</p>
          )}
        </section>

        <section className="border-t border-dark-500 pt-4">
          <SectionTitle>Never kill</SectionTitle>
          <p className="text-gray-400 text-xs mt-1 mb-2">
            Processes listed here are treated as protected, on top of the built-in Windows system processes.
          </p>
          {preferences.protectedNames.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mb-2">
              {preferences.protectedNames.map(name => (
                <li key={name} className="chip">
                  <span className="font-mono">{name}</span>
                  <button
                    onClick={() => onUpdatePreferences({
                      protectedNames: preferences.protectedNames.filter(n => n !== name),
                    })}
                    className="text-gray-400 hover:text-white rounded focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
                    aria-label={`Stop protecting ${name}`}
                  >
                    <Icons.Close className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Process name, e.g. postgres.exe"
              value={newProtected}
              onInput={(e) => setNewProtected(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProtected() } }}
              className="input-field flex-1 text-sm py-2"
              aria-label="Process name to protect"
              maxLength={64}
            />
            <button onClick={addProtected} disabled={!newProtected.trim()} className="btn btn-ghost px-3 disabled:opacity-50">
              Add
            </button>
          </div>
        </section>

        <section className="border-t border-dark-500 pt-4 space-y-3">
          <SectionTitle>Updates</SectionTitle>
          <div className="flex items-center justify-between gap-2">
            <div className="text-white text-sm">
              PortKiller{appVersion ? ` v${appVersion}` : ''}
            </div>
            <button
              onClick={onCheckForUpdates}
              disabled={checkingForUpdates}
              className="btn btn-ghost px-3 disabled:opacity-50 whitespace-nowrap"
            >
              {checkingForUpdates ? 'Checking…' : 'Check for updates'}
            </button>
          </div>
          <Toggle
            title="Check for updates at launch"
            checked={preferences.checkUpdatesOnLaunch}
            onChange={(checkUpdatesOnLaunch) => onUpdatePreferences({ checkUpdatesOnLaunch })}
          >
            Contacts GitHub once per start. You are asked before anything is downloaded or installed.
          </Toggle>
        </section>
      </div>
    </Modal>
  )
}
