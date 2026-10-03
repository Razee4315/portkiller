import type { JSX } from 'preact'
import { COMMAND_HELP } from '../lib/commands'
import { hotkeyParts } from '../lib/hotkey'
import { Icons } from './Icons'
import { Modal } from './Modal'

interface ShortcutsPanelProps {
  /** The user's global show/hide shortcut, e.g. "Alt+P". */
  hotkey: string
  onClose: () => void
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['0–9'], label: 'Start typing a port number from anywhere' },
  { keys: ['/'], label: 'Focus search' },
  { keys: ['↑', '↓'], label: 'Move through the list' },
  { keys: ['j', 'k'], label: 'Move through the list (vim-style)' },
  { keys: ['Enter'], label: 'Kill the highlighted port (press twice)' },
  { keys: ['Delete'], label: 'Kill the highlighted port (press twice)' },
  { keys: ['Space'], label: 'Tick the highlighted row for a bulk kill' },
  { keys: ['Ctrl', 'Click'], label: 'Tick a row for a bulk kill' },
  { keys: ['Shift', 'Click'], label: 'Tick every row up to the clicked one' },
  { keys: ['Ctrl', 'A'], label: 'Tick every visible killable port' },
  { keys: ['p'], label: 'Pin / unpin the highlighted port' },
  { keys: ['h'], label: 'Show recently killed processes' },
  { keys: ['Ctrl', 'C'], label: 'Copy the highlighted port:pid' },
  { keys: ['F5'], label: 'Refresh the port list now' },
  { keys: ['Ctrl', 'R'], label: 'Refresh the port list now' },
  { keys: ['Esc'], label: 'Cancel, close, clear search, then hide' },
  { keys: ['?'], label: 'Show this cheatsheet' },
]

function Keys({ keys }: { keys: string[] }): JSX.Element {
  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      {keys.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-400 text-[10px]">+</span>}
          <kbd className="kbd">{k}</kbd>
        </span>
      ))}
    </span>
  )
}

export function ShortcutsPanel({ hotkey, onClose }: ShortcutsPanelProps): JSX.Element {
  return (
    <Modal
      label="Keyboard shortcuts"
      icon={<Icons.Keyboard className="w-5 h-5 text-accent-blue flex-shrink-0" />}
      widthClass="w-[440px]"
      onClose={onClose}
    >
      <div className="p-4 space-y-5">
        <section>
          <span className="text-gray-300 text-xs font-medium block mb-2">Keys</span>
          <ul className="space-y-1.5">
            <li className="flex items-center justify-between gap-3">
              <span className="text-gray-300 text-sm">Show or hide PortKiller from anywhere</span>
              <Keys keys={hotkeyParts(hotkey)} />
            </li>
            {SHORTCUTS.map(({ keys, label }) => (
              <li key={`${keys.join('+')}-${label}`} className="flex items-center justify-between gap-3">
                <span className="text-gray-300 text-sm">{label}</span>
                <Keys keys={keys} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <span className="text-gray-300 text-xs font-medium block mb-2">
            Commands (type into the search bar, then Enter)
          </span>
          <ul className="space-y-1.5">
            {COMMAND_HELP.map(({ cmd, label, aliases }) => (
              <li key={cmd} className="flex items-center justify-between gap-3">
                <span className="text-gray-300 text-sm">{label}</span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  <code className="kbd text-accent-blue">{cmd}</code>
                  {aliases?.map(alias => (
                    <code key={alias} className="kbd text-gray-400" title={`Short for "${cmd}"`}>{alias}</code>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  )
}
