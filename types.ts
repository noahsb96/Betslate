
export enum BetResult {
  PENDING = 'PENDING',
  WIN = 'WIN',
  LOSS = 'LOSS',
  PUSH = 'PUSH'
}

export interface Bet {
  id: string;
  league: string;
  playerA: string;
  playerB: string;
  time: string; // Original string from image
  type: string; // e.g., "UNDER 75.5", "SPLIT"
  units: number;
  odds?: string; // e.g. "-120", "+100"
  result: BetResult;
  notes?: string;
  timestamp: number; // Creation time
  
  // Scheduling fields
  matchTimestamp?: number; // The calculated Date object of the match (based on slate settings)
  customScheduleTime?: number; // If set, overrides the automatic offset calculation
  autoPost: boolean;
  isPosted: boolean;
}

export interface AppSettings {
  mentionString: string; 
  discordWebhookUrl: string;
  recapWebhookUrl: string; // Optional separate webhook for recaps
  botName: string;
  botAvatarUrl: string;
  scheduleOffsetMinutes: number; 
  slateTimezone: string;
  defaultOdds: string; // Global default, e.g., "-120"
}

export interface UserAccount {
  username: string;
  passwordHash: string; // Simple hash for demo
  settings: AppSettings;
}
