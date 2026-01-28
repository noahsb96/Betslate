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
      aiInstructions TEXT DEFAULT ''
    )
  `);

  try {
    db.exec(`ALTER TABLE settings ADD COLUMN aiInstructions TEXT DEFAULT ''`);
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
      INSERT INTO settings (id, mentionString, botName, scheduleOffsetMinutes, slateTimezone, defaultOdds, aiInstructions)
      VALUES (1, '@Chefs Plays', 'AI BetSlate Automator', 15, 'America/New_York', '-120', ?)
    `).run(defaultInstructions);
  } else {
    const currentSettings = db.prepare('SELECT aiInstructions FROM settings WHERE id = 1').get();
    if (!currentSettings.aiInstructions || currentSettings.aiInstructions === '') {
      db.prepare('UPDATE settings SET aiInstructions = ? WHERE id = 1').run(defaultInstructions);
    }
  }

  console.log('✅ Database initialized');
};

export default db;
