import type { JSX, RefObject } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { plural, timeAgo } from '../lib/format'
import { hotkeyParts } from '../lib/hotkey'
import { Icons } from './Icons'

interface FooterProps {
  portCount: number
  pinnedCount: number
  paused: boolean
  lastUpdatedRef: RefObject<number>
  hotkey: string
  onShowShortcuts: () => void
}

// Owns its own one-second tick. Kept as a leaf so the clock re-renders these
// few characters, not the whole window.
function LastUpdated({ lastUpdatedRef }: { lastUpdatedRef: RefObject<number> }): JSX.Element {
  const [text, setText] = useState('just now')
  useEffect(() => {
    const interval = setInterval(() => {
      setText(timeAgo(lastUpdatedRef.current ?? Date.now()))
    }, 1000)
    return () => clearInterval(interval)
  }, [lastUpdatedRef])
  return <span className="text-gray-400" title="Last refreshed">{text}</span>
}

const Separator = () => <span className="text-gray-600" aria-hidden="true">·</span>

export function Footer({ portCount, pinnedCount, paused, lastUpdatedRef, hotkey, onShowShortcuts }: FooterProps): JSX.Element {
  return (
    <footer
      data-tauri-drag-region
      className="drag-region px-3 py-1.5 border-t border-dark-500 flex items-center justify-between text-[11px] text-gray-300 bg-dark-900 select-none cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <span>{plural(portCount, 'port')}</span>
        {pinnedCount > 0 && (
          <>
            <Separator />
            <span className="text-accent-blue flex items-center gap-1" title={`${plural(pinnedCount, 'pinned port')}`}>
              <Icons.PinFilled className="w-2.5 h-2.5" />
              {pinnedCount}
            </span>
          </>
        )}
        <Separator />
        <LastUpdated lastUpdatedRef={lastUpdatedRef} />
        {paused && (
          <>
            <Separator />
            <span className="text-accent-yellow" title="Auto-refresh is set to manual in Settings">paused</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1 no-drag">
        <button
          onClick={onShowShortcuts}
          className="kbd hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
          title="Show keyboard shortcuts (press ?)"
          aria-label="Show keyboard shortcuts"
        >
          ?
        </button>
        <kbd className="kbd" title="Focus search">/</kbd>
        <kbd className="kbd" title="Cancel, close, clear search, then hide">Esc</kbd>
        <kbd className="kbd" title="Show or hide from anywhere">{hotkeyParts(hotkey).join('+')}</kbd>
      </div>
    </footer>
  )
}
