
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
  time: string;
  type: string;
  units: number;
  odds?: string;
  result: BetResult;
  notes?: string;
  timestamp: number;
  
  matchTimestamp?: number;
  customScheduleTime?: number;
  autoPost: boolean;
  isPosted: boolean;
  customTitle?: string;
}

export interface AppSettings {
  mentionString: string; 
  discordWebhookUrl: string;
  recapWebhookUrl: string;
  botName: string;
  botAvatarUrl: string;
  scheduleOffsetMinutes: number; 
  slateTimezone: string;
  defaultOdds: string;
  aiInstructions: string;
  recapTitle: string;
  recapIncludeDate: boolean;
  recapIncludeRecord: boolean;
  recapIncludeNetUnits: boolean;
  recapIncludeROI: boolean;
  recapIncludeLeagueStats: boolean;
  defaultBetAlertTitle: string;
  betEmbedColor: number;
  recapEmbedColor: number;
}

export interface UserAccount {
  username: string;
  passwordHash: string;
  settings: AppSettings;
}
