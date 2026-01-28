import db from './database.js';

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
      
      const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
      
      const bets = db.prepare(`
        SELECT * FROM bets 
        WHERE autoPost = 1 AND isPosted = 0
      `).all();
      
      for (const bet of bets) {
        const postTime = bet.customScheduleTime 
          ? bet.customScheduleTime 
          : (bet.matchTimestamp ? bet.matchTimestamp - (settings.scheduleOffsetMinutes * 60 * 1000) : null);
        
        if (postTime) {
          const timeDiff = now - postTime;
          const fiveMinutesInMs = 5 * 60 * 1000;
          
          if (timeDiff > fiveMinutesInMs) {
            console.log(`⚠️ Skipping bet scheduled in the past: ${bet.playerA} vs ${bet.playerB} (scheduled ${Math.round(timeDiff / 60000)} mins ago)`);
            db.prepare('UPDATE bets SET autoPost = 0 WHERE id = ?').run(bet.id);
            continue;
          }

          if (now >= postTime) {
            console.log(`🔔 Auto-posting bet: ${bet.playerA} vs ${bet.playerB}`);
            const success = await postToDiscord(bet, settings);
            
            if (success) {
              db.prepare('UPDATE bets SET isPosted = 1, autoPost = 0 WHERE id = ?').run(bet.id);
              console.log(`✅ Successfully posted: ${bet.playerA} vs ${bet.playerB}`);
            } else {
              console.log(`❌ Failed to post: ${bet.playerA} vs ${bet.playerB}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 10000);
};
