
export enum BetResult {
  PENDING = 'PENDING',
  WIN = 'WIN',
  LOSS = 'LOSS',
  PUSH = 'PUSH'
}

export interface Bot {
  id: string;
  name: string;
  order_index: number;
  created_at: string;
}

export interface Bet {
  id: string;
  botId?: string;
  bot_id?: string;
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
  slateDate?: string;
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
  mentionRoles: Array<{ id: string; name: string }>;
  leagueRoleMappings: Array<{ league: string; roleId: string; roleName: string }>;
}

export interface User {
  id: string;
  email: string;
}

export interface BetLink {
  id: string;
  betId: string;
  linkedBetId: string;
  linkedBotId: string;
  linkedBotName: string;
  linkedPlayerA: string;
  linkedPlayerB: string;
  linkedLeague: string;
  linkedSlateDate?: string;
  linkedResult?: string;
  createdAt: string;
}

export interface ScheduledMessage {
  id: string;
  botId: string;
  content: string;
  imageUrl: string;
  imageData: string;
  imageFilename: string;
  embedTitle: string;
  embedColor: number;
  roleMentions: Array<{ id: string; name: string }>;
  scheduledTime: number;
  isSent: boolean;
  createdAt: string;
}

export interface DailyRecap {
  id?: string;
  user_id?: string;
  bot_id?: string;
  date: string;
  wins: number;
  losses: number;
  pushes: number;
  net_units: number;
  roi: number;
  league_breakdown: Array<{ league: string; units: number }>;
  created_at?: string;
}

export interface MonthlyRecap {
  period: string;
  wins: number;
  losses: number;
  pushes: number;
  net_units: number;
  roi: number;
  total_bets: number;
  league_breakdown: Array<{ league: string; units: number }>;
  days: DailyRecap[];
}

export interface YearlyRecap {
  year: number;
  wins: number;
  losses: number;
  pushes: number;
  net_units: number;
  total_bets: number;
  league_breakdown: Array<{ league: string; units: number }>;
  months: Array<{
    month: string;
    wins: number;
    losses: number;
    pushes: number;
    net_units: number;
    total_bets: number;
    days_with_recaps: number;
    league_breakdown: Array<{ league: string; units: number }>;
  }>;
}
