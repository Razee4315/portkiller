import type { JSX } from 'preact'
import type { KillRecord } from '../types'
import { timeAgo } from '../lib/format'
import { Icons } from './Icons'
import { Modal } from './Modal'

interface HistoryPanelProps {
  history: KillRecord[]
  onClose: () => void
  onClear: () => void
}

export function HistoryPanel({ history, onClose, onClear }: HistoryPanelProps): JSX.Element {
  return (
    <Modal
      label={history.length > 0 ? `Recently killed (${history.length})` : 'Recently killed'}
      icon={<Icons.History className="w-5 h-5 text-accent-blue flex-shrink-0" />}
      onClose={onClose}
      headerActions={history.length > 0 && (
        <button
          onClick={onClear}
          className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-accent-blue/40"
          aria-label="Clear kill history"
        >
          Clear
        </button>
      )}
    >
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Icons.Empty className="w-6 h-6 text-gray-400 mb-2" />
          <p className="text-gray-300 text-sm">No kills recorded yet</p>
          <p className="text-gray-400 text-xs mt-1">
            The last 15 processes you kill are listed here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-dark-600">
          {history.map((record) => (
            <li
              key={`${record.timestamp}-${record.port}-${record.pid}`}
              className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-dark-700/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm">:{record.port}</span>
                  <span className="text-gray-400 font-mono text-[11px]">PID {record.pid}</span>
                </div>
                <p className="text-gray-300 text-xs truncate">{record.processName}</p>
              </div>
              <span
                className="text-gray-400 text-[11px] flex-shrink-0"
                title={new Date(record.timestamp).toLocaleString()}
              >
                {timeAgo(record.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
