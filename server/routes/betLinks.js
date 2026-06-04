import express from 'express';
import pool from '../database.js';

const router = express.Router();

// GET /api/bet-links?betId=xxx — all links for a bet with joined details
router.get('/', async (req, res) => {
  try {
    const { betId } = req.query;
    if (!betId) return res.status(400).json({ error: 'betId is required' });

    // Verify user owns the bet
    const betCheck = await pool.query(
      `SELECT b.id FROM bets b JOIN bots bo ON b.bot_id = bo.id WHERE b.id = $1 AND bo.user_id = $2`,
      [betId, req.user.id]
    );
    if (betCheck.rows.length === 0) return res.status(403).json({ error: 'Bet not found' });

    // Return links where this bet appears on either side
    const result = await pool.query(`
      SELECT
        bl.id,
        bl.bet_id AS "betId",
        bl.linked_bet_id AS "linkedBetId",
        bl.created_at AS "createdAt",
        lb."playerA" AS "linkedPlayerA",
        lb."playerB" AS "linkedPlayerB",
        lb.league AS "linkedLeague",
        lb."slateDate" AS "linkedSlateDate",
        lb.result AS "linkedResult",
        lbot.id AS "linkedBotId",
        lbot.name AS "linkedBotName"
      FROM bet_links bl
      JOIN bets lb ON lb.id = bl.linked_bet_id
      JOIN bots lbot ON lbot.id = lb.bot_id
      WHERE bl.bet_id = $1
      UNION ALL
      SELECT
        bl.id,
        bl.linked_bet_id AS "betId",
        bl.bet_id AS "linkedBetId",
        bl.created_at AS "createdAt",
        lb."playerA" AS "linkedPlayerA",
        lb."playerB" AS "linkedPlayerB",
        lb.league AS "linkedLeague",
        lb."slateDate" AS "linkedSlateDate",
        lb.result AS "linkedResult",
        lbot.id AS "linkedBotId",
        lbot.name AS "linkedBotName"
      FROM bet_links bl
      JOIN bets lb ON lb.id = bl.bet_id
      JOIN bots lbot ON lbot.id = lb.bot_id
      WHERE bl.linked_bet_id = $1
    `, [betId]);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bet-links/suggestions?betId=xxx — matching bets on other bots
router.get('/suggestions', async (req, res) => {
  try {
    const { betId } = req.query;
    if (!betId) return res.status(400).json({ error: 'betId is required' });

    const betResult = await pool.query(
      `SELECT b.*, bo.user_id FROM bets b JOIN bots bo ON b.bot_id = bo.id WHERE b.id = $1 AND bo.user_id = $2`,
      [betId, req.user.id]
    );
    if (betResult.rows.length === 0) return res.status(403).json({ error: 'Bet not found' });

    const sourceBet = betResult.rows[0];

    // Collect already-linked bet IDs to exclude
    const linkedResult = await pool.query(
      `SELECT bet_id, linked_bet_id FROM bet_links WHERE bet_id = $1 OR linked_bet_id = $1`,
      [betId]
    );
    const linkedIds = new Set(linkedResult.rows.flatMap(r => [r.bet_id, r.linked_bet_id]));
    linkedIds.delete(betId);
    const excludeIds = [betId, ...linkedIds];

    const result = await pool.query(`
      SELECT
        b.id,
        b."playerA",
        b."playerB",
        b.league,
        b."slateDate",
        b.type,
        b.result,
        bot.id AS "botId",
        bot.name AS "botName"
      FROM bets b
      JOIN bots bot ON b.bot_id = bot.id
      WHERE bot.user_id = $1
        AND b.bot_id != $2
        AND b."playerA" ILIKE $3
        AND b."playerB" ILIKE $4
        AND b.league = $5
        AND b.type = $6
        AND b.id != ALL($7::text[])
      ORDER BY b.timestamp DESC
      LIMIT 20
    `, [
      req.user.id,
      sourceBet.bot_id,
      sourceBet.playerA,
      sourceBet.playerB,
      sourceBet.league,
      sourceBet.type,
      excludeIds
    ]);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/bet-links — create a link between two bets
router.post('/', async (req, res) => {
  try {
    const { betId, linkedBetId } = req.body;
    if (!betId || !linkedBetId) return res.status(400).json({ error: 'betId and linkedBetId are required' });
    if (betId === linkedBetId) return res.status(400).json({ error: 'Cannot link a bet to itself' });

    // Verify user owns both bets
    const ownerCheck = await pool.query(`
      SELECT b.id FROM bets b
      JOIN bots bo ON b.bot_id = bo.id
      WHERE b.id IN ($1, $2) AND bo.user_id = $3
    `, [betId, linkedBetId, req.user.id]);
    if (ownerCheck.rows.length < 2) return res.status(403).json({ error: 'One or both bets not found' });

    const result = await pool.query(`
      INSERT INTO bet_links (user_id, bet_id, linked_bet_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (bet_id, linked_bet_id) DO NOTHING
      RETURNING *
    `, [req.user.id, betId, linkedBetId]);

    if (result.rows.length === 0) return res.json({ message: 'Link already exists' });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/bet-links/:id — remove a link
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM bet_links WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
