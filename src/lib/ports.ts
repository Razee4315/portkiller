import type { PortInfo } from '../types'
import type { ProtocolFilter, SortMode } from '../preferences'

/** Stable identity for a row: one port can be held by several PIDs. */
export function portKey(p: Pick<PortInfo, 'port' | 'pid'>): string {
  return `${p.port}-${p.pid}`
}

// 0.0.0.0 / :: bindings are reachable from any network interface, which is a
// security-relevant signal worth surfacing. Loopback (127.x, ::1) is not.
export function isPublicBinding(addr: string): boolean {
  if (!addr) return false
  const lower = addr.toLowerCase()
  return lower === '0.0.0.0' || lower === '::' || lower === '[::]'
}

// Common HTTPS dev ports beyond 443 — Vite --https, Next dev HTTPS, etc.
const HTTPS_PORTS = new Set([443, 4443, 5443, 8443])

export function localUrl(port: number): string {
  return `${HTTPS_PORTS.has(port) ? 'https' : 'http'}://localhost:${port}`
}

export function isTcp(p: PortInfo): boolean {
  return p.protocol.toUpperCase() === 'TCP'
}

// Port-range query: "3000-4000" matches any port in [3000, 4000].
export function parsePortRange(query: string): [number, number] | null {
  const m = query.trim().match(/^(\d{1,5})\s*-\s*(\d{1,5})$/)
  if (!m) return null
  const lo = parseInt(m[1], 10)
  const hi = parseInt(m[2], 10)
  if (lo > 65535 || hi > 65535) return null
  return lo <= hi ? [lo, hi] : [hi, lo]
}

/** A whole-string port number, or null. Rejects "3000abc" and "3000-4000". */
export function parsePortNumber(text: string): number | null {
  const t = text.trim()
  if (!/^\d{1,5}$/.test(t)) return null
  const n = parseInt(t, 10)
  return n >= 1 && n <= 65535 ? n : null
}

export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (!q || !t) return 0
  if (t.includes(q)) return 100 + (q.length / t.length) * 50
  let score = 0, qIdx = 0
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) { score += 10; qIdx++ }
  }
  return qIdx === q.length ? score : 0
}

export function fuzzyMatch(query: string, port: PortInfo): number {
  // The command line only counts on a literal substring hit: it is long, so
  // subsequence matching against it would match nearly anything.
  const inCommand = port.command_line.toLowerCase().includes(query.toLowerCase()) ? 60 : 0
  return Math.max(
    fuzzyScore(query, port.port.toString()) * 2,
    fuzzyScore(query, port.process_name),
    fuzzyScore(query, port.pid.toString()),
    inCommand,
  )
}

export function sortPorts(ports: PortInfo[], mode: SortMode): PortInfo[] {
  return [...ports].sort((a, b) => {
    switch (mode) {
      case 'port-desc': return b.port - a.port
      case 'process':
        return a.process_name.localeCompare(b.process_name) || a.port - b.port
      case 'pid':
        return a.pid - b.pid || a.port - b.port
      case 'port-asc':
      default:
        return a.port - b.port
    }
  })
}

interface ViewOptions {
  query: string
  protocol: ProtocolFilter
  sort: SortMode
  pinned: Set<number>
}

/** Sort, filter by protocol and query, then float pinned ports to the top. */
export function buildView(ports: PortInfo[], { query, protocol, sort, pinned }: ViewOptions): PortInfo[] {
  const sorted = sortPorts(ports, sort)
  const byProtocol = protocol === 'all'
    ? sorted
    : sorted.filter(p => p.protocol.toUpperCase() === protocol.toUpperCase())

  const q = query.trim()
  const range = q ? parsePortRange(q) : null
  const base = !q
    ? byProtocol
    : range
      ? byProtocol.filter(p => p.port >= range[0] && p.port <= range[1])
      : byProtocol
          .map(p => ({ port: p, score: fuzzyMatch(q, p) }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .map(({ port }) => port)

  if (pinned.size === 0) return base
  const top: PortInfo[] = []
  const rest: PortInfo[] = []
  base.forEach(p => (pinned.has(p.port) ? top : rest).push(p))
  return [...top, ...rest]
}

/**
 * The row to act on when the user names a bare port number. Several rows can
 * share a port (TCP + UDP, or two PIDs), so prefer a killable TCP listener —
 * that is what a "port already in use" error is about.
 */
export function findPortOwner(ports: PortInfo[], port: number): PortInfo | undefined {
  const matches = ports.filter(p => p.port === port)
  return (
    matches.find(p => isTcp(p) && !p.is_protected) ??
    matches.find(p => isTcp(p)) ??
    matches[0]
  )
}

/** One entry per process: killing a PID frees all of its ports at once. */
export function uniqueByPid(ports: PortInfo[]): PortInfo[] {
  const seen = new Set<number>()
  return ports.filter(p => (seen.has(p.pid) ? false : (seen.add(p.pid), true)))
}

/** True when two polls returned the same rows, so the UI need not re-render. */
export function samePorts(a: PortInfo[], b: PortInfo[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    if (
      x.port !== y.port || x.pid !== y.pid || x.protocol !== y.protocol ||
      x.process_name !== y.process_name || x.local_address !== y.local_address ||
      x.is_protected !== y.is_protected || x.command_line !== y.command_line
    ) return false
  }
  return true
}

/**
 * The part of a command line worth showing next to the process name: the
 * arguments, without the executable. Five `node.exe` rows are told apart by
 * what they were asked to run.
 */
export function commandHint(p: PortInfo): string {
  const cmd = p.command_line.trim()
  if (!cmd) return ''
  // Strip a leading quoted or bare executable token.
  const rest = cmd.startsWith('"')
    ? cmd.slice(cmd.indexOf('"', 1) + 1)
    : cmd.slice(cmd.search(/\s|$/))
  return rest.trim()
}
