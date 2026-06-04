import pool from './database.js';

// Per-webhook rate-limit tracking (keyed by webhook URL)
const webhookLastPost = new Map();   // url → timestamp of last successful post
const webhookRetryAfter = new Map(); // url → timestamp when rate limit expires

const MIN_POST_INTERVAL_MS = 1500; // minimum 1.5s between posts to the same webhook

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const resolveMentionContent = (league, settings) => {
  const roles = settings.mentionRoles || [];
  const mappings = settings.leagueRoleMappings || [];
  const leagueMapping = mappings.find(m => m.league === league);
  let selectedRoles;
  if (leagueMapping) {
    selectedRoles = [{ id: leagueMapping.roleId, name: leagueMapping.roleName }];
  } else if (roles.length > 0) {
    selectedRoles = roles;
  } else {
    // Fallback to legacy mentionString
    let content = settings.mentionString || '';
    if (content && /^\d+$/.test(content.trim())) {
      content = `<@&${content.trim()}>`;
    }
    const roleIds = [];
    for (const m of content.matchAll(/<@&(\d+)>/g)) {
      roleIds.push(m[1]);
    }
    return { content, roleIds };
  }
  return {
    content: selectedRoles.map(r => `<@&${r.id}>`).join(' '),
    roleIds: selectedRoles.map(r => r.id)
  };
};

const postToDiscord = async (bet, settings) => {
  if (!settings.discordWebhookUrl) return false;

  const url = settings.discordWebhookUrl;

  // Honour Discord retry_after backoff
  const retryAfter = webhookRetryAfter.get(url);
  if (retryAfter && Date.now() < retryAfter) {
    console.log(`⏳ Webhook rate-limited, skipping until ${new Date(retryAfter).toISOString()}`);
    return false;
  }

  const { content: mentionContent, roleIds } = resolveMentionContent(bet.league, settings);

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

const postMessageToDiscord = async (msg, settings) => {
  const url = settings.discordWebhookUrl;
  if (!url) return false;

  const retryAfter = webhookRetryAfter.get(url);
  if (retryAfter && Date.now() < retryAfter) {
    console.log(`⏳ Webhook rate-limited for scheduled message`);
    return false;
  }

  const roleMentions = msg.role_mentions || [];
  const pingContent = roleMentions.map(r => `<@&${r.id}>`).join(' ');
  const roleIds = roleMentions.map(r => r.id);

  const textContent = [pingContent, msg.content].filter(Boolean).join('\n');

  const basePayload = {
    username: settings.botName || 'AI BetSlate Automator',
    ...(settings.botAvatarUrl ? { avatar_url: settings.botAvatarUrl } : {}),
    ...(textContent ? { content: textContent } : {}),
    allowed_mentions: {
      parse: roleIds.length > 0 ? [] : ['users', 'roles', 'everyone'],
      roles: roleIds
    }
  };

  // Add embed if there's a title or image URL
  if (msg.embed_title || (msg.image_url && !msg.image_data)) {
    const embed = { color: msg.embed_color || 16731469 };
    if (msg.embed_title) embed.title = msg.embed_title;
    if (msg.image_url) embed.image = { url: msg.image_url };
    basePayload.embeds = [embed];
  }

  try {
    let response;
    if (msg.image_data) {
      // Send as multipart form with base64 image attachment
      const buffer = Buffer.from(msg.image_data, 'base64');
      const { FormData, Blob } = await import('node:buffer');
      const formData = new FormData();
      const blob = new Blob([buffer]);
      const filename = msg.image_filename || 'image.png';
      formData.append('files[0]', blob, filename);
      if (msg.image_url === '' && basePayload.embeds) {
        // Point the embed's image at the uploaded attachment
        basePayload.embeds[0] = { ...(basePayload.embeds[0] || {}), image: { url: `attachment://${filename}` } };
      } else if (!basePayload.embeds) {
        basePayload.embeds = [{ color: msg.embed_color || 16731469, image: { url: `attachment://${filename}` } }];
        if (msg.embed_title) basePayload.embeds[0].title = msg.embed_title;
      }
      formData.append('payload_json', JSON.stringify(basePayload));
      response = await fetch(url, { method: 'POST', body: formData });
    } else {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload)
      });
    }

    if (response.status === 429) {
      let retryMs = 5000;
      try {
        const body = await response.json();
        retryMs = Math.ceil((body.retry_after || 5) * 1000);
      } catch { /* ignore */ }
      webhookRetryAfter.set(url, Date.now() + retryMs);
      console.warn(`⚠️  Discord rate limit hit for scheduled message. Retry after ${retryMs}ms`);
      return false;
    }

    webhookLastPost.set(url, Date.now());
    webhookRetryAfter.delete(url);
    return response.ok;
  } catch (e) {
    console.error('Discord Message Webhook Error:', e);
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
          s."defaultBetAlertTitle", s."betEmbedColor",
          s.mention_roles AS "mentionRoles",
          s.league_role_mappings AS "leagueRoleMappings"
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

            console.log(`🔔 Auto-posting bet: ${row.playerA} vs ${row.playerB}`);
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

      // ── Scheduled messages ───────────────────────────────────────────────
      const msgResult = await pool.query(`
        SELECT sm.*,
          s."discordWebhookUrl", s."botName", s."botAvatarUrl"
        FROM scheduled_messages sm
        LEFT JOIN settings s ON sm.bot_id = s.bot_id
        WHERE sm.is_sent = false AND sm.scheduled_time::bigint <= $1
      `, [String(now)]);

      for (const msg of msgResult.rows) {
        const webhookUrl = msg.discordWebhookUrl;
        if (webhookUrl) {
          const lastPost = webhookLastPost.get(webhookUrl) || 0;
          if (now - lastPost < MIN_POST_INTERVAL_MS) continue;
        }

        console.log(`📨 Auto-posting scheduled message: ${msg.id}`);
        const success = await postMessageToDiscord(msg, msg);

        if (success) {
          await pool.query('UPDATE scheduled_messages SET is_sent = true WHERE id = $1', [msg.id]);
          console.log(`✅ Message sent: ${msg.id}`);
        } else {
          console.log(`❌ Failed to send message: ${msg.id}`);
        }

        await sleep(200);
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 10000);
};

