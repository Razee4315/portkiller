import type { PortInfo } from '../types'

/** "just now", "12s ago", "4m ago", "3h ago", "2d ago". */
export function timeAgo(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.floor((now - timestamp) / 1000)
  if (seconds < 2) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return 'N/A'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : (word.endsWith('s') ? 'es' : 's')}`
}

function csvCell(value: string | number | boolean): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(ports: PortInfo[]): string {
  const header = 'Port,Protocol,PID,Process,Address,Path,Command,Protected'
  const rows = ports.map(p =>
    [p.port, p.protocol, p.pid, p.process_name, p.local_address, p.process_path, p.command_line, p.is_protected]
      .map(csvCell)
      .join(','),
  )
  return [header, ...rows].join('\n')
}

export function toJson(ports: PortInfo[]): string {
  return JSON.stringify(ports, null, 2)
}
