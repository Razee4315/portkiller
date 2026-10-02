import type { JSX, RefObject } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import type { CommandHelp } from '../lib/commands'
import { suggestCommands } from '../lib/commands'
import { Icons } from './Icons'

interface SearchBarProps {
  inputRef: RefObject<HTMLInputElement>
  value: string
  onChange: (value: string) => void
  /** Enter pressed: run the text as a command, or act on the search. */
  onSubmit: () => void
  /** ArrowDown pressed: hand the keyboard to the port list. */
  onArrowDown: () => void
}

const SUGGESTIONS_ID = 'command-suggestions'

// The search box is also the command line. As soon as the text looks like the
// start of a command, the matching commands are listed underneath so they can
// be discovered without opening the cheatsheet.
export function SearchBar({ inputRef, value, onChange, onSubmit, onArrowDown }: SearchBarProps): JSX.Element {
  const [focused, setFocused] = useState(false)
  const suggestions = useMemo(() => suggestCommands(value), [value])
  const open = focused && suggestions.length > 0

  const pick = (s: CommandHelp) => {
    onChange(s.fill ?? s.cmd)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSubmit()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onArrowDown()
    } else if (e.key === 'Tab' && !e.shiftKey && open) {
      // Tab completes the first suggestion instead of leaving the field.
      e.preventDefault()
      pick(suggestions[0])
    }
  }

  return (
    <div className="px-3 py-3 border-b border-dark-500">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder='Search "3000", a process, "3000-4000", or type help'
          value={value}
          onInput={(e) => onChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="input-field pl-9 pr-9"
          autoFocus
          spellcheck={false}
          autocomplete="off"
          aria-label="Search ports and processes, or type a command"
          role="combobox"
          aria-expanded={open}
          aria-controls={SUGGESTIONS_ID}
          aria-autocomplete="list"
        />
        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
        {value && (
          <button
            onClick={() => { onChange(''); inputRef.current?.focus() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
            aria-label="Clear search"
          >
            <Icons.Close className="w-3.5 h-3.5" />
          </button>
        )}
        {open && (
          <ul
            id={SUGGESTIONS_ID}
            role="listbox"
            aria-label="Matching commands"
            className="absolute left-0 right-0 top-full mt-1 z-40 bg-dark-800 border border-dark-500 rounded-lg shadow-2xl py-1 animate-fade-in"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.cmd}
                role="option"
                aria-selected={i === 0}
                // mousedown, not click: the input's blur would close the list
                // before a click could land.
                onMouseDown={(e) => { e.preventDefault(); pick(s) }}
                className="px-3 py-1.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-dark-600"
              >
                <code className="font-mono text-[12px] text-accent-blue flex-shrink-0">{s.cmd}</code>
                <span className="text-gray-300 text-[12px] truncate">{s.label}</span>
                {i === 0 && <kbd className="kbd flex-shrink-0">Tab</kbd>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
