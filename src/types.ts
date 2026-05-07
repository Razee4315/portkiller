export interface PortInfo {
  pid: number;
  port: number;
  protocol: string;
  process_name: string;
  process_path: string;
  is_protected: boolean;
  local_address: string;
}

export interface AppState {
  ports: PortInfo[];
  last_updated: number;
  is_admin: boolean;
}

export interface KillResult {
  success: boolean;
  message: string;
  port: number;
}

export interface CommonPort {
  port: number;
  label: string;
  description: string;
}

export const COMMON_PORTS: CommonPort[] = [
  { port: 3000, label: '3000', description: 'React/Node' },
  { port: 8080, label: '8080', description: 'Spring/Tomcat' },
  { port: 5000, label: '5000', description: 'Flask' },
  { port: 5432, label: '5432', description: 'PostgreSQL' },
  { port: 8000, label: '8000', description: 'Django' },
  { port: 4200, label: '4200', description: 'Angular' },
  { port: 3001, label: '3001', description: 'Dev Server' },
  { port: 5173, label: '5173', description: 'Vite' },
];

const CUSTOM_PORTS_KEY = 'portkiller_custom_ports';

export function loadCustomPorts(): CommonPort[] {
  try {
    const stored = localStorage.getItem(CUSTOM_PORTS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch { }
  return [];
}

export function saveCustomPorts(ports: CommonPort[]): void {
  try {
    if (ports.length === 0) {
      localStorage.removeItem(CUSTOM_PORTS_KEY);
    } else {
      localStorage.setItem(CUSTOM_PORTS_KEY, JSON.stringify(ports));
    }
  } catch { }
}

export type ChangeState = 'new' | 'removed' | 'stable';

export interface ProcessDetails {
  pid: number;
  name: string;
  path: string;
  memory_bytes: number;
  cpu_percent: number;
  children: number[];
}

// Pinned ports — user-favorited port numbers that get sticky-sorted to the top
// of the list. Stored independently of the "common ports" grid which is a
// fixed reference, while pins follow the user's day-to-day workflow.
const PINNED_PORTS_KEY = 'portkiller_pinned_ports_v1';

export function loadPinnedPorts(): number[] {
  try {
    const raw = localStorage.getItem(PINNED_PORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(n => typeof n === 'number');
  } catch { }
  return [];
}

export function savePinnedPorts(ports: number[]): void {
  try {
    if (ports.length === 0) localStorage.removeItem(PINNED_PORTS_KEY);
    else localStorage.setItem(PINNED_PORTS_KEY, JSON.stringify(ports));
  } catch { }
}

// Recently killed processes — capped ring buffer kept in localStorage. Used
// for the in-app kill history panel. Keep this lean: no sensitive data.
export interface KillRecord {
  port: number;
  pid: number;
  processName: string;
  timestamp: number;
}

const KILL_HISTORY_KEY = 'portkiller_kill_history_v1';
const KILL_HISTORY_MAX = 15;

export function loadKillHistory(): KillRecord[] {
  try {
    const raw = localStorage.getItem(KILL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, KILL_HISTORY_MAX);
  } catch { }
  return [];
}

export function appendKillHistory(record: KillRecord, current: KillRecord[]): KillRecord[] {
  const next = [record, ...current].slice(0, KILL_HISTORY_MAX);
  try { localStorage.setItem(KILL_HISTORY_KEY, JSON.stringify(next)); } catch { }
  return next;
}

export function clearKillHistory(): void {
  try { localStorage.removeItem(KILL_HISTORY_KEY); } catch { }
}
