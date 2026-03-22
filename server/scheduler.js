import pool from './database.js';

const postToDiscord = async (bet, settings) => {
  if (!settings.discordWebhookUrl) return false;

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
    const response = await fetch(settings.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
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

      const result = await pool.query(`
        SELECT b.*, 
          s."discordWebhookUrl", s."botName", s."botAvatarUrl", s."mentionString",
          s."scheduleOffsetMinutes", s."slateTimezone", s."defaultOdds",
          s."defaultBetAlertTitle", s."betEmbedColor"
        FROM bets b
        LEFT JOIN settings s ON b.user_id = s.user_id
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
            console.log(`🔔 Auto-posting bet: ${row.playerA} vs ${row.playerB}`);
            const success = await postToDiscord(row, row);

            if (success) {
              await pool.query('UPDATE bets SET "isPosted" = true, "autoPost" = false WHERE id = $1', [row.id]);
              console.log(`✅ Successfully posted: ${row.playerA} vs ${row.playerB}`);
            } else {
              console.log(`❌ Failed to post: ${row.playerA} vs ${row.playerB}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 10000);
};

