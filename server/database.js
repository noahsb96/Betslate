import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, 'betslate.db');
const db = new Database(dbPath);

export const initDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY,
      league TEXT NOT NULL,
      playerA TEXT NOT NULL,
      playerB TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT NOT NULL,
      units REAL NOT NULL,
      odds TEXT,
      result TEXT NOT NULL,
      notes TEXT,
      timestamp INTEGER NOT NULL,
      matchTimestamp INTEGER,
      customScheduleTime INTEGER,
      autoPost INTEGER DEFAULT 0,
      isPosted INTEGER DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mentionString TEXT DEFAULT '',
      discordWebhookUrl TEXT DEFAULT '',
      recapWebhookUrl TEXT DEFAULT '',
      botName TEXT DEFAULT 'AI BetSlate Automator',
      botAvatarUrl TEXT DEFAULT '',
      scheduleOffsetMinutes INTEGER DEFAULT 15,
      slateTimezone TEXT DEFAULT 'America/New_York',
      defaultOdds TEXT DEFAULT '-120',
      aiInstructions TEXT DEFAULT '',
      recapTitle TEXT DEFAULT 'Daily Recap',
      recapIncludeDate INTEGER DEFAULT 1,
      recapIncludeRecord INTEGER DEFAULT 1,
      recapIncludeNetUnits INTEGER DEFAULT 1,
      recapIncludeROI INTEGER DEFAULT 1,
      recapIncludeLeagueStats INTEGER DEFAULT 0
    )
  `);

  try {
    db.exec(`ALTER TABLE settings ADD COLUMN aiInstructions TEXT DEFAULT ''`);
  } catch (err) {
  }

  try {
    db.exec(`ALTER TABLE settings ADD COLUMN recapTitle TEXT DEFAULT 'Daily Recap'`);
    db.exec(`ALTER TABLE settings ADD COLUMN recapIncludeDate INTEGER DEFAULT 1`);
    db.exec(`ALTER TABLE settings ADD COLUMN recapIncludeRecord INTEGER DEFAULT 1`);
    db.exec(`ALTER TABLE settings ADD COLUMN recapIncludeNetUnits INTEGER DEFAULT 1`);
    db.exec(`ALTER TABLE settings ADD COLUMN recapIncludeROI INTEGER DEFAULT 1`);
    db.exec(`ALTER TABLE settings ADD COLUMN recapIncludeLeagueStats INTEGER DEFAULT 0`);
  } catch (err) {
  }

  const defaultInstructions = `You are an expert sports betting assistant specialized in Table Tennis.
Your task is to analyze an image of a betting slate and extract the structured betting data.

The image typically contains rows with:
1. Time (e.g., 1:45 p.m.)
2. Player Names (Two players)
3. Bet Type (Usually "UNDER", "OVER", or "SPLIT"). 
4. Indicators of confidence/units (Hammers, Stars, Nuclear symbols).

CRITICAL RULES:
1. **Units**: 
   - Hammer icon = **1.5** units.
   - Nuclear/Radioactive icon = **3** units.
   - Star or no icon = **1** unit.
2. **Bet Type**: 
   - If the text explicitly says "UNDER", "OVER", or "SPLIT", use that.
   - **IMPORTANT**: If NO bet type text is found next to the players, assume the bet is **"OVER"**.
3. **League**:
   - Extract the league header.
   - **CLEANING**: If the league starts with "International: ", remove "International: ". (e.g., "International: TT Elite Series" -> "TT Elite Series").
   - If "Czech: Czech Liga Pro" -> "Czech Liga Pro".
   - **ALLOWED LEAGUES**: Only use one of these 4 leagues: "Czech Liga Pro", "TT Elite Series", "TT Cup", "Setka Cup".
   - **DEFAULT**: If the league cannot be determined or doesn't match one of the 4 allowed leagues, use "TT Elite Series".`;

  const settingsExists = db.prepare('SELECT COUNT(*) as count FROM settings WHERE id = 1').get();
  if (settingsExists.count === 0) {
    db.prepare(`
      INSERT INTO settings (id, mentionString, botName, scheduleOffsetMinutes, slateTimezone, defaultOdds, aiInstructions, recapTitle, recapIncludeDate, recapIncludeRecord, recapIncludeNetUnits, recapIncludeROI, recapIncludeLeagueStats)
      VALUES (1, '@Chefs Plays', 'AI BetSlate Automator', 15, 'America/New_York', '-120', ?, 'Daily Recap', 1, 1, 1, 1, 0)
    `).run(defaultInstructions);
  } else {
    // Try to select from new columns, if they don't exist, migration will add them
    let currentSettings;
    try {
      currentSettings = db.prepare('SELECT aiInstructions, recapTitle, recapIncludeDate FROM settings WHERE id = 1').get();
    } catch (err) {
      // Columns don't exist yet, just get basic settings and set defaults after migration
      currentSettings = db.prepare('SELECT aiInstructions FROM settings WHERE id = 1').get();
    }
    
    if (!currentSettings.aiInstructions || currentSettings.aiInstructions === '') {
      db.prepare('UPDATE settings SET aiInstructions = ? WHERE id = 1').run(defaultInstructions);
    }
    
    // Update recap columns if they exist and have null values
    if (currentSettings.recapIncludeDate !== undefined) {
      if (currentSettings.recapIncludeDate === null || currentSettings.recapIncludeDate === undefined) {
        db.prepare(`UPDATE settings SET 
          recapTitle = COALESCE(recapTitle, 'Daily Recap'),
          recapIncludeDate = COALESCE(recapIncludeDate, 1),
          recapIncludeRecord = COALESCE(recapIncludeRecord, 1),
          recapIncludeNetUnits = COALESCE(recapIncludeNetUnits, 1),
          recapIncludeROI = COALESCE(recapIncludeROI, 1),
          recapIncludeLeagueStats = COALESCE(recapIncludeLeagueStats, 0)
        WHERE id = 1`).run();
      }
    }
  }

  console.log('✅ Database initialized');
};

export default db;
