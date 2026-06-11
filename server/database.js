import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const initDatabase = async () => {
  // ── Users ────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  // ── Bots (multi-bot support) ─────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Bot 1',
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots (user_id)
  `);

  // ── Settings (one row per bot) ───────────────────────────────────────────
  // Fresh installs use bot_id as PK; existing installs are migrated below.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      bot_id UUID PRIMARY KEY REFERENCES bots(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

  // ── Bets ─────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
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
  await pool.query(`ALTER TABLE bets ADD COLUMN IF NOT EXISTS "slateDate" TEXT`);
  await pool.query(`ALTER TABLE bets ADD COLUMN IF NOT EXISTS bot_id UUID REFERENCES bots(id) ON DELETE SET NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bets_user_slate ON bets (user_id, "slateDate")`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bets_bot_id ON bets (bot_id)`);

  // ── Daily Recaps ─────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_recaps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      pushes INTEGER NOT NULL DEFAULT 0,
      net_units REAL NOT NULL DEFAULT 0,
      roi REAL NOT NULL DEFAULT 0,
      league_breakdown JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE daily_recaps ADD COLUMN IF NOT EXISTS bot_id UUID REFERENCES bots(id) ON DELETE CASCADE`);
  // Drop the old per-user unique constraint (one recap per user per date) — replaced by per-bot constraint
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'daily_recaps_user_id_date_key'
      ) THEN
        ALTER TABLE daily_recaps DROP CONSTRAINT daily_recaps_user_id_date_key;
      END IF;
    END $$
  `);
  // Add per-bot unique constraint (idempotent via DO block)
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'daily_recaps_bot_id_date_key'
      ) THEN
        ALTER TABLE daily_recaps ADD CONSTRAINT daily_recaps_bot_id_date_key UNIQUE (bot_id, date);
      END IF;
    END $$
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_recaps_user_date ON daily_recaps (user_id, date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_recaps_bot_date ON daily_recaps (bot_id, date)`);

  // ── Auth token tables ────────────────────────────────────────────────────
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

  // ── Feature: multi-role tagging + league-role mappings ───────────────────
  await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS mention_roles JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS default_roles JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS league_role_mappings JSONB DEFAULT '[]'`);

  // ── Feature: bet_links (cross-bot grade sync) ─────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bet_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bet_id TEXT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
      linked_bet_id TEXT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(bet_id, linked_bet_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bet_links_bet_id ON bet_links (bet_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bet_links_linked_bet_id ON bet_links (linked_bet_id)`);

  // ── Feature: scheduled_messages ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      content TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      image_data TEXT DEFAULT '',
      image_filename TEXT DEFAULT '',
      embed_title TEXT DEFAULT '',
      embed_color INTEGER DEFAULT 16731469,
      role_mentions JSONB DEFAULT '[]',
      scheduled_time BIGINT NOT NULL,
      is_sent BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_messages_bot_id ON scheduled_messages (bot_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending ON scheduled_messages (scheduled_time) WHERE is_sent = false`);

  // ── Migrations for existing databases ───────────────────────────────────
  await migrateSettingsPK();
  await migrateDefaultBots();

  console.log('✅ Database initialized');
};

// Migrate settings table PK from user_id → bot_id (existing installs only)
const migrateSettingsPK = async () => {
  try {
    // Check if settings still uses user_id as primary key
    const pkCheck = await pool.query(`
      SELECT c.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage c
        ON tc.constraint_name = c.constraint_name
      WHERE tc.table_name = 'settings'
        AND tc.constraint_type = 'PRIMARY KEY'
        AND c.column_name = 'user_id'
    `);
    if (pkCheck.rows.length === 0) return; // Already on new schema

    console.log('🔄 Migrating settings table PK from user_id → bot_id...');

    // Create default bots for all users that don't have one yet
    await pool.query(`
      INSERT INTO bots (user_id, name, order_index)
      SELECT id, 'Bot 1', 0 FROM users
      WHERE id NOT IN (SELECT DISTINCT user_id FROM bots)
    `);

    // Add bot_id column to old settings table (nullable first)
    await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS bot_id UUID`);

    // Backfill: assign each settings row to the user's first bot
    await pool.query(`
      UPDATE settings SET bot_id = (
        SELECT id FROM bots WHERE user_id = settings.user_id ORDER BY order_index ASC LIMIT 1
      ) WHERE bot_id IS NULL
    `);

    // Drop old PK and promote bot_id to PK
    await pool.query(`ALTER TABLE settings ALTER COLUMN bot_id SET NOT NULL`);
    await pool.query(`ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey`);
    await pool.query(`ALTER TABLE settings ADD PRIMARY KEY (bot_id)`);

    // Add FK constraint for bot_id → bots (idempotent)
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'settings_bot_id_fkey'
        ) THEN
          ALTER TABLE settings ADD CONSTRAINT settings_bot_id_fkey
            FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE;
        END IF;
      END $$
    `);

    // Ensure user_id column exists (it should, but guard just in case)
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'settings' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE settings ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `);

    console.log('✅ Settings PK migrated to bot_id');
  } catch (err) {
    console.error('⚠️  Settings PK migration warning (safe to ignore on fresh install):', err.message);
  }
};

// Create default Bot 1 for users without one; backfill bot_id on orphaned rows
const migrateDefaultBots = async () => {
  try {
    // Create default bot for any user that doesn't have one
    await pool.query(`
      INSERT INTO bots (user_id, name, order_index)
      SELECT id, 'Bot 1', 0 FROM users
      WHERE id NOT IN (SELECT DISTINCT user_id FROM bots)
    `);

    // Backfill bets.bot_id
    await pool.query(`
      UPDATE bets SET bot_id = (
        SELECT id FROM bots WHERE user_id = bets.user_id ORDER BY order_index ASC LIMIT 1
      ) WHERE bot_id IS NULL AND user_id IS NOT NULL
    `);

    // Backfill daily_recaps.bot_id
    await pool.query(`
      UPDATE daily_recaps SET bot_id = (
        SELECT id FROM bots WHERE user_id = daily_recaps.user_id ORDER BY order_index ASC LIMIT 1
      ) WHERE bot_id IS NULL AND user_id IS NOT NULL
    `);

    // Ensure every bot has a settings row
    await pool.query(`
      INSERT INTO settings (bot_id, user_id)
      SELECT b.id, b.user_id FROM bots b
      WHERE b.id NOT IN (SELECT bot_id FROM settings)
      ON CONFLICT (bot_id) DO NOTHING
    `);
  } catch (err) {
    console.error('⚠️  Default bot migration warning (safe to ignore on fresh install):', err.message);
  }
};

export default pool;
