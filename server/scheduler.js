import pool from './database.js';

// Per-webhook rate-limit tracking (keyed by webhook URL)
const webhookLastPost = new Map();   // url → timestamp of last successful post
const webhookRetryAfter = new Map(); // url → timestamp when rate limit expires

const MIN_POST_INTERVAL_MS = 1500; // minimum 1.5s between posts to the same webhook

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const postToDiscord = async (bet, settings) => {
  if (!settings.discordWebhookUrl) return false;

  const url = settings.discordWebhookUrl;

  // Honour Discord retry_after backoff
  const retryAfter = webhookRetryAfter.get(url);
  if (retryAfter && Date.now() < retryAfter) {
    console.log(`⏳ Webhook rate-limited, skipping until ${new Date(retryAfter).toISOString()}`);
    return false;
  }

  let mentionContent = settings.mentionString || "";
  if (mentionContent && /^\d+$/.test(mentionContent.trim())) {
    mentionContent = `<@&${mentionContent.trim()}>`;
  }

  const roleIds = [];
  const roleMatches = mentionContent.matchAll(/<@&(\d+)>/g);
  for (const match of roleMatches) {
    roleIds.push(match[1]);
  }

  const payload = {
    username: settings.botName || "AI BetSlate Automator",
    avatar_url: settings.botAvatarUrl || undefined,
    content: mentionContent,
    allowed_mentions: {
      parse: roleIds.length > 0 ? [] : ["users", "roles"],
      roles: roleIds
    },
    embeds: [
      {
        title: bet.customTitle || settings.defaultBetAlertTitle || "📢 Bet Alert",
        color: settings.betEmbedColor || 16731469,
        fields: [
          { name: "Match", value: `${bet.playerA} vs ${bet.playerB}`, inline: false },
          { name: "Type", value: bet.type, inline: true },
          { name: "Units", value: `${bet.units}u (${bet.odds || settings.defaultOdds})`, inline: true },
          { name: "League", value: bet.league, inline: true },
          { name: "Start Time", value: `${bet.time} EST`, inline: false }
        ]
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 429) {
      let retryMs = 5000;
      try {
        const body = await response.json();
        retryMs = Math.ceil((body.retry_after || 5) * 1000);
      } catch { /* ignore parse errors */ }
      webhookRetryAfter.set(url, Date.now() + retryMs);
      console.warn(`⚠️  Discord rate limit hit for webhook. Retry after ${retryMs}ms`);
      return false;
    }

    webhookLastPost.set(url, Date.now());
    webhookRetryAfter.delete(url);
    return response.ok;
  } catch (e) {
    console.error("Discord Webhook Error:", e);
    return false;
  }
};

export const startScheduler = () => {
  setInterval(async () => {
    try {
      const now = Date.now();

      // Join through bot_id so each bot uses its own settings
      const result = await pool.query(`
        SELECT b.*, 
          s."discordWebhookUrl", s."botName", s."botAvatarUrl", s."mentionString",
          s."scheduleOffsetMinutes", s."slateTimezone", s."defaultOdds",
          s."defaultBetAlertTitle", s."betEmbedColor"
        FROM bets b
        LEFT JOIN settings s ON b.bot_id = s.bot_id
        WHERE b."autoPost" = true AND b."isPosted" = false
      `);

      for (const row of result.rows) {
        const scheduleOffsetMs = (row.scheduleOffsetMinutes || 15) * 60 * 1000;
        const postTime = row.customScheduleTime
          ? Number(row.customScheduleTime)
          : (row.matchTimestamp ? Number(row.matchTimestamp) - scheduleOffsetMs : null);

        if (postTime) {
          const timeDiff = now - postTime;
          const fiveMinutesInMs = 5 * 60 * 1000;

          if (timeDiff > fiveMinutesInMs) {
            console.log(`⚠️ Skipping bet scheduled in the past: ${row.playerA} vs ${row.playerB}`);
            await pool.query('UPDATE bets SET "autoPost" = false WHERE id = $1', [row.id]);
            continue;
          }

          if (now >= postTime) {
            // Enforce minimum inter-post interval per webhook to avoid rate limits
            const webhookUrl = row.discordWebhookUrl;
            if (webhookUrl) {
              const lastPost = webhookLastPost.get(webhookUrl) || 0;
              if (now - lastPost < MIN_POST_INTERVAL_MS) {
                // Too soon — skip this tick, will retry on next scheduler run
                continue;
              }
            }

            console.log(`🔔 Auto-posting bet: ${row.playerA} vs ${row.playerB} | id=${row.id} | bot_id=${row.bot_id} | webhook=${row.discordWebhookUrl}`);
            const success = await postToDiscord(row, row);

            if (success) {
              await pool.query('UPDATE bets SET "isPosted" = true, "autoPost" = false WHERE id = $1', [row.id]);
              console.log(`✅ Successfully posted: ${row.playerA} vs ${row.playerB}`);
            } else {
              console.log(`❌ Failed to post: ${row.playerA} vs ${row.playerB}`);
            }

            // Small delay between consecutive posts in the same scheduler tick
            await sleep(200);
          }
        }
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 10000);
};

