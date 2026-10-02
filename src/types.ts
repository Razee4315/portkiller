export interface PortInfo {
  pid: number;
  port: number;
  protocol: string;
  process_name: string;
  process_path: string;
  /** Full command line; empty when the process belongs to another user. */
  command_line: string;
  is_protected: boolean;
  local_address: string;
}

export interface AppState {
  ports: PortInfo[];
  is_admin: boolean;
}

/** Mirrors the Rust `KillCode` enum. */
export type KillCode = 'ok' | 'protected' | 'gone' | 'stale' | 'denied' | 'failed';

export interface KillResult {
  code: KillCode;
  /** Name the backend resolved for the PID at kill time. */
  process_name: string;
  /** OS error text; only set when `code` is 'failed'. */
  detail: string;
}

export interface CommonPort {
  port: number;
  label: string;
  description: string;
}

export const COMMON_PORTS: CommonPort[] = [
  { port: 3000, label: '3000', description: 'React/Node' },
  { port: 3001, label: '3001', description: 'Dev Server' },
  { port: 5173, label: '5173', description: 'Vite' },
  { port: 4200, label: '4200', description: 'Angular' },
  { port: 4321, label: '4321', description: 'Astro' },
  { port: 8080, label: '8080', description: 'Spring/Tomcat' },
  { port: 8000, label: '8000', description: 'Django' },
  { port: 5000, label: '5000', description: 'Flask' },
  { port: 5432, label: '5432', description: 'PostgreSQL' },
  { port: 3306, label: '3306', description: 'MySQL' },
  { port: 6379, label: '6379', description: 'Redis' },
  { port: 27017, label: '27017', description: 'MongoDB' },
];

const CUSTOM_PORTS_KEY = 'portkiller_custom_ports';

/** The user's edited grid, or null when they are still on the defaults. */
export function loadCustomPorts(): CommonPort[] | null {
  try {
    const stored = localStorage.getItem(CUSTOM_PORTS_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;
    // Defensive validation — corrupted localStorage shouldn't crash the app
    // or let stray fields slip into the UI. Cap description length to match
    // the SettingsPanel input.
    return parsed
      .filter((p): p is CommonPort =>
        typeof p === 'object' && p !== null &&
        typeof p.port === 'number' && p.port >= 1 && p.port <= 65535 &&
        typeof p.label === 'string' &&
        typeof p.description === 'string',
      )
      .map(p => ({
        port: p.port,
        label: String(p.label).slice(0, 16),
        description: String(p.description).slice(0, 32),
      }));
  } catch { }
  return null;
}

/** Pass null to go back to the built-in defaults. An empty list is kept. */
export function saveCustomPorts(ports: CommonPort[] | null): void {
  try {
    if (ports === null) {
      localStorage.removeItem(CUSTOM_PORTS_KEY);
    } else {
      localStorage.setItem(CUSTOM_PORTS_KEY, JSON.stringify(ports));
    }
  } catch { }
}

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
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((n): n is number => typeof n === 'number');
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
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is KillRecord =>
        typeof r === 'object' && r !== null &&
        typeof r.port === 'number' &&
        typeof r.pid === 'number' &&
        typeof r.processName === 'string' &&
        typeof r.timestamp === 'number',
      )
      .slice(0, KILL_HISTORY_MAX);
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

// Auto-updater — remember a version the user chose to "Skip" so the update
// dialog doesn't nag for that release on every launch. "Later" is not persisted
// (it just dismisses until the next start).
const SKIPPED_UPDATE_KEY = 'portkiller_skipped_update_v1';

export function getSkippedUpdateVersion(): string | null {
  try { return localStorage.getItem(SKIPPED_UPDATE_KEY); } catch { return null; }
}

export function setSkippedUpdateVersion(version: string): void {
  try { localStorage.setItem(SKIPPED_UPDATE_KEY, version); } catch { }
}

// First-run hint — shown once so a new user learns the app lives in the tray.
const ONBOARDED_KEY = 'portkiller_onboarded_v1';

export function hasSeenOnboarding(): boolean {
  try { return localStorage.getItem(ONBOARDED_KEY) === '1'; } catch { return true; }
}

export function markOnboardingSeen(): void {
  try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch { }
}
