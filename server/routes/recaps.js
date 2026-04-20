import express from 'express';
import pool from '../database.js';

const router = express.Router();

// Verify botId belongs to the authenticated user
const verifyBotOwnership = async (botId, userId) => {
  const result = await pool.query(
    'SELECT id FROM bots WHERE id = $1 AND user_id = $2',
    [botId, userId]
  );
  return result.rows.length > 0;
};

// GET /api/recaps/calendar?year=2026&month=3&botId=xxx
router.get('/calendar', async (req, res) => {
  try {
    const { year, month, botId } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month query params required' });
    }
    if (!botId) return res.status(400).json({ error: 'botId query parameter is required' });

    const owned = await verifyBotOwnership(botId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'Bot not found' });

    const pad = String(month).padStart(2, '0');
    const from = `${year}-${pad}-01`;
    const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const to = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const result = await pool.query(
      `SELECT date, wins, losses, pushes, net_units, roi, league_breakdown
       FROM daily_recaps
       WHERE bot_id = $1 AND date >= $2 AND date < $3
       ORDER BY date ASC`,
      [botId, from, to]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/recaps/daily — body must include botId
router.post('/daily', async (req, res) => {
  try {
    const { date, wins, losses, pushes, net_units, roi, league_breakdown, botId } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (!botId) return res.status(400).json({ error: 'botId is required' });

    const owned = await verifyBotOwnership(botId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'Bot not found' });

    const result = await pool.query(
      `INSERT INTO daily_recaps (user_id, bot_id, date, wins, losses, pushes, net_units, roi, league_breakdown)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (bot_id, date) DO UPDATE SET
         wins = EXCLUDED.wins,
         losses = EXCLUDED.losses,
         pushes = EXCLUDED.pushes,
         net_units = EXCLUDED.net_units,
         roi = EXCLUDED.roi,
         league_breakdown = EXCLUDED.league_breakdown,
         created_at = now()
       RETURNING *`,
      [
        req.user.id,
        botId,
        date,
        wins ?? 0,
        losses ?? 0,
        pushes ?? 0,
        net_units ?? 0,
        roi ?? 0,
        JSON.stringify(league_breakdown ?? [])
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recaps/daily/:date?botId=xxx
router.get('/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ error: 'botId query parameter is required' });

    const owned = await verifyBotOwnership(botId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'Bot not found' });

    const [recap, bets] = await Promise.all([
      pool.query(
        `SELECT * FROM daily_recaps WHERE bot_id = $1 AND date = $2`,
        [botId, date]
      ),
      pool.query(
        `SELECT * FROM bets WHERE bot_id = $1 AND "slateDate" = $2 ORDER BY "matchTimestamp" ASC NULLS LAST, timestamp ASC`,
        [botId, date]
      )
    ]);
    res.json({
      recap: recap.rows[0] || null,
      bets: bets.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recaps/monthly/:year/:month?botId=xxx
router.get('/monthly/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ error: 'botId query parameter is required' });

    const owned = await verifyBotOwnership(botId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'Bot not found' });

    const pad = String(month).padStart(2, '0');
    const from = `${year}-${pad}-01`;
    const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const to = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const dailyResult = await pool.query(
      `SELECT date, wins, losses, pushes, net_units, roi, league_breakdown
       FROM daily_recaps
       WHERE bot_id = $1 AND date >= $2 AND date < $3
       ORDER BY date ASC`,
      [botId, from, to]
    );

    const totals = dailyResult.rows.reduce(
      (acc, row) => ({
        wins: acc.wins + row.wins,
        losses: acc.losses + row.losses,
        pushes: acc.pushes + row.pushes,
        net_units: acc.net_units + parseFloat(row.net_units)
      }),
      { wins: 0, losses: 0, pushes: 0, net_units: 0 }
    );

    const totalBets = totals.wins + totals.losses + totals.pushes;
    const totalUnitsRisked = dailyResult.rows.reduce((acc, row) => acc + row.wins + row.losses + row.pushes, 0);

    const leagueTotals = {};
    for (const row of dailyResult.rows) {
      const lb = Array.isArray(row.league_breakdown) ? row.league_breakdown : [];
      for (const item of lb) {
        if (!leagueTotals[item.league]) leagueTotals[item.league] = 0;
        leagueTotals[item.league] += item.units;
      }
    }
    const league_breakdown = Object.entries(leagueTotals)
      .map(([league, units]) => ({ league, units: parseFloat(units.toFixed(2)) }))
      .sort((a, b) => b.units - a.units);

    res.json({
      period: `${year}-${pad}`,
      ...totals,
      net_units: parseFloat(totals.net_units.toFixed(2)),
      roi: totalUnitsRisked > 0
        ? parseFloat(((totals.net_units / totalUnitsRisked) * 100).toFixed(1))
        : 0,
      total_bets: totalBets,
      league_breakdown,
      days: dailyResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recaps/yearly/:year?botId=xxx
router.get('/yearly/:year', async (req, res) => {
  try {
    const { year } = req.params;
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ error: 'botId query parameter is required' });

    const owned = await verifyBotOwnership(botId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'Bot not found' });

    const from = `${year}-01-01`;
    const to = `${parseInt(year) + 1}-01-01`;

    const dailyResult = await pool.query(
      `SELECT date, wins, losses, pushes, net_units, roi, league_breakdown
       FROM daily_recaps
       WHERE bot_id = $1 AND date >= $2 AND date < $3
       ORDER BY date ASC`,
      [botId, from, to]
    );

    const byMonth = {};
    for (const row of dailyResult.rows) {
      const monthKey = row.date.substring(0, 7);
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { wins: 0, losses: 0, pushes: 0, net_units: 0, days_with_recaps: 0, leagueTotals: {} };
      }
      byMonth[monthKey].wins += row.wins;
      byMonth[monthKey].losses += row.losses;
      byMonth[monthKey].pushes += row.pushes;
      byMonth[monthKey].net_units += parseFloat(row.net_units);
      byMonth[monthKey].days_with_recaps += 1;
      const lb = Array.isArray(row.league_breakdown) ? row.league_breakdown : [];
      for (const item of lb) {
        if (!byMonth[monthKey].leagueTotals[item.league]) byMonth[monthKey].leagueTotals[item.league] = 0;
        byMonth[monthKey].leagueTotals[item.league] += item.units;
      }
    }

    const months = Object.entries(byMonth).map(([month, data]) => {
      const totalBets = data.wins + data.losses + data.pushes;
      const league_breakdown = Object.entries(data.leagueTotals)
        .map(([league, units]) => ({ league, units: parseFloat(units.toFixed(2)) }))
        .sort((a, b) => b.units - a.units);
      return {
        month,
        wins: data.wins,
        losses: data.losses,
        pushes: data.pushes,
        net_units: parseFloat(data.net_units.toFixed(2)),
        total_bets: totalBets,
        days_with_recaps: data.days_with_recaps,
        league_breakdown
      };
    });

    const yearLeagueTotals = {};
    const totals = dailyResult.rows.reduce(
      (acc, row) => {
        const lb = Array.isArray(row.league_breakdown) ? row.league_breakdown : [];
        for (const item of lb) {
          if (!yearLeagueTotals[item.league]) yearLeagueTotals[item.league] = 0;
          yearLeagueTotals[item.league] += item.units;
        }
        return {
          wins: acc.wins + row.wins,
          losses: acc.losses + row.losses,
          pushes: acc.pushes + row.pushes,
          net_units: acc.net_units + parseFloat(row.net_units)
        };
      },
      { wins: 0, losses: 0, pushes: 0, net_units: 0 }
    );

    const league_breakdown = Object.entries(yearLeagueTotals)
      .map(([league, units]) => ({ league, units: parseFloat(units.toFixed(2)) }))
      .sort((a, b) => b.units - a.units);

    res.json({
      year: parseInt(year),
      ...totals,
      net_units: parseFloat(totals.net_units.toFixed(2)),
      total_bets: totals.wins + totals.losses + totals.pushes,
      league_breakdown,
      months
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
