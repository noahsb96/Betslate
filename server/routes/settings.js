import express from 'express';
import db from '../database.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    
    const formattedSettings = {
      ...settings,
      recapTitle: settings.recapTitle || 'Daily Recap',
      recapIncludeDate: settings.recapIncludeDate !== null ? Boolean(settings.recapIncludeDate) : true,
      recapIncludeRecord: settings.recapIncludeRecord !== null ? Boolean(settings.recapIncludeRecord) : true,
      recapIncludeNetUnits: settings.recapIncludeNetUnits !== null ? Boolean(settings.recapIncludeNetUnits) : true,
      recapIncludeROI: settings.recapIncludeROI !== null ? Boolean(settings.recapIncludeROI) : true,
      recapIncludeLeagueStats: settings.recapIncludeLeagueStats !== null ? Boolean(settings.recapIncludeLeagueStats) : false
    };
    
    res.json(formattedSettings);
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
        defaultOdds = ?,
        aiInstructions = ?,
        recapTitle = ?,
        recapIncludeDate = ?,
        recapIncludeRecord = ?,
        recapIncludeNetUnits = ?,
        recapIncludeROI = ?,
        recapIncludeLeagueStats = ?
      WHERE id = 1
    `).run(
      settings.mentionString || '',
      settings.discordWebhookUrl || '',
      settings.recapWebhookUrl || '',
      settings.botName || 'AI BetSlate Automator',
      settings.botAvatarUrl || '',
      settings.scheduleOffsetMinutes || 15,
      settings.slateTimezone || 'America/New_York',
      settings.defaultOdds || '-120',
      settings.aiInstructions || '',
      settings.recapTitle || 'Daily Recap',
      settings.recapIncludeDate ? 1 : 0,
      settings.recapIncludeRecord ? 1 : 0,
      settings.recapIncludeNetUnits ? 1 : 0,
      settings.recapIncludeROI ? 1 : 0,
      settings.recapIncludeLeagueStats ? 1 : 0
    );
    
    const updated = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    
    const formattedUpdated = {
      ...updated,
      recapTitle: updated.recapTitle || 'Daily Recap',
      recapIncludeDate: updated.recapIncludeDate !== null ? Boolean(updated.recapIncludeDate) : true,
      recapIncludeRecord: updated.recapIncludeRecord !== null ? Boolean(updated.recapIncludeRecord) : true,
      recapIncludeNetUnits: updated.recapIncludeNetUnits !== null ? Boolean(updated.recapIncludeNetUnits) : true,
      recapIncludeROI: updated.recapIncludeROI !== null ? Boolean(updated.recapIncludeROI) : true,
      recapIncludeLeagueStats: updated.recapIncludeLeagueStats !== null ? Boolean(updated.recapIncludeLeagueStats) : false
    };
    
    res.json(formattedUpdated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
