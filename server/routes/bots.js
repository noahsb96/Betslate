import express from 'express';
import pool from '../database.js';

const router = express.Router();

// GET /api/bots — list all bots for the authenticated user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, order_index, created_at FROM bots WHERE user_id = $1 ORDER BY order_index ASC, created_at ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/bots — create a new bot and its default settings row
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bot name is required' });
    }

    // Next order_index = current count of bots for this user
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM bots WHERE user_id = $1',
      [req.user.id]
    );
    const orderIndex = parseInt(countResult.rows[0].count, 10);

    // Create the bot
    const botResult = await pool.query(
      `INSERT INTO bots (user_id, name, order_index)
       VALUES ($1, $2, $3)
       RETURNING id, name, order_index, created_at`,
      [req.user.id, name.trim(), orderIndex]
    );
    const bot = botResult.rows[0];

    // Create a default settings row for the new bot
    await pool.query(
      `INSERT INTO settings (bot_id, user_id) VALUES ($1, $2)
       ON CONFLICT (bot_id) DO NOTHING`,
      [bot.id, req.user.id]
    );

    res.status(201).json(bot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/bots/:id — rename a bot
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bot name is required' });
    }

    const result = await pool.query(
      `UPDATE bots SET name = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, name, order_index, created_at`,
      [name.trim(), id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/bots/:id — delete a bot (cascades bets, recaps, settings via FK)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const check = await pool.query(
      'SELECT id FROM bots WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Prevent deleting the last bot
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM bots WHERE user_id = $1',
      [req.user.id]
    );
    if (parseInt(countResult.rows[0].count, 10) <= 1) {
      return res.status(400).json({ error: 'Cannot delete your last bot' });
    }

    await pool.query(
      'DELETE FROM bots WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
