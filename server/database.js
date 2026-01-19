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
      botName TEXT DEFAULT 'The Commissioner',
      botAvatarUrl TEXT DEFAULT '',
      scheduleOffsetMinutes INTEGER DEFAULT 15,
      slateTimezone TEXT DEFAULT 'America/New_York',
      defaultOdds TEXT DEFAULT '-120'
    )
  `);

  const settingsExists = db.prepare('SELECT COUNT(*) as count FROM settings WHERE id = 1').get();
  if (settingsExists.count === 0) {
    db.prepare(`
      INSERT INTO settings (id, mentionString, botName, scheduleOffsetMinutes, slateTimezone, defaultOdds)
      VALUES (1, '@Chefs Plays', 'The Commissioner', 15, 'America/New_York', '-120')
    `).run();
  }

  console.log('✅ Database initialized');
};

export default db;
