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
