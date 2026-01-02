import express from 'express';
import db from '../database.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const bets = db.prepare('SELECT * FROM bets ORDER BY timestamp DESC').all();
    const formattedBets = bets.map(bet => ({
      ...bet,
      autoPost: Boolean(bet.autoPost),
      isPosted: Boolean(bet.isPosted)
    }));
    res.json(formattedBets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const bet = req.body;
    db.prepare(`
      INSERT INTO bets (
        id, league, playerA, playerB, time, type, units, odds, result, notes,
        timestamp, matchTimestamp, customScheduleTime, autoPost, isPosted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bet.id, bet.league, bet.playerA, bet.playerB, bet.time, bet.type,
      bet.units, bet.odds || null, bet.result, bet.notes || null,
      bet.timestamp, bet.matchTimestamp || null, bet.customScheduleTime || null,
      bet.autoPost ? 1 : 0, bet.isPosted ? 1 : 0
    );
    res.status(201).json(bet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        if (key === 'autoPost' || key === 'isPosted') {
          values.push(updates[key] ? 1 : 0);
        } else {
          values.push(updates[key]);
        }
      }
    });
    
    values.push(id);
    
    db.prepare(`UPDATE bets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    
    const updated = db.prepare('SELECT * FROM bets WHERE id = ?').get(id);
    res.json({
      ...updated,
      autoPost: Boolean(updated.autoPost),
      isPosted: Boolean(updated.isPosted)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM bets WHERE id = ?').run(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/', (req, res) => {
  try {
    db.prepare('DELETE FROM bets').run();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
