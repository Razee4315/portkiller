import { describe, expect, it } from 'vitest'
import type { PortInfo } from '../types'
import { formatBytes, plural, timeAgo, toCsv } from './format'
import { captureHotkey, hotkeyParts } from './hotkey'
import { sanitizePreferences, DEFAULT_PREFERENCES } from '../preferences'

describe('timeAgo', () => {
  const now = 1_000_000_000
  it('steps through seconds, minutes, hours and days', () => {
    expect(timeAgo(now - 500, now)).toBe('just now')
    expect(timeAgo(now - 12_000, now)).toBe('12s ago')
    expect(timeAgo(now - 4 * 60_000, now)).toBe('4m ago')
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3h ago')
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('2d ago')
  })
})

describe('formatBytes', () => {
  it('picks a sensible unit and never runs past the largest', () => {
    expect(formatBytes(0)).toBe('N/A')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(87_654_321)).toBe('83.6 MB')
    expect(formatBytes(1024 ** 6)).toBe('1048576.0 TB')
  })
})

describe('plural', () => {
  it('handles the two nouns the UI counts', () => {
    expect(plural(1, 'port')).toBe('1 port')
    expect(plural(2, 'port')).toBe('2 ports')
    expect(plural(1, 'process')).toBe('1 process')
    expect(plural(3, 'process')).toBe('3 processes')
  })
})

describe('toCsv', () => {
  const row: PortInfo = {
    pid: 42,
    port: 3000,
    protocol: 'TCP',
    process_name: 'node.exe',
    process_path: 'C:\\Program Files\\nodejs\\node.exe',
    command_line: 'node "my app.js", --flag',
    is_protected: false,
    local_address: '127.0.0.1',
  }

  it('quotes cells containing commas or quotes, doubling the quotes', () => {
    const [header, line] = toCsv([row]).split('\n')
    expect(header).toBe('Port,Protocol,PID,Process,Address,Path,Command,Protected')
    expect(line).toBe(
      '3000,TCP,42,node.exe,127.0.0.1,C:\\Program Files\\nodejs\\node.exe,"node ""my app.js"", --flag",false',
    )
  })
})

describe('captureHotkey', () => {
  const press = (code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
    captureHotkey({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods })

  it('builds an accelerator in a fixed modifier order', () => {
    expect(press('KeyP', { altKey: true })).toEqual({ ok: true, accelerator: 'Alt+P' })
    expect(press('KeyK', { shiftKey: true, ctrlKey: true })).toEqual({ ok: true, accelerator: 'Ctrl+Shift+K' })
    expect(press('Digit1', { metaKey: true })).toEqual({ ok: true, accelerator: 'Super+1' })
    expect(press('F9')).toEqual({ ok: true, accelerator: 'F9' })
  })

  it('keeps waiting while only modifiers are held', () => {
    expect(press('ControlLeft', { ctrlKey: true })).toEqual({ ok: false, reason: 'pending' })
  })

  it('refuses a bare key and keys it cannot name', () => {
    expect(press('KeyK')).toEqual({ ok: false, reason: 'needs-modifier' })
    expect(press('KeyK', { shiftKey: true })).toEqual({ ok: false, reason: 'needs-modifier' })
    expect(press('Tab', { ctrlKey: true })).toEqual({ ok: false, reason: 'unsupported-key' })
  })

  it('shows Super as Win', () => {
    expect(hotkeyParts('Ctrl+Super+K')).toEqual(['Ctrl', 'Win', 'K'])
  })
})

describe('sanitizePreferences', () => {
  it('returns defaults for junk', () => {
    expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(sanitizePreferences('nope')).toEqual(DEFAULT_PREFERENCES)
  })

  it('keeps valid fields and drops invalid ones', () => {
    const result = sanitizePreferences({
      alwaysOnTop: true,
      pollIntervalMs: 123,
      sortMode: 'sideways',
      protocolFilter: 'udp',
      hotkey: 'Ctrl+Shift+K',
      protectedNames: ['Postgres.exe', 7],
    })
    expect(result.alwaysOnTop).toBe(true)
    expect(result.pollIntervalMs).toBe(DEFAULT_PREFERENCES.pollIntervalMs)
    expect(result.sortMode).toBe(DEFAULT_PREFERENCES.sortMode)
    expect(result.protocolFilter).toBe('udp')
    expect(result.hotkey).toBe('Ctrl+Shift+K')
    expect(result.protectedNames).toEqual(['postgres.exe'])
  })
})
