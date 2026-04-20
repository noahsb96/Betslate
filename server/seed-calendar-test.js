/**
 * Calendar test seed script.
 * Run with: node --env-file .env server/seed-calendar-test.js
 *
 * - Finds the first user in the DB (or a specific email if passed as arg)
 * - Inserts 3 weeks of realistic bets (with slateDate set)
 * - Inserts daily_recap rows for each day so the calendar badges render
 */

import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'crypto';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const LEAGUES = ['TT Elite Series', 'Czech Liga Pro', 'Setka Cup', 'TT Cup'];
const PLAYERS = [
  ['Sidorov', 'Petrov'],   ['Novak', 'Dvorak'],
  ['Huang', 'Chen'],       ['Sousa', 'Lima'],
  ['Kim', 'Park'],         ['Ivanov', 'Kozlov'],
  ['Toth', 'Kovacs'],      ['Diallo', 'Camara'],
  ['Nguyen', 'Tran'],      ['Santos', 'Ferreira'],
];
const TYPES = ['OVER', 'UNDER', 'OVER', 'OVER', 'SPLIT']; // weighted toward OVER
const UNITS = [1, 1, 1, 1.5, 1.5, 3];

// Possible daily result sets: [wins, losses, pushes]
// Varying enough to make the calendar look interesting
const DAY_SCENARIOS = [
  [4, 1, 0], [3, 2, 0], [5, 0, 1], [2, 3, 0],
  [3, 1, 1], [6, 1, 0], [1, 4, 0], [4, 2, 1],
  [2, 2, 0], [5, 2, 0], [0, 4, 0], [3, 3, 0],
  [4, 0, 0], [2, 1, 0], [6, 2, 1], [3, 2, 1],
  [1, 3, 0], [5, 1, 1], [4, 3, 0], [2, 0, 0],
  [3, 1, 0],
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function calcNetUnits(bets, defaultOdds = -120) {
  let net = 0;
  for (const b of bets) {
    const odds = parseInt(b.odds || defaultOdds);
    if (b.result === 'WIN') {
      net += odds > 0 ? b.units * (odds / 100) : b.units * (100 / Math.abs(odds));
    } else if (b.result === 'LOSS') {
      net -= b.units;
    }
  }
  return parseFloat(net.toFixed(2));
}

function leagueBreakdown(bets, defaultOdds = -120) {
  const map = {};
  for (const b of bets) {
    if (!map[b.league]) map[b.league] = 0;
    const odds = parseInt(b.odds || defaultOdds);
    if (b.result === 'WIN') map[b.league] += odds > 0 ? b.units * (odds / 100) : b.units * (100 / Math.abs(odds));
    if (b.result === 'LOSS') map[b.league] -= b.units;
  }
  return Object.entries(map).map(([league, units]) => ({ league, units: parseFloat(units.toFixed(2)) }));
}

async function seed() {
  const emailArg = process.argv[2];

  // Find user
  const userQuery = emailArg
    ? await pool.query('SELECT id, email FROM users WHERE email = $1', [emailArg])
    : await pool.query('SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1');

  if (userQuery.rows.length === 0) {
    console.error('❌ No user found. Sign up first, then run this script.');
    process.exit(1);
  }

  const user = userQuery.rows[0];
  console.log(`\n🎯 Seeding test data for user: ${user.email} (${user.id})\n`);

  // Build date range: Jan 1 through yesterday (covers full year so far for yearly recap)
  // We skip today so the History & Stats tab shows a clean current-day view.
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getFullYear(), 0, 1); // Jan 1 of current year

  // Generate roughly every other day to keep the dataset realistic
  // (betting services don't run every single day)
  let cursor = new Date(start);
  while (cursor < today) {
    // Skip ~30% of days randomly to simulate non-betting days
    if (Math.random() > 0.3) {
      dates.push(cursor.toISOString().split('T')[0]);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  let totalBets = 0;
  let totalRecaps = 0;

  for (let di = 0; di < dates.length; di++) {
    const slateDate = dates[di];
    const [wins, losses, pushes] = DAY_SCENARIOS[di % DAY_SCENARIOS.length];
    const totalDay = wins + losses + pushes;

    const betsForDay = [];

    // Build result pool
    const results = [
      ...Array(wins).fill('WIN'),
      ...Array(losses).fill('LOSS'),
      ...Array(pushes).fill('PUSH')
    ];
    // Shuffle results
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }

    for (let bi = 0; bi < totalDay; bi++) {
      const [pA, pB] = pick(PLAYERS);
      const league = pick(LEAGUES);
      const units = pick(UNITS);
      const odds = pick(['-110', '-115', '-120', '-125', '+100', '+105']);
      const hour = 10 + bi;
      const timeStr = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
      const matchTs = new Date(`${slateDate}T${String(hour).padStart(2,'0')}:00:00Z`).getTime();

      const bet = {
        id: randomUUID().replace(/-/g, '').substring(0, 20),
        league,
        playerA: pA,
        playerB: pB,
        time: timeStr,
        type: pick(TYPES),
        units,
        odds,
        result: results[bi],
        notes: null,
        timestamp: matchTs - 3600000,
        matchTimestamp: matchTs,
        customScheduleTime: null,
        autoPost: false,
        isPosted: true,
        customTitle: null,
        slateDate
      };
      betsForDay.push(bet);
    }

    // Insert bets (skip duplicates)
    for (const b of betsForDay) {
      try {
        await pool.query(`
          INSERT INTO bets (id, user_id, league, "playerA", "playerB", time, type, units, odds, result,
            notes, timestamp, "matchTimestamp", "customScheduleTime", "autoPost", "isPosted", "customTitle", "slateDate")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
          ON CONFLICT (id) DO NOTHING
        `, [
          b.id, user.id, b.league, b.playerA, b.playerB, b.time, b.type, b.units,
          b.odds, b.result, b.notes, b.timestamp, b.matchTimestamp, b.customScheduleTime,
          b.autoPost, b.isPosted, b.customTitle, b.slateDate
        ]);
        totalBets++;
      } catch (e) {
        console.error(`  ⚠️  Bet insert error (${b.id}):`, e.message);
      }
    }

    // Compute recap stats
    const netUnits = calcNetUnits(betsForDay);
    const totalUnitsRisked = betsForDay.reduce((a, b) => a + b.units, 0);
    const roi = totalUnitsRisked > 0 ? parseFloat(((netUnits / totalUnitsRisked) * 100).toFixed(1)) : 0;
    const lb = leagueBreakdown(betsForDay);

    // Upsert daily_recap
    try {
      await pool.query(`
        INSERT INTO daily_recaps (user_id, date, wins, losses, pushes, net_units, roi, league_breakdown)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, date) DO UPDATE SET
          wins = EXCLUDED.wins, losses = EXCLUDED.losses, pushes = EXCLUDED.pushes,
          net_units = EXCLUDED.net_units, roi = EXCLUDED.roi, league_breakdown = EXCLUDED.league_breakdown,
          created_at = now()
      `, [user.id, slateDate, wins, losses, pushes, netUnits, roi, JSON.stringify(lb)]);
      totalRecaps++;
    } catch (e) {
      console.error(`  ⚠️  Recap insert error (${slateDate}):`, e.message);
    }

    const sign = netUnits >= 0 ? '+' : '';
    console.log(`  ${slateDate}  ${wins}W-${losses}L-${pushes}P  ${sign}${netUnits}u`);
  }

  console.log(`\n✅ Done! Inserted ${totalBets} bets and ${totalRecaps} daily recaps.`);
  console.log('   Open the Calendar tab and navigate to the current month to see the data.\n');
  await pool.end();
}

seed().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
