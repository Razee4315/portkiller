import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import type { AppState, KillResult, PortInfo } from '../types'
import { portKey, uniqueByPid } from '../lib/ports'
import { errorMessage } from '../lib/system'
import { plural } from '../lib/format'
import { CONFIRM_WINDOW_MS } from './useConfirm'
import type { ShowToast } from './useToast'

/** Windows needs a moment to tear the socket down after the process dies. */
const SETTLE_MS = 400

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export type KillRequest = 'armed' | 'executed' | 'blocked'

interface UseKillOptions {
  isAdmin: boolean
  refresh: () => Promise<AppState | null>
  showToast: ShowToast
  /** Called once per process that was actually terminated. */
  onKilled: (port: PortInfo) => void
}

export interface UseKill {
  /** Row key waiting for its confirming press, if any. */
  pendingKill: string | null
  /** Row keys with a kill in flight. */
  killingKeys: Set<string>
  pendingBulk: boolean
  bulkBusy: boolean
  /** First call arms, second call (same row, within the window) kills. */
  requestKill: (port: PortInfo) => KillRequest
  /** Kill immediately. For surfaces that run their own confirmation. */
  executeKill: (port: PortInfo, opts?: { tree?: boolean }) => Promise<void>
  /** Same two-step flow for a set of rows; pass the already-deduped targets. */
  requestBulkKill: (targets: PortInfo[]) => Promise<KillRequest>
  cancelPending: () => void
}

const NO_KEYS = new Set<string>()

function killRaw(port: PortInfo, tree: boolean): Promise<KillResult> {
  return invoke<KillResult>('kill_process', { pid: port.pid, port: port.port, tree })
}

export function useKill({ isAdmin, refresh, showToast, onKilled }: UseKillOptions): UseKill {
  const [pendingKill, setPendingKill] = useState<string | null>(null)
  const [pendingBulk, setPendingBulk] = useState(false)
  const [killingKeys, setKillingKeys] = useState<Set<string>>(NO_KEYS)
  const [bulkBusy, setBulkBusy] = useState(false)
  const bulkBusyRef = useRef(false)

  // An armed confirmation expires on its own so a stray press much later
  // cannot complete it.
  useEffect(() => {
    if (!pendingKill && !pendingBulk) return
    const timer = setTimeout(() => {
      setPendingKill(null)
      setPendingBulk(false)
    }, CONFIRM_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [pendingKill, pendingBulk])

  const cancelPending = useCallback(() => {
    setPendingKill(null)
    setPendingBulk(false)
  }, [])

  const failureMessage = useCallback((result: KillResult, port: PortInfo): string => {
    const name = result.process_name || port.process_name
    switch (result.code) {
      case 'protected':
        return `${name} is a protected system process`
      case 'gone':
        return `${name} has already exited`
      case 'stale':
        return `PID ${port.pid} no longer owns port ${port.port} — list refreshed`
      case 'denied':
        return isAdmin
          ? `Access denied even as Administrator — Windows protects ${name}`
          : `Access denied — restart as Administrator to kill ${name}`
      default:
        return `Could not kill ${name}${result.detail ? `: ${result.detail}` : ''}`
    }
  }, [isAdmin])

  const executeKill = useCallback(async (port: PortInfo, { tree = false }: { tree?: boolean } = {}) => {
    const key = portKey(port)
    setKillingKeys(prev => new Set(prev).add(key))
    try {
      const result = await killRaw(port, tree)
      if (result.code !== 'ok') {
        showToast(failureMessage(result, port), 'error')
        // The row is out of date in these two cases; fix the list.
        if (result.code === 'gone' || result.code === 'stale') await refresh()
        return
      }

      onKilled(port)
      // Don't claim the port is free until the list says so: a child process
      // or a supervisor that respawns can still be holding it.
      await delay(SETTLE_MS)
      const fresh = await refresh()
      const holder = fresh?.ports.find(p => p.port === port.port && p.protocol === port.protocol)
      const name = result.process_name || port.process_name
      if (holder) {
        showToast(
          `Killed ${name}, but port ${port.port} is still held by ${holder.process_name} (PID ${holder.pid})`,
          'error',
        )
      } else {
        showToast(`Port ${port.port} freed — killed ${name}`, 'success')
      }
    } catch (err) {
      showToast(`Could not kill ${port.process_name}: ${errorMessage(err)}`, 'error')
    } finally {
      setKillingKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next.size === 0 ? NO_KEYS : next
      })
    }
  }, [failureMessage, onKilled, refresh, showToast])

  const requestKill = useCallback((port: PortInfo): KillRequest => {
    if (port.is_protected) {
      showToast(`Cannot kill protected process: ${port.process_name}`, 'error')
      return 'blocked'
    }
    const key = portKey(port)
    setPendingBulk(false)
    if (pendingKill === key) {
      setPendingKill(null)
      executeKill(port)
      return 'executed'
    }
    setPendingKill(key)
    return 'armed'
  }, [pendingKill, executeKill, showToast])

  const requestBulkKill = useCallback(async (targets: PortInfo[]): Promise<KillRequest> => {
    if (bulkBusyRef.current) return 'blocked'
    const processes = uniqueByPid(targets.filter(p => !p.is_protected))
    if (processes.length === 0) {
      showToast('No killable ports selected', 'error')
      return 'blocked'
    }
    setPendingKill(null)
    if (!pendingBulk) {
      setPendingBulk(true)
      return 'armed'
    }

    setPendingBulk(false)
    bulkBusyRef.current = true
    setBulkBusy(true)
    setKillingKeys(new Set(processes.map(portKey)))
    try {
      const results = await Promise.allSettled(processes.map(p => killRaw(p, false)))
      const killed = processes.filter((_, i) => {
        const r = results[i]
        return r.status === 'fulfilled' && r.value.code === 'ok'
      })
      killed.forEach(onKilled)
      await delay(SETTLE_MS)
      await refresh()
      showToast(
        `Killed ${killed.length} of ${plural(processes.length, 'process')}`,
        killed.length === processes.length ? 'success' : 'error',
      )
    } finally {
      bulkBusyRef.current = false
      setBulkBusy(false)
      setKillingKeys(NO_KEYS)
    }
    return 'executed'
  }, [pendingBulk, onKilled, refresh, showToast])

  return {
    pendingKill,
    killingKeys,
    pendingBulk,
    bulkBusy,
    requestKill,
    executeKill,
    requestBulkKill,
    cancelPending,
  }
}
