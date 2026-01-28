import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, 'betslate.db');
const db = new Database(dbPath);

console.log('🔄 Running database migration...');
console.log(`📂 Database path: ${dbPath}`);

try {
  // Check if columns exist
  const columns = db.prepare('PRAGMA table_info(settings)').all();
  const columnNames = columns.map(col => col.name);
  
  console.log('Current columns:', columnNames);
  
  // Add missing columns
  const columnsToAdd = [
    { name: 'recapTitle', sql: 'ALTER TABLE settings ADD COLUMN recapTitle TEXT DEFAULT "Daily Recap"' },
    { name: 'recapIncludeDate', sql: 'ALTER TABLE settings ADD COLUMN recapIncludeDate INTEGER DEFAULT 1' },
    { name: 'recapIncludeRecord', sql: 'ALTER TABLE settings ADD COLUMN recapIncludeRecord INTEGER DEFAULT 1' },
    { name: 'recapIncludeNetUnits', sql: 'ALTER TABLE settings ADD COLUMN recapIncludeNetUnits INTEGER DEFAULT 1' },
    { name: 'recapIncludeROI', sql: 'ALTER TABLE settings ADD COLUMN recapIncludeROI INTEGER DEFAULT 1' },
    { name: 'recapIncludeLeagueStats', sql: 'ALTER TABLE settings ADD COLUMN recapIncludeLeagueStats INTEGER DEFAULT 0' }
  ];
  
  for (const col of columnsToAdd) {
    if (!columnNames.includes(col.name)) {
      console.log(`➕ Adding column: ${col.name}`);
      db.exec(col.sql);
    } else {
      console.log(`✓ Column already exists: ${col.name}`);
    }
  }
  
  // Set defaults for existing row if needed
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  if (settings) {
    const updates = [];
    const params = [];
    
    if (settings.recapIncludeDate === null || settings.recapIncludeDate === undefined) {
      updates.push('recapTitle = ?', 'recapIncludeDate = ?', 'recapIncludeRecord = ?', 'recapIncludeNetUnits = ?', 'recapIncludeROI = ?', 'recapIncludeLeagueStats = ?');
      params.push('Daily Recap', 1, 1, 1, 1, 0);
      
      console.log('🔧 Setting default values for existing settings row...');
      db.prepare(`UPDATE settings SET ${updates.join(', ')} WHERE id = 1`).run(...params);
    }
  }
  
  console.log('✅ Migration completed successfully!');
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
