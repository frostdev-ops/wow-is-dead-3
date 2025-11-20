export interface PlayerExt {
  name: string;
  uuid: string;
  position?: [number, number, number];
  dimension?: string;
  biome?: string;
}

export interface ChatMessage {
  sender: string;
  content: string;
  timestamp: number;
}

export interface TrackerState {
  online_players: PlayerExt[];
  recent_chat: ChatMessage[];
  tps?: number;
  mspt?: number;
  last_updated: number;
}

