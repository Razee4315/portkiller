// Turning a key press into an accelerator string the backend can register
// ("Ctrl+Shift+K"). Limited to letters, digits and function keys: those parse
// the same way everywhere and cover every sensible global shortcut.

interface KeyLike {
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

function keyName(code: string): string | null {
  const letter = code.match(/^Key([A-Z])$/)
  if (letter) return letter[1]
  const digit = code.match(/^Digit(\d)$/)
  if (digit) return digit[1]
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code
  return null
}

export type HotkeyCapture =
  | { ok: true; accelerator: string }
  | { ok: false; reason: 'pending' | 'needs-modifier' | 'unsupported-key' }

/**
 * `pending` means only modifiers are down so far — keep listening.
 * A global shortcut without Ctrl, Alt or Win would swallow ordinary typing in
 * every app, so a bare key (or Shift + key) is rejected.
 */
export function captureHotkey(e: KeyLike): HotkeyCapture {
  if (/^(Control|Alt|Shift|Meta|OS)(Left|Right)?$/.test(e.code)) {
    return { ok: false, reason: 'pending' }
  }
  const key = keyName(e.code)
  if (!key) return { ok: false, reason: 'unsupported-key' }
  const isFunctionKey = key.length > 1
  if (!e.ctrlKey && !e.altKey && !e.metaKey && !isFunctionKey) {
    return { ok: false, reason: 'needs-modifier' }
  }
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')
  parts.push(key)
  return { ok: true, accelerator: parts.join('+') }
}

/** "Ctrl+Shift+K" -> ["Ctrl", "Shift", "K"], with Super shown as Win. */
export function hotkeyParts(accelerator: string): string[] {
  return accelerator.split('+').map(part => (part === 'Super' ? 'Win' : part))
}
