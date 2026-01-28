import express from 'express';
import db from '../database.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', (req, res) => {
  try {
    const settings = req.body;
    
    db.prepare(`
      UPDATE settings SET
        mentionString = ?,
        discordWebhookUrl = ?,
        recapWebhookUrl = ?,
        botName = ?,
        botAvatarUrl = ?,
        scheduleOffsetMinutes = ?,
        slateTimezone = ?,
        defaultOdds = ?
      WHERE id = 1
    `).run(
      settings.mentionString || '',
      settings.discordWebhookUrl || '',
      settings.recapWebhookUrl || '',
      settings.botName || 'AI BetSlate Automator',
      settings.botAvatarUrl || '',
      settings.scheduleOffsetMinutes || 15,
      settings.slateTimezone || 'America/New_York',
      settings.defaultOdds || '-120'
    );
    
    const updated = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
