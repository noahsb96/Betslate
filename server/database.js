import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const initDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      league TEXT NOT NULL,
      "playerA" TEXT NOT NULL,
      "playerB" TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT NOT NULL,
      units REAL NOT NULL,
      odds TEXT,
      result TEXT NOT NULL,
      notes TEXT,
      timestamp BIGINT NOT NULL,
      "matchTimestamp" BIGINT,
      "customScheduleTime" BIGINT,
      "autoPost" BOOLEAN DEFAULT false,
      "isPosted" BOOLEAN DEFAULT false,
      "customTitle" TEXT,
      "slateDate" TEXT
    )
  `);

  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS "slateDate" TEXT
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bets_user_slate ON bets (user_id, "slateDate")
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_recaps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      pushes INTEGER NOT NULL DEFAULT 0,
      net_units REAL NOT NULL DEFAULT 0,
      roi REAL NOT NULL DEFAULT 0,
      league_breakdown JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, date)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_daily_recaps_user_date ON daily_recaps (user_id, date)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      "mentionString" TEXT DEFAULT '@Chefs Plays',
      "discordWebhookUrl" TEXT DEFAULT '',
      "recapWebhookUrl" TEXT DEFAULT '',
      "botName" TEXT DEFAULT 'AI BetSlate Automator',
      "botAvatarUrl" TEXT DEFAULT '',
      "scheduleOffsetMinutes" INTEGER DEFAULT 15,
      "slateTimezone" TEXT DEFAULT 'America/New_York',
      "defaultOdds" TEXT DEFAULT '-120',
      "aiInstructions" TEXT DEFAULT '',
      "recapTitle" TEXT DEFAULT 'Daily Recap',
      "recapIncludeDate" BOOLEAN DEFAULT true,
      "recapIncludeRecord" BOOLEAN DEFAULT true,
      "recapIncludeNetUnits" BOOLEAN DEFAULT true,
      "recapIncludeROI" BOOLEAN DEFAULT true,
      "recapIncludeLeagueStats" BOOLEAN DEFAULT false,
      "defaultBetAlertTitle" TEXT DEFAULT '📢 Bet Alert',
      "betEmbedColor" INTEGER DEFAULT 16731469,
      "recapEmbedColor" INTEGER DEFAULT 16731469
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_change_tokens (
      token TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      new_email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  console.log('✅ Database initialized');
};

export default pool;
