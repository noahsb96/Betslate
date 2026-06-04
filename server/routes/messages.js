import express from 'express';
import pool from '../database.js';

const router = express.Router();

const verifyBotOwnership = async (botId, userId) => {
  const result = await pool.query('SELECT id FROM bots WHERE id = $1 AND user_id = $2', [botId, userId]);
  return result.rows.length > 0;
};

const formatMessage = (row) => ({
  id: row.id,
  botId: row.bot_id,
  content: row.content || '',
  imageUrl: row.image_url || '',
  imageData: row.image_data || '',
  imageFilename: row.image_filename || '',
  embedTitle: row.embed_title || '',
  embedColor: row.embed_color || 16731469,
  roleMentions: row.role_mentions || [],
  scheduledTime: Number(row.scheduled_time),
  isSent: row.is_sent,
  createdAt: row.created_at
});

// GET /api/messages?botId=xxx&includeSent=false
router.get('/', async (req, res) => {
  try {
    const { botId, includeSent } = req.query;
    if (!botId) return res.status(400).json({ error: 'botId is required' });

    const owned = await verifyBotOwnership(botId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'Bot not found' });

    const showSent = includeSent === 'true';
    const result = await pool.query(
      `SELECT * FROM scheduled_messages WHERE bot_id = $1 ${showSent ? '' : 'AND is_sent = false'} ORDER BY scheduled_time ASC`,
      [botId]
    );
    res.json(result.rows.map(formatMessage));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messages — create a scheduled message
router.post('/', async (req, res) => {
  try {
    const { botId, content, imageUrl, imageData, imageFilename, embedTitle, embedColor, roleMentions, scheduledTime } = req.body;
    if (!botId) return res.status(400).json({ error: 'botId is required' });
    if (!scheduledTime) return res.status(400).json({ error: 'scheduledTime is required' });

    const owned = await verifyBotOwnership(botId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'Bot not found' });

    const result = await pool.query(`
      INSERT INTO scheduled_messages
        (user_id, bot_id, content, image_url, image_data, image_filename, embed_title, embed_color, role_mentions, scheduled_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      req.user.id, botId,
      content || '',
      imageUrl || '',
      imageData || '',
      imageFilename || '',
      embedTitle || '',
      embedColor || 16731469,
      JSON.stringify(roleMentions || []),
      String(scheduledTime)
    ]);
    res.status(201).json(formatMessage(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/messages/:id — update a scheduled message
router.patch('/:id', async (req, res) => {
  try {
    const ownerCheck = await pool.query(
      'SELECT id FROM scheduled_messages WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Message not found' });

    const { content, imageUrl, imageData, imageFilename, embedTitle, embedColor, roleMentions, scheduledTime } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (content !== undefined)       { fields.push(`content = $${idx++}`);         values.push(content); }
    if (imageUrl !== undefined)      { fields.push(`image_url = $${idx++}`);        values.push(imageUrl); }
    if (imageData !== undefined)     { fields.push(`image_data = $${idx++}`);       values.push(imageData); }
    if (imageFilename !== undefined) { fields.push(`image_filename = $${idx++}`);   values.push(imageFilename); }
    if (embedTitle !== undefined)    { fields.push(`embed_title = $${idx++}`);      values.push(embedTitle); }
    if (embedColor !== undefined)    { fields.push(`embed_color = $${idx++}`);      values.push(embedColor); }
    if (roleMentions !== undefined)  { fields.push(`role_mentions = $${idx++}`);    values.push(JSON.stringify(roleMentions)); }
    if (scheduledTime !== undefined) { fields.push(`scheduled_time = $${idx++}`);   values.push(String(scheduledTime)); }

    if (fields.length === 0) return res.json({ message: 'No fields to update' });

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE scheduled_messages SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(formatMessage(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/messages/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM scheduled_messages WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
