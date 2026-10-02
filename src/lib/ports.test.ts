import { describe, expect, it } from 'vitest'
import type { PortInfo } from '../types'
import {
  buildView,
  commandHint,
  findPortOwner,
  fuzzyScore,
  isPublicBinding,
  localUrl,
  parsePortNumber,
  parsePortRange,
  portKey,
  samePorts,
  uniqueByPid,
} from './ports'

function port(overrides: Partial<PortInfo> & Pick<PortInfo, 'port' | 'pid'>): PortInfo {
  return {
    protocol: 'TCP',
    process_name: 'node.exe',
    process_path: '',
    command_line: '',
    is_protected: false,
    local_address: '127.0.0.1',
    ...overrides,
  }
}

describe('parsePortRange', () => {
  it('parses a range and tolerates spaces', () => {
    expect(parsePortRange('3000-4000')).toEqual([3000, 4000])
    expect(parsePortRange(' 3000 - 4000 ')).toEqual([3000, 4000])
  })

  it('orders a reversed range', () => {
    expect(parsePortRange('4000-3000')).toEqual([3000, 4000])
  })

  it('rejects anything that is not exactly a range', () => {
    expect(parsePortRange('3000')).toBeNull()
    expect(parsePortRange('3000-')).toBeNull()
    expect(parsePortRange('a-b')).toBeNull()
    expect(parsePortRange('3000-70000')).toBeNull()
  })
})

describe('parsePortNumber', () => {
  it('accepts a whole-string port', () => {
    expect(parsePortNumber('3000')).toBe(3000)
    expect(parsePortNumber(' 80 ')).toBe(80)
  })

  // The old code used parseInt, which read "3000-4000" and "3000abc" as 3000
  // and armed a kill the user never asked for.
  it('rejects text that merely starts with digits', () => {
    expect(parsePortNumber('3000-4000')).toBeNull()
    expect(parsePortNumber('3000abc')).toBeNull()
    expect(parsePortNumber('3.5')).toBeNull()
  })

  it('rejects out-of-range values', () => {
    expect(parsePortNumber('0')).toBeNull()
    expect(parsePortNumber('65536')).toBeNull()
    expect(parsePortNumber('')).toBeNull()
  })
})

describe('isPublicBinding', () => {
  it('flags wildcard addresses', () => {
    expect(isPublicBinding('0.0.0.0')).toBe(true)
    expect(isPublicBinding('::')).toBe(true)
  })

  it('does not flag loopback or a specific interface', () => {
    expect(isPublicBinding('127.0.0.1')).toBe(false)
    expect(isPublicBinding('::1')).toBe(false)
    expect(isPublicBinding('192.168.1.20')).toBe(false)
    expect(isPublicBinding('')).toBe(false)
  })
})

describe('localUrl', () => {
  it('uses https only for known TLS dev ports', () => {
    expect(localUrl(3000)).toBe('http://localhost:3000')
    expect(localUrl(8443)).toBe('https://localhost:8443')
  })
})

describe('fuzzyScore', () => {
  it('ranks a substring above a scattered match, and rejects a non-match', () => {
    const substring = fuzzyScore('node', 'node.exe')
    const scattered = fuzzyScore('nde', 'node.exe')
    expect(substring).toBeGreaterThan(scattered)
    expect(scattered).toBeGreaterThan(0)
    expect(fuzzyScore('xyz', 'node.exe')).toBe(0)
  })
})

describe('buildView', () => {
  const ports = [
    port({ port: 8080, pid: 3, process_name: 'java.exe' }),
    port({ port: 3000, pid: 1, command_line: 'node C:\\work\\shop\\vite.js' }),
    port({ port: 5353, pid: 2, protocol: 'UDP', process_name: 'chrome.exe' }),
  ]
  const base = { query: '', protocol: 'all' as const, sort: 'port-asc' as const, pinned: new Set<number>() }

  it('sorts by port', () => {
    expect(buildView(ports, base).map(p => p.port)).toEqual([3000, 5353, 8080])
    expect(buildView(ports, { ...base, sort: 'port-desc' }).map(p => p.port)).toEqual([8080, 5353, 3000])
  })

  it('filters by protocol', () => {
    expect(buildView(ports, { ...base, protocol: 'udp' }).map(p => p.port)).toEqual([5353])
  })

  it('filters by range and by text', () => {
    expect(buildView(ports, { ...base, query: '3000-6000' }).map(p => p.port)).toEqual([3000, 5353])
    expect(buildView(ports, { ...base, query: 'java' }).map(p => p.port)).toEqual([8080])
  })

  it('matches on the command line, which is what tells two node.exe rows apart', () => {
    expect(buildView(ports, { ...base, query: 'shop' }).map(p => p.port)).toEqual([3000])
  })

  it('floats pinned ports to the top, keeping order within each group', () => {
    expect(buildView(ports, { ...base, pinned: new Set([8080]) }).map(p => p.port)).toEqual([8080, 3000, 5353])
  })
})

describe('findPortOwner', () => {
  it('prefers a killable TCP listener when a port has several rows', () => {
    const rows = [
      port({ port: 5432, pid: 10, protocol: 'UDP' }),
      port({ port: 5432, pid: 11, is_protected: true }),
      port({ port: 5432, pid: 12 }),
    ]
    expect(findPortOwner(rows, 5432)?.pid).toBe(12)
  })

  it('falls back to whatever holds the port', () => {
    expect(findPortOwner([port({ port: 53, pid: 9, protocol: 'UDP' })], 53)?.pid).toBe(9)
    expect(findPortOwner([], 53)).toBeUndefined()
  })
})

describe('uniqueByPid', () => {
  it('keeps one row per process', () => {
    const rows = [port({ port: 8080, pid: 5 }), port({ port: 8081, pid: 5 }), port({ port: 9000, pid: 6 })]
    expect(uniqueByPid(rows).map(portKey)).toEqual(['8080-5', '9000-6'])
  })
})

describe('samePorts', () => {
  it('is true for an identical poll and false when anything shown changes', () => {
    const a = [port({ port: 3000, pid: 1 })]
    expect(samePorts(a, [port({ port: 3000, pid: 1 })])).toBe(true)
    expect(samePorts(a, [port({ port: 3000, pid: 2 })])).toBe(false)
    expect(samePorts(a, [port({ port: 3000, pid: 1, command_line: 'x' })])).toBe(false)
    expect(samePorts(a, [])).toBe(false)
  })
})

describe('commandHint', () => {
  it('drops the executable and keeps the arguments', () => {
    expect(commandHint(port({ port: 1, pid: 1, command_line: '"C:\\Program Files\\nodejs\\node.exe" server.js --port 3000' })))
      .toBe('server.js --port 3000')
    expect(commandHint(port({ port: 1, pid: 1, command_line: 'python manage.py runserver' })))
      .toBe('manage.py runserver')
  })

  it('is empty when there is nothing beyond the executable', () => {
    expect(commandHint(port({ port: 1, pid: 1, command_line: 'postgres.exe' }))).toBe('')
    expect(commandHint(port({ port: 1, pid: 1, command_line: '' }))).toBe('')
  })
})
