import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getSkippedUpdateVersion, setSkippedUpdateVersion } from '../types'
import { errorMessage } from '../lib/system'
import type { ShowToast } from './useToast'

export type UpdatePhase =
  | 'idle'
  | 'available'
  | 'downloading'
  | 'installed'
  | 'error'

export interface UpdaterState {
  /** The pending update, or null when there's nothing to install. */
  update: Update | null
  phase: UpdatePhase
  /** Download progress 0..1, or -1 when the content length is unknown. */
  progress: number
  error: string
  /** True while a manual "Check for updates" request is in flight. */
  checking: boolean
  checkNow: () => Promise<void>
  install: () => Promise<void>
  skip: () => void
  dismiss: () => void
}

/**
 * Owns the auto-updater lifecycle so the launch dialog and the Settings
 * "Check for updates" button share one source of truth.
 *
 * On mount, unless the user turned launch checks off, it checks GitHub
 * Releases (the signed `latest.json` pointed at by `tauri.conf.json`)
 * exactly once. The check is SILENT on failure — dev builds
 * have no matching release and offline machines can't reach GitHub, and neither
 * should ever see an error popup they can't act on. A version the user chose to
 * "Skip" is remembered and suppressed.
 */
export function useUpdater(showToast: ShowToast, checkOnLaunch: boolean): UpdaterState {
  const [update, setUpdate] = useState<Update | null>(null)
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  // Guard against overlapping checks (rapid Settings clicks) without making the
  // async callback depend on the `checking` state value.
  const checkingRef = useRef(false)

  // Read once: toggling the preference later must not trigger a check.
  const checkOnLaunchRef = useRef(checkOnLaunch)

  useEffect(() => {
    if (!checkOnLaunchRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const upd = await check()
        if (cancelled || !upd) return
        if (getSkippedUpdateVersion() === upd.version) return
        setUpdate(upd)
        setPhase('available')
      } catch {
        /* offline / dev build without an updater endpoint — stay silent */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Manual check from Settings. Unlike the silent startup check, this always
  // gives explicit feedback so the button never feels dead.
  const checkNow = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    setChecking(true)
    try {
      const upd = await check()
      if (upd) {
        setUpdate(upd)
        setPhase('available')
      } else {
        showToast("You're on the latest version", 'success')
      }
    } catch (e) {
      showToast(`Update check failed: ${errorMessage(e)}`, 'error')
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }, [showToast])

  const install = useCallback(async () => {
    if (!update) return
    setPhase('downloading')
    setError('')
    let total = 0
    let received = 0
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
          setProgress(total ? 0 : -1)
        } else if (event.event === 'Progress') {
          received += event.data.chunkLength
          if (total) setProgress(Math.min(received / total, 1))
        } else if (event.event === 'Finished') {
          setProgress(1)
        }
      })
      setPhase('installed')
      // The installer has replaced the binary on disk; relaunch into it.
      await relaunch()
    } catch (e) {
      setError(errorMessage(e))
      setPhase('error')
    }
  }, [update])

  const dismiss = useCallback(() => {
    setUpdate(null)
    setPhase('idle')
  }, [])

  const skip = useCallback(() => {
    if (update) setSkippedUpdateVersion(update.version)
    dismiss()
  }, [update, dismiss])

  return { update, phase, progress, error, checking, checkNow, install, skip, dismiss }
}
