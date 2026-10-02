import { parsePortNumber, parsePortRange } from './ports'

export type Command =
  | { type: 'admin' }
  | { type: 'refresh' }
  | { type: 'clear' }
  | { type: 'settings' }
  | { type: 'help' }
  | { type: 'history' }
  | { type: 'pin'; port: number }
  | { type: 'unpin'; port: number }
  | { type: 'unpin-all' }
  | { type: 'kill-port'; port: number }
  | { type: 'kill-range'; range: [number, number] }
  | { type: 'kill-all' }
  | { type: 'export'; format: 'json' | 'csv' }

const SIMPLE: Record<string, Command> = {
  admin: { type: 'admin' },
  sudo: { type: 'admin' },
  refresh: { type: 'refresh' },
  r: { type: 'refresh' },
  clear: { type: 'clear' },
  c: { type: 'clear' },
  settings: { type: 'settings' },
  config: { type: 'settings' },
  help: { type: 'help' },
  '?': { type: 'help' },
  history: { type: 'history' },
  'unpin all': { type: 'unpin-all' },
  unpinall: { type: 'unpin-all' },
  'kill all': { type: 'kill-all' },
  killall: { type: 'kill-all' },
  export: { type: 'export', format: 'json' },
  'export json': { type: 'export', format: 'json' },
  'export csv': { type: 'export', format: 'csv' },
}

/**
 * Parse what the user typed in the search bar when they press Enter. Returns
 * null when the text is not a command, in which case it is just a search.
 * A bare port number ("3000") is the shortest kill command.
 */
export function parseCommand(input: string): Command | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text) return null

  const simple = SIMPLE[text]
  if (simple) return simple

  const bare = parsePortNumber(text)
  if (bare !== null) return { type: 'kill-port', port: bare }

  const [verb, ...rest] = text.split(' ')
  const arg = rest.join(' ')
  if (!arg) return null

  if (verb === 'kill') {
    const range = parsePortRange(arg)
    if (range) return { type: 'kill-range', range }
    const port = parsePortNumber(arg)
    return port !== null ? { type: 'kill-port', port } : null
  }
  if (verb === 'pin' || verb === 'unpin') {
    const port = parsePortNumber(arg)
    return port !== null ? { type: verb, port } : null
  }
  return null
}

export interface CommandHelp {
  cmd: string
  label: string
  /** Shorter spellings accepted for the same command. */
  aliases?: string[]
  /**
   * What picking the suggestion types into the search bar. Commands that take
   * a port leave the number for the user; the rest are filled in whole.
   */
  fill?: string
}

/** Single source for the cheatsheet and the search-bar suggestions. */
export const COMMAND_HELP: CommandHelp[] = [
  { cmd: 'kill 3000', label: 'Kill the process on port 3000 (Enter twice)', fill: 'kill ' },
  { cmd: 'kill 3000-4000', label: 'Select every port in a range for bulk kill', fill: 'kill ' },
  { cmd: 'kill all', label: 'Select every visible killable port for bulk kill', aliases: ['killall'] },
  { cmd: 'pin 3000', label: 'Pin port 3000 to the top of the list', fill: 'pin ' },
  { cmd: 'unpin 3000', label: 'Unpin port 3000', fill: 'unpin ' },
  { cmd: 'unpin all', label: 'Clear every pinned port', aliases: ['unpinall'] },
  { cmd: 'history', label: 'Open the kill history panel' },
  { cmd: '3000-4000', label: 'Filter the list to ports in that range' },
  { cmd: 'admin', label: 'Restart as Administrator', aliases: ['sudo'] },
  { cmd: 'refresh', label: 'Refresh the port list now', aliases: ['r'] },
  { cmd: 'export json', label: 'Copy the visible ports to the clipboard as JSON' },
  { cmd: 'export csv', label: 'Copy the visible ports to the clipboard as CSV' },
  { cmd: 'settings', label: 'Open settings', aliases: ['config'] },
  { cmd: 'help', label: 'Show the keyboard and command cheatsheet', aliases: ['?'] },
  { cmd: 'clear', label: 'Clear search and selection', aliases: ['c'] },
]

/**
 * Commands whose name starts with what has been typed so far. Only letters
 * trigger suggestions: digits are port searches, not commands.
 */
export function suggestCommands(input: string, limit = 4): CommandHelp[] {
  const text = input.trim().toLowerCase()
  if (text.length < 2 || !/^[a-z]/.test(text)) return []
  return COMMAND_HELP
    .filter(c => /^[a-z]/.test(c.cmd) && c.cmd.startsWith(text) && c.cmd !== text)
    .slice(0, limit)
}

/**
 * The part of the search-bar text that should filter the list. Command text
 * is not a search: "kill 3000" filters to 3000, and "refresh" filters nothing,
 * so the rows a command is about to act on stay on screen while it is typed.
 */
export function searchQueryOf(input: string): string {
  const text = input.trim()
  const withArg = text.match(/^(?:kill|pin|unpin)\s+(.*)$/i)
  if (withArg) return /^all$/i.test(withArg[1]) ? '' : withArg[1]
  const command = parseCommand(text)
  if (command && command.type !== 'kill-port') return ''
  return text
}
