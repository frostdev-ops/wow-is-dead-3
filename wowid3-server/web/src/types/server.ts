export enum ServerState {
  Stopped = "stopped",
  Starting = "starting",
  Running = "running",
  Stopping = "stopping",
}

export interface ServerStatus {
  state: ServerState;
  uptime_seconds: number | null;
  started_at: string | null;
}

export interface ServerStats {
  status: ServerStatus;
  memory_usage_mb: number | null;
  cpu_usage_percent: number | null;
  player_count: number | null;
  max_players: number | null;
  tps: number | null;
}

export interface CommandRequest {
  command: string;
}

export interface CommandResponse {
  success: boolean;
  message: string;
}

