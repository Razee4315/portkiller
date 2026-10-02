import { useMemo } from 'preact/hooks'
import type { PortInfo } from '../types'
import { copyText, errorMessage, openInBrowser, openTaskManager, revealInExplorer } from '../lib/system'
import { localUrl } from '../lib/ports'
import type { ShowToast } from './useToast'

/** Side-effecting actions shared by the details panel and the context menu. */
export interface PortActions {
  copy: (text: string, label: string) => void
  openFolder: (port: PortInfo) => void
  openTaskManager: () => void
  openBrowser: (port: PortInfo) => void
}

/**
 * Every action reports its own outcome through the toast, so no caller can
 * forget the error path and leave the user wondering whether a click landed.
 */
export function usePortActions(showToast: ShowToast): PortActions {
  return useMemo(() => {
    const run = (task: Promise<void>, failure: string, success?: string) => {
      task.then(
        () => { if (success) showToast(success, 'success') },
        (err) => showToast(`${failure}: ${errorMessage(err)}`, 'error'),
      )
    }
    return {
      copy: (text, label) => run(copyText(text), 'Could not copy to the clipboard', `Copied ${label}`),
      openFolder: (port) => run(revealInExplorer(port.process_path), 'Could not open the folder'),
      openTaskManager: () => run(openTaskManager(), 'Could not open Task Manager'),
      openBrowser: (port) => run(openInBrowser(port.port), `Could not open ${localUrl(port.port)}`),
    }
  }, [showToast])
}
