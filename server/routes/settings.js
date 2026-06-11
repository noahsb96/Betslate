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

const formatSettings = (s, defaults = {}) => ({
  mentionString: s.mentionString ?? defaults.mentionString ?? '@Chefs Plays',
  discordWebhookUrl: s.discordWebhookUrl ?? '',
  recapWebhookUrl: s.recapWebhookUrl ?? '',
  botName: s.botName ?? 'AI BetSlate Automator',
  botAvatarUrl: s.botAvatarUrl ?? '',
  scheduleOffsetMinutes: s.scheduleOffsetMinutes ?? 15,
  slateTimezone: s.slateTimezone ?? 'America/New_York',
  defaultOdds: s.defaultOdds ?? '-120',
  aiInstructions: s.aiInstructions || DEFAULT_AI_INSTRUCTIONS,
  recapTitle: s.recapTitle || 'Daily Recap',
  recapIncludeDate: s.recapIncludeDate ?? true,
  recapIncludeRecord: s.recapIncludeRecord ?? true,
  recapIncludeNetUnits: s.recapIncludeNetUnits ?? true,
  recapIncludeROI: s.recapIncludeROI ?? true,
  recapIncludeLeagueStats: s.recapIncludeLeagueStats ?? false,
  defaultBetAlertTitle: s.defaultBetAlertTitle || '📢 Bet Alert',
  betEmbedColor: s.betEmbedColor || 16731469,
  recapEmbedColor: s.recapEmbedColor || 16731469,
  defaultRoles: s.default_roles ?? [],
  mentionRoles: s.mention_roles ?? [],
  leagueRoleMappings: s.league_role_mappings ?? []
});

// Verify botId belongs to the authenticated user
const verifyBotOwnership = async (botId, userId) => {
  const result = await pool.query(
    'SELECT id FROM bots WHERE id = $1 AND user_id = $2',
    [botId, userId]
  );
  return result.rows.length > 0;
};

// GET /api/settings?botId=xxx
router.get('/', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ error: 'botId query parameter is required' });

    const owned = await verifyBotOwnership(botId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'Bot not found' });

    const result = await pool.query(
      'SELECT * FROM settings WHERE bot_id = $1',
      [botId]
    );

    if (result.rows.length === 0) {
      return res.json(formatSettings({}));
    }
    res.json(formatSettings(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings — body must include botId
router.put('/', async (req, res) => {
  try {
    const s = req.body;
    const botId = s.botId;
    if (!botId) return res.status(400).json({ error: 'botId is required in request body' });

    const owned = await verifyBotOwnership(botId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'Bot not found' });

    const result = await pool.query(
      `INSERT INTO settings (
        bot_id, user_id, "mentionString", "discordWebhookUrl", "recapWebhookUrl", "botName",
        "botAvatarUrl", "scheduleOffsetMinutes", "slateTimezone", "defaultOdds",
        "aiInstructions", "recapTitle", "recapIncludeDate", "recapIncludeRecord",
        "recapIncludeNetUnits", "recapIncludeROI", "recapIncludeLeagueStats",
        "defaultBetAlertTitle", "betEmbedColor", "recapEmbedColor",
        mention_roles, league_role_mappings, default_roles
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      ON CONFLICT (bot_id) DO UPDATE SET
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
        "recapEmbedColor" = EXCLUDED."recapEmbedColor",
        mention_roles = EXCLUDED.mention_roles,
        league_role_mappings = EXCLUDED.league_role_mappings,
        default_roles = EXCLUDED.default_roles
      RETURNING *`,
      [
        botId,
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
        s.recapEmbedColor || 16731469,
        JSON.stringify(Array.isArray(s.mentionRoles) ? s.mentionRoles : []),
        JSON.stringify(Array.isArray(s.leagueRoleMappings) ? s.leagueRoleMappings : []),
        JSON.stringify(Array.isArray(s.defaultRoles) ? s.defaultRoles : [])
      ]
    );

    res.json(formatSettings(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
