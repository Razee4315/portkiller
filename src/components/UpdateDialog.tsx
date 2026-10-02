import type { JSX } from 'preact'
import { useMemo } from 'preact/hooks'
import type { UpdaterState } from '../hooks/useUpdater'
import { Icons } from './Icons'
import { Modal } from './Modal'

/**
 * The GitHub release body is what `update.body` carries. The release workflow
 * prepends the changelog and appends a generic Installation / Requirements block
 * (kept for the GitHub release page). Strip that boilerplate so the in-app
 * dialog only ever shows the real changes — degrading gracefully to just the
 * version line when there's nothing else.
 */
function cleanReleaseNotes(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n').trim()
  // Cut the generic install/requirements/quick-start sections (and everything
  // after) if present.
  const cut = s.search(/^#{1,6}\s+(Installation|Requirements|Quick Start)\b/im)
  if (cut >= 0) s = s.slice(0, cut).trim()
  // The dialog header already names the version, so drop a redundant leading
  // "## What's new…" / "## PortKiller vX" title line.
  s = s.replace(/^#{1,6}\s+(What's new|PortKiller)\b.*\n+/i, '')
  return s.trim()
}

// Inline markdown: **bold** and `code`. Everything else is plain text. Kept
// deliberately tiny — changelog bullets don't justify a full markdown engine,
// and PortKiller ships preact-only with no react-markdown dependency.
function renderInline(text: string): (JSX.Element | string)[] {
  const out: (JSX.Element | string)[] = []
  const regex = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      out.push(
        <strong key={key++} className="font-semibold text-white">
          {m[1]}
        </strong>,
      )
    } else if (m[2] !== undefined) {
      out.push(
        <code
          key={key++}
          className="rounded bg-dark-700 px-1 py-0.5 font-mono text-[11px] text-gray-200"
        >
          {m[2]}
        </code>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// Line-based block renderer: `#`-headings become small section labels, `-`/`*`
// lines group into accent-dotted bullet lists, the rest are paragraphs.
function renderNotes(text: string): JSX.Element[] {
  const out: JSX.Element[] = []
  let bullets: string[] = []
  let key = 0

  const flush = () => {
    if (bullets.length === 0) return
    const items = bullets
    out.push(
      <ul key={`ul-${key++}`} className="my-1 space-y-1">
        {items.map((b, i) => (
          <li
            key={i}
            className="relative pl-4 text-xs leading-relaxed text-gray-400 before:absolute before:left-0 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:bg-accent-blue"
          >
            {renderInline(b)}
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      flush()
      out.push(
        <p
          key={`h-${key++}`}
          className="mt-3 mb-1 first:mt-0 text-[11px] font-semibold uppercase tracking-wider text-gray-400"
        >
          {renderInline(heading[1])}
        </p>,
      )
      continue
    }
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      bullets.push(bullet[1])
      continue
    }
    flush()
    out.push(
      <p key={`p-${key++}`} className="my-1 text-xs leading-relaxed text-gray-400">
        {renderInline(line)}
      </p>,
    )
  }
  flush()
  return out
}

/**
 * "Update available" dialog. Purely presentational — the {@link useUpdater}
 * hook drives all state. Renders nothing until an update is found, then offers
 * Update now / Later / Skip this version, shows a download progress bar, and
 * lists the release's changelog. Escape dismisses it like "Later" (handled by
 * the app-level key handler) except while a download or install is running.
 */
export function UpdateDialog({
  update,
  phase,
  progress,
  error,
  install,
  skip,
  dismiss,
}: UpdaterState): JSX.Element | null {
  const busy = phase === 'downloading' || phase === 'installed'

  // Boilerplate-stripped notes. Empty when the body carries only install
  // instructions — the dialog then just shows the version line.
  const notes = useMemo(
    () => (update?.body ? cleanReleaseNotes(update.body) : ''),
    [update],
  )

  if (!update) return null

  return (
    // An in-flight download or install can't be cancelled, so the dialog
    // can't be dismissed while one is running.
    <Modal
      label="Update available"
      widthClass="w-[440px]"
      dismissible={!busy}
      onClose={dismiss}
      trapDeps={[phase]}
    >
        <div className="flex items-start gap-3 px-5 pt-5 pb-4">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-accent-blue/10 flex items-center justify-center">
            <Icons.Download className="w-5 h-5 text-accent-blue" />
          </div>
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-base">Update available</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              PortKiller{' '}
              <span className="font-semibold text-white">v{update.version}</span> is
              ready — you're on v{update.currentVersion}.
            </p>
          </div>
        </div>

        {notes && phase === 'available' && (
          <div className="px-5 pb-1">
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <Icons.Bell className="w-3.5 h-3.5 text-accent-blue" />
              What's new
            </div>
            <div className="max-h-52 overflow-y-auto pr-1 -mr-1">{renderNotes(notes)}</div>
          </div>
        )}

        {busy && (
          <div className="px-5 pb-1">
            <div className="h-1.5 w-full rounded-full bg-dark-700 overflow-hidden">
              <div
                className={`h-full rounded-full bg-accent-blue transition-[width] duration-200 ${
                  progress < 0 ? 'w-full animate-pulse' : ''
                }`}
                style={progress >= 0 ? { width: `${Math.round(progress * 100)}%` } : undefined}
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {phase === 'installed'
                ? 'Installed — restarting…'
                : progress >= 0
                  ? `Downloading… ${Math.round(progress * 100)}%`
                  : 'Downloading…'}
            </p>
          </div>
        )}

        {phase === 'error' && (
          <p className="px-5 pb-1 text-xs text-accent-red break-words">
            Update failed: {error}
          </p>
        )}

        {!busy && (
          <div className="flex items-center justify-end gap-2 p-4 mt-3 border-t border-dark-500 bg-dark-800">
            {phase === 'available' && (
              <>
                <button onClick={skip} className="btn btn-ghost px-3" type="button">
                  Skip this version
                </button>
                <button onClick={dismiss} className="btn btn-ghost px-3" type="button">
                  Later
                </button>
                <button onClick={install} className="btn btn-primary px-4" type="button" autoFocus>
                  Update now
                </button>
              </>
            )}
            {phase === 'error' && (
              <>
                <button onClick={dismiss} className="btn btn-ghost px-3" type="button">
                  Close
                </button>
                <button onClick={install} className="btn btn-primary px-4" type="button">
                  Try again
                </button>
              </>
            )}
          </div>
        )}
    </Modal>
  )
}
