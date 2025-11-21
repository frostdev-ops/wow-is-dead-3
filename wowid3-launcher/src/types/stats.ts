export interface PlayerStats {
  uuid: string;
  username: string;
  blocks_broken: Record<string, number>;
  blocks_placed: Record<string, number>;
  mobs_killed: Record<string, number>;
  mobs_tamed: Record<string, number>;
  ores_mined: Record<string, number>;
  items_gathered: Record<string, number>;
  damage_dealt: number;
  damage_taken: number;
  deaths: number;
  dimensions_visited: string[];
  biomes_visited: string[];
  playtime_seconds: number;
  total_blocks_broken: number;
  total_blocks_placed: number;
  total_mobs_killed: number;
  total_mobs_tamed: number;
  total_ores_mined: number;
  first_seen: number;
  last_updated: number;
}

