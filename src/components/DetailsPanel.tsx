import type { ComponentChildren, JSX } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import type { PortInfo, ProcessDetails } from '../types'
import { isPublicBinding, isTcp } from '../lib/ports'
import { formatBytes, plural } from '../lib/format'
import { useConfirm } from '../hooks/useConfirm'
import type { PortActions } from '../hooks/usePortActions'
import { Icons } from './Icons'
import { Modal } from './Modal'

interface DetailsPanelProps {
  port: PortInfo
  onClose: () => void
  /** Kill without further confirmation — this panel confirms in place. */
  onKill: (port: PortInfo, opts: { tree: boolean }) => void
  actions: PortActions
}

function Field({ label, children }: { label: string; children: ComponentChildren }): JSX.Element {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-gray-400 text-sm flex-shrink-0">{label}</span>
      {children}
    </div>
  )
}

export function DetailsPanel({ port, onClose, onKill, actions }: DetailsPanelProps): JSX.Element {
  const [details, setDetails] = useState<ProcessDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const { armed, confirm } = useConfirm<'kill' | 'tree'>()

  useEffect(() => {
    let cancelled = false
    const fetchDetails = async () => {
      try {
        const data = await invoke<ProcessDetails>('get_process_details', { pid: port.pid })
        if (!cancelled) setDetails(data)
      } catch {
        // The process may have exited, or belong to another user. The panel
        // still shows what the port list already knows.
        if (!cancelled) setDetails(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDetails()
    // Memory and CPU are live figures; keep them moving while the panel is open.
    const interval = setInterval(fetchDetails, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [port.pid])

  const isPublic = isPublicBinding(port.local_address)
  const childCount = details?.children.length ?? 0

  const kill = (id: 'kill' | 'tree') => {
    if (confirm(id)) {
      onKill(port, { tree: id === 'tree' })
      onClose()
    }
  }

  return (
    <Modal
      label="Process details"
      icon={<Icons.Process className="w-5 h-5 text-accent-blue flex-shrink-0" />}
      widthClass="w-[400px]"
      onClose={onClose}
      trapDeps={[loading]}
    >
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Loading process details">
            <Icons.Spinner className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <Field label="Port">
                <span className="text-white font-mono text-sm">:{port.port}</span>
              </Field>
              <Field label="Protocol">
                <span className="text-white text-sm">{port.protocol}</span>
              </Field>
              <Field label="PID">
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm">{port.pid}</span>
                  <button
                    onClick={() => actions.copy(port.pid.toString(), `PID ${port.pid}`)}
                    className="text-gray-400 hover:text-white p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
                    title="Copy PID"
                    aria-label="Copy PID to clipboard"
                  >
                    <Icons.Copy className="w-3 h-3" />
                  </button>
                </div>
              </Field>
              <Field label="Process">
                <span className="text-white text-sm truncate">{port.process_name}</span>
              </Field>
              {port.local_address && (
                <Field label="Bound to">
                  <span
                    className={`text-sm font-mono truncate ${isPublic ? 'text-accent-yellow' : 'text-white'}`}
                    title={
                      isPublic
                        ? 'Bound to all interfaces — reachable from outside this machine'
                        : 'Bound to a single interface'
                    }
                  >
                    {port.local_address}
                  </span>
                </Field>
              )}
              {port.process_path && (
                <div>
                  <span className="text-gray-400 text-sm block mb-1">Path</span>
                  <p className="text-gray-300 text-xs font-mono bg-dark-700 p-2 rounded break-all select-text">
                    {port.process_path}
                  </p>
                </div>
              )}
              {port.command_line && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 text-sm">Command line</span>
                    <button
                      onClick={() => actions.copy(port.command_line, 'command line')}
                      className="text-gray-400 hover:text-white p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
                      title="Copy command line"
                      aria-label="Copy command line to clipboard"
                    >
                      <Icons.Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-gray-300 text-xs font-mono bg-dark-700 p-2 rounded break-all max-h-24 overflow-y-auto select-text">
                    {port.command_line}
                  </p>
                </div>
              )}
              {details ? (
                <>
                  <Field label="Memory">
                    <span className="text-white text-sm">{formatBytes(details.memory_bytes)}</span>
                  </Field>
                  <Field label="CPU">
                    <span className="text-white text-sm">{details.cpu_percent.toFixed(1)}%</span>
                  </Field>
                  {childCount > 0 && (
                    <Field label="Children">
                      <span className="text-white text-sm">{plural(childCount, 'process')}</span>
                    </Field>
                  )}
                </>
              ) : (
                <p className="text-gray-400 text-xs">
                  Live memory and CPU figures are unavailable for this process.
                </p>
              )}
              <Field label="Status">
                <span className={`text-sm ${port.is_protected ? 'text-accent-yellow' : 'text-accent-green'}`}>
                  {port.is_protected ? 'Protected' : 'Killable'}
                </span>
              </Field>
            </div>

            {isTcp(port) && (
              <button
                onClick={() => actions.openBrowser(port)}
                className="btn btn-ghost w-full flex items-center justify-center gap-2 border border-dark-500"
                aria-label={`Open localhost:${port.port} in your browser`}
              >
                <Icons.ExternalLink className="w-4 h-4" />
                <span>Open localhost:{port.port}</span>
              </button>
            )}

            <div className="flex gap-2 pt-2 border-t border-dark-500">
              {port.process_path && (
                <button
                  onClick={() => actions.openFolder(port)}
                  className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
                >
                  <Icons.Folder className="w-4 h-4" />
                  <span>Open Folder</span>
                </button>
              )}
              <button
                onClick={actions.openTaskManager}
                className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
              >
                <Icons.Process className="w-4 h-4" />
                <span>Task Manager</span>
              </button>
            </div>

            {!port.is_protected && (
              <div className="space-y-2">
                <button
                  onClick={() => kill('kill')}
                  className={`btn btn-danger w-full flex items-center justify-center gap-2 ${armed === 'kill' ? 'animate-pulse' : ''}`}
                >
                  {armed === 'kill' ? <Icons.Warning className="w-4 h-4" /> : <Icons.Trash className="w-4 h-4" />}
                  <span>{armed === 'kill' ? `Click again to kill ${port.process_name}` : 'Kill Process'}</span>
                </button>
                {childCount > 0 && (
                  <button
                    onClick={() => kill('tree')}
                    className={`btn btn-ghost border border-accent-red/25 text-accent-red w-full flex items-center justify-center gap-2 ${armed === 'tree' ? 'animate-pulse' : ''}`}
                  >
                    {armed === 'tree' ? <Icons.Warning className="w-4 h-4" /> : <Icons.Trash className="w-4 h-4" />}
                    <span>
                      {armed === 'tree'
                        ? `Click again to kill ${plural(childCount + 1, 'process')}`
                        : `Kill with ${plural(childCount, 'child process')}`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
