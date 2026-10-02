// Thin wrappers around the Tauri commands and plugins that reach outside the
// app. Each one throws on failure; callers decide how to tell the user.

import { invoke } from '@tauri-apps/api/core'
import { open as openShell } from '@tauri-apps/plugin-shell'
import { localUrl } from './ports'

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function copyText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

/** Open Explorer with the executable selected. */
export function revealInExplorer(path: string): Promise<void> {
  return invoke('reveal_in_explorer', { path })
}

export function openTaskManager(): Promise<void> {
  return invoke('open_task_manager')
}

export function openInBrowser(port: number): Promise<void> {
  return openShell(localUrl(port))
}

export function getAutostart(): Promise<boolean> {
  return invoke<boolean>('get_autostart')
}

export function setAutostart(enabled: boolean): Promise<void> {
  return invoke('set_autostart', { enabled })
}

export function setHotkey(accelerator: string): Promise<void> {
  return invoke('set_hotkey', { accelerator })
}
