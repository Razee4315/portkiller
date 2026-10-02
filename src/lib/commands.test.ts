import { describe, expect, it } from 'vitest'
import { COMMAND_HELP, parseCommand, searchQueryOf, suggestCommands } from './commands'

describe('parseCommand', () => {
  it('treats a bare port number as a kill', () => {
    expect(parseCommand('3000')).toEqual({ type: 'kill-port', port: 3000 })
  })

  it('parses kill with a port, a range, or all', () => {
    expect(parseCommand('kill 3000')).toEqual({ type: 'kill-port', port: 3000 })
    expect(parseCommand('KILL  3000-4000')).toEqual({ type: 'kill-range', range: [3000, 4000] })
    expect(parseCommand('kill all')).toEqual({ type: 'kill-all' })
    expect(parseCommand('killall')).toEqual({ type: 'kill-all' })
  })

  it('parses pin and unpin', () => {
    expect(parseCommand('pin 8080')).toEqual({ type: 'pin', port: 8080 })
    expect(parseCommand('unpin 8080')).toEqual({ type: 'unpin', port: 8080 })
    expect(parseCommand('unpin all')).toEqual({ type: 'unpin-all' })
  })

  it('accepts the short aliases', () => {
    expect(parseCommand('sudo')).toEqual({ type: 'admin' })
    expect(parseCommand('r')).toEqual({ type: 'refresh' })
    expect(parseCommand('config')).toEqual({ type: 'settings' })
    expect(parseCommand('?')).toEqual({ type: 'help' })
  })

  it('defaults export to JSON', () => {
    expect(parseCommand('export')).toEqual({ type: 'export', format: 'json' })
    expect(parseCommand('export csv')).toEqual({ type: 'export', format: 'csv' })
  })

  it('returns null for plain search text', () => {
    expect(parseCommand('node')).toBeNull()
    expect(parseCommand('3000-4000')).toBeNull()
    expect(parseCommand('kill')).toBeNull()
    expect(parseCommand('kill node')).toBeNull()
    expect(parseCommand('3000abc')).toBeNull()
    expect(parseCommand('')).toBeNull()
  })

  it('understands every command the cheatsheet advertises', () => {
    for (const { cmd, aliases = [] } of COMMAND_HELP) {
      // The range filter is a search, not a command.
      if (cmd === '3000-4000') continue
      for (const text of [cmd, ...aliases]) {
        expect(parseCommand(text), text).not.toBeNull()
      }
    }
  })
})

describe('searchQueryOf', () => {
  it('filters by the argument while a kill or pin command is being typed', () => {
    expect(searchQueryOf('kill 3000')).toBe('3000')
    expect(searchQueryOf('kill 3000-4000')).toBe('3000-4000')
    expect(searchQueryOf('pin 80')).toBe('80')
  })

  it('does not filter for commands that are not about specific ports', () => {
    expect(searchQueryOf('kill all')).toBe('')
    expect(searchQueryOf('refresh')).toBe('')
    expect(searchQueryOf('export csv')).toBe('')
  })

  it('passes ordinary searches through', () => {
    expect(searchQueryOf('node')).toBe('node')
    expect(searchQueryOf(' 3000 ')).toBe('3000')
    expect(searchQueryOf('3000-4000')).toBe('3000-4000')
  })
})

describe('suggestCommands', () => {
  it('suggests commands that start with the typed letters', () => {
    expect(suggestCommands('ki').map(s => s.cmd)).toEqual(['kill 3000', 'kill 3000-4000', 'kill all'])
    expect(suggestCommands('exp').map(s => s.cmd)).toEqual(['export json', 'export csv'])
  })

  it('stays quiet for digits, single letters and complete commands', () => {
    expect(suggestCommands('3000')).toEqual([])
    expect(suggestCommands('k')).toEqual([])
    expect(suggestCommands('refresh')).toEqual([])
    expect(suggestCommands('zzz')).toEqual([])
  })
})
