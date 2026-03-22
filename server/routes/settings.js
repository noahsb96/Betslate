import express from 'express';
import pool from '../database.js';

const router = express.Router();

const DEFAULT_AI_INSTRUCTIONS = `You are an expert sports betting assistant specialized in Table Tennis.
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

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM settings WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({
        mentionString: '@Chefs Plays',
        discordWebhookUrl: '',
        recapWebhookUrl: '',
        botName: 'AI BetSlate Automator',
        botAvatarUrl: '',
        scheduleOffsetMinutes: 15,
        slateTimezone: 'America/New_York',
        defaultOdds: '-120',
        aiInstructions: DEFAULT_AI_INSTRUCTIONS,
        recapTitle: 'Daily Recap',
        recapIncludeDate: true,
        recapIncludeRecord: true,
        recapIncludeNetUnits: true,
        recapIncludeROI: true,
        recapIncludeLeagueStats: false,
        defaultBetAlertTitle: '📢 Bet Alert',
        betEmbedColor: 16731469,
        recapEmbedColor: 16731469
      });
    }

    const s = result.rows[0];
    res.json({
      mentionString: s.mentionString,
      discordWebhookUrl: s.discordWebhookUrl,
      recapWebhookUrl: s.recapWebhookUrl,
      botName: s.botName,
      botAvatarUrl: s.botAvatarUrl,
      scheduleOffsetMinutes: s.scheduleOffsetMinutes,
      slateTimezone: s.slateTimezone,
      defaultOdds: s.defaultOdds,
      aiInstructions: s.aiInstructions || DEFAULT_AI_INSTRUCTIONS,
      recapTitle: s.recapTitle || 'Daily Recap',
      recapIncludeDate: s.recapIncludeDate ?? true,
      recapIncludeRecord: s.recapIncludeRecord ?? true,
      recapIncludeNetUnits: s.recapIncludeNetUnits ?? true,
      recapIncludeROI: s.recapIncludeROI ?? true,
      recapIncludeLeagueStats: s.recapIncludeLeagueStats ?? false,
      defaultBetAlertTitle: s.defaultBetAlertTitle || '📢 Bet Alert',
      betEmbedColor: s.betEmbedColor || 16731469,
      recapEmbedColor: s.recapEmbedColor || 16731469
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const s = req.body;
    const result = await pool.query(
      `INSERT INTO settings (
        user_id, "mentionString", "discordWebhookUrl", "recapWebhookUrl", "botName",
        "botAvatarUrl", "scheduleOffsetMinutes", "slateTimezone", "defaultOdds",
        "aiInstructions", "recapTitle", "recapIncludeDate", "recapIncludeRecord",
        "recapIncludeNetUnits", "recapIncludeROI", "recapIncludeLeagueStats",
        "defaultBetAlertTitle", "betEmbedColor", "recapEmbedColor"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (user_id) DO UPDATE SET
        "mentionString" = EXCLUDED."mentionString",
        "discordWebhookUrl" = EXCLUDED."discordWebhookUrl",
        "recapWebhookUrl" = EXCLUDED."recapWebhookUrl",
        "botName" = EXCLUDED."botName",
        "botAvatarUrl" = EXCLUDED."botAvatarUrl",
        "scheduleOffsetMinutes" = EXCLUDED."scheduleOffsetMinutes",
        "slateTimezone" = EXCLUDED."slateTimezone",
        "defaultOdds" = EXCLUDED."defaultOdds",
        "aiInstructions" = EXCLUDED."aiInstructions",
        "recapTitle" = EXCLUDED."recapTitle",
        "recapIncludeDate" = EXCLUDED."recapIncludeDate",
        "recapIncludeRecord" = EXCLUDED."recapIncludeRecord",
        "recapIncludeNetUnits" = EXCLUDED."recapIncludeNetUnits",
        "recapIncludeROI" = EXCLUDED."recapIncludeROI",
        "recapIncludeLeagueStats" = EXCLUDED."recapIncludeLeagueStats",
        "defaultBetAlertTitle" = EXCLUDED."defaultBetAlertTitle",
        "betEmbedColor" = EXCLUDED."betEmbedColor",
        "recapEmbedColor" = EXCLUDED."recapEmbedColor"
      RETURNING *`,
      [
        req.user.id,
        s.mentionString || '',
        s.discordWebhookUrl || '',
        s.recapWebhookUrl || '',
        s.botName || 'AI BetSlate Automator',
        s.botAvatarUrl || '',
        s.scheduleOffsetMinutes || 15,
        s.slateTimezone || 'America/New_York',
        s.defaultOdds || '-120',
        s.aiInstructions || DEFAULT_AI_INSTRUCTIONS,
        s.recapTitle || 'Daily Recap',
        s.recapIncludeDate ?? true,
        s.recapIncludeRecord ?? true,
        s.recapIncludeNetUnits ?? true,
        s.recapIncludeROI ?? true,
        s.recapIncludeLeagueStats ?? false,
        s.defaultBetAlertTitle || '📢 Bet Alert',
        s.betEmbedColor || 16731469,
        s.recapEmbedColor || 16731469
      ]
    );

    const updated = result.rows[0];
    res.json({
      mentionString: updated.mentionString,
      discordWebhookUrl: updated.discordWebhookUrl,
      recapWebhookUrl: updated.recapWebhookUrl,
      botName: updated.botName,
      botAvatarUrl: updated.botAvatarUrl,
      scheduleOffsetMinutes: updated.scheduleOffsetMinutes,
      slateTimezone: updated.slateTimezone,
      defaultOdds: updated.defaultOdds,
      aiInstructions: updated.aiInstructions,
      recapTitle: updated.recapTitle,
      recapIncludeDate: updated.recapIncludeDate,
      recapIncludeRecord: updated.recapIncludeRecord,
      recapIncludeNetUnits: updated.recapIncludeNetUnits,
      recapIncludeROI: updated.recapIncludeROI,
      recapIncludeLeagueStats: updated.recapIncludeLeagueStats,
      defaultBetAlertTitle: updated.defaultBetAlertTitle,
      betEmbedColor: updated.betEmbedColor,
      recapEmbedColor: updated.recapEmbedColor
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

