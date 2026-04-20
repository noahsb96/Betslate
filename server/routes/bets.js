import express from 'express';
import pool from '../database.js';

const router = express.Router();

const ALLOWED_UPDATE_FIELDS = new Set([
  'league', 'playerA', 'playerB', 'time', 'type', 'units', 'odds', 'result',
  'notes', 'timestamp', 'matchTimestamp', 'customScheduleTime', 'autoPost',
  'isPosted', 'customTitle', 'slateDate'
]);

// Verify a botId belongs to the authenticated user
const verifyBotOwnership = async (botId, userId) => {
  const result = await pool.query(
    'SELECT id FROM bots WHERE id = $1 AND user_id = $2',
    [botId, userId]
  );
  return result.rows.length > 0;
};

router.get('/', async (req, res) => {
  try {
    const { botId } = req.query;
    if (botId) {
      const owned = await verifyBotOwnership(botId, req.user.id);
      if (!owned) return res.status(403).json({ error: 'Bot not found' });
      const result = await pool.query(
        'SELECT * FROM bets WHERE user_id = $1 AND bot_id = $2 ORDER BY timestamp DESC',
        [req.user.id, botId]
      );
      return res.json(result.rows);
    }
    const result = await pool.query(
      'SELECT * FROM bets WHERE user_id = $1 ORDER BY timestamp DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const bet = req.body;
    const botId = bet.botId || null;

    if (botId) {
      const owned = await verifyBotOwnership(botId, req.user.id);
      if (!owned) return res.status(403).json({ error: 'Bot not found' });
    }

    await pool.query(
      `INSERT INTO bets (
        id, user_id, bot_id, league, "playerA", "playerB", time, type, units, odds, result, notes,
        timestamp, "matchTimestamp", "customScheduleTime", "autoPost", "isPosted", "customTitle", "slateDate"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        bet.id, req.user.id, botId, bet.league, bet.playerA, bet.playerB, bet.time, bet.type,
        bet.units, bet.odds || null, bet.result, bet.notes || null,
        bet.timestamp, bet.matchTimestamp || null, bet.customScheduleTime || null,
        bet.autoPost ?? false, bet.isPosted ?? false, bet.customTitle || null,
        bet.slateDate || null
      ]
    );
    res.status(201).json({ ...bet, botId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || key === 'user_id' || key === 'botId' || key === 'bot_id' || !ALLOWED_UPDATE_FIELDS.has(key)) continue;
      fields.push(`"${key}" = $${idx++}`);
      values.push(value);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    values.push(id, req.user.id);
    const result = await pool.query(
      `UPDATE bets SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bet not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM bets WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    const { slateDate, botId } = req.query;

    if (botId) {
      const owned = await verifyBotOwnership(botId, req.user.id);
      if (!owned) return res.status(403).json({ error: 'Bot not found' });
      if (slateDate) {
        await pool.query(
          'DELETE FROM bets WHERE user_id = $1 AND bot_id = $2 AND "slateDate" = $3',
          [req.user.id, botId, slateDate]
        );
      } else {
        await pool.query(
          'DELETE FROM bets WHERE user_id = $1 AND bot_id = $2',
          [req.user.id, botId]
        );
      }
    } else if (slateDate) {
      await pool.query('DELETE FROM bets WHERE user_id = $1 AND "slateDate" = $2', [req.user.id, slateDate]);
    } else {
      await pool.query('DELETE FROM bets WHERE user_id = $1', [req.user.id]);
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

