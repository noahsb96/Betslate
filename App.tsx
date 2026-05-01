
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Settings, RefreshCw, Trash, Plus, Calendar, Clock, Layers, FileText, X, LogOut, UserCircle, RotateCcw, Bot, Pencil, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Uploader from './components/Uploader';
import BetCard from './components/BetCard';
import StatsOverview from './components/StatsOverview';
import CalendarView from './components/Calendar';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import VerifyEmailPage from './components/auth/VerifyEmailPage';
import AccountPage from './components/auth/AccountPage';
import ConfirmEmailChangePage from './components/auth/ConfirmEmailChangePage';
import { analyzeSlateImage } from './services/geminiService';
import { betsAPI, settingsAPI, botsAPI } from './services/api';
import { authAPI, getToken, clearToken } from './services/authAPI';
import { Bet, BetResult, AppSettings, User, Bot as BotType } from './types';

const DEFAULT_SETTINGS: AppSettings = {
    mentionString: '@Chefs Plays',
    discordWebhookUrl: '',
    recapWebhookUrl: '',
    botName: 'AI BetSlate Automator',
    botAvatarUrl: '',
    scheduleOffsetMinutes: 15,
    slateTimezone: 'America/New_York',
    defaultOdds: '-120',
    recapTitle: 'Daily Recap',
    recapIncludeDate: true,
    recapIncludeRecord: true,
    recapIncludeNetUnits: true,
    recapIncludeROI: true,
    recapIncludeLeagueStats: false,
    defaultBetAlertTitle: '📢 Bet Alert',
    betEmbedColor: 16731469,
    recapEmbedColor: 16731469,
    aiInstructions: `You are an expert sports betting assistant specialized in Table Tennis.
Your task is to analyze an image of a betting slate and extract the structured betting data.

The image typically contains rows with:
1. Time (e.g., 1:45 p.m.)
2. Player Names (Two players)
3. Bet Type (Usually "UNDER", "OVER", or "SPLIT"). 
4. Indicators of confidence/units (Hammers, Stars, Nuclear symbols).

CRITICAL RULES:
1. **Units**: 
   - Hammer icon = **1.5** units.
   - Nuclear/Radioactive icon = **3** units.
   - Star or no icon = **1** unit.
2. **Bet Type**: 
   - If the text explicitly says "UNDER", "OVER", or "SPLIT", use that.
   - **IMPORTANT**: If NO bet type text is found next to the players, assume the bet is **"OVER"**.
3. **League**:
   - Extract the league header.
   - **CLEANING**: If the league starts with "International: ", remove "International: ". (e.g., "International: TT Elite Series" -> "TT Elite Series").
   - If "Czech: Czech Liga Pro" -> "Czech Liga Pro".
   - **ALLOWED LEAGUES**: Only use one of these 4 leagues: "Czech Liga Pro", "TT Elite Series", "TT Cup", "Setka Cup".
   - **DEFAULT**: If the league cannot be determined or doesn't match one of the 4 allowed leagues, use "TT Elite Series".`
};

const MainApp: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<string>('');
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'calendar'>('queue');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'won' | 'lost' | 'push'>('all');
  const [slateDate, setSlateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [restoredDate, setRestoredDate] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [scrollToBetId, setScrollToBetId] = useState<string | null>(null);

  // ── Multi-bot state ──────────────────────────────────────────────────────
  const [bots, setBots] = useState<BotType[]>([]);
  const [activeBot, setActiveBot] = useState<BotType | null>(null);
  const [renamingBotId, setRenamingBotId] = useState<string | null>(null);
  const [renamingBotName, setRenamingBotName] = useState<string>('');
  const [newBotName, setNewBotName] = useState<string>('');
  const [showNewBotInput, setShowNewBotInput] = useState(false);
  const renamingInputRef = useRef<HTMLInputElement>(null);
  // Prevents the settings auto-save from firing while we're loading settings
  // for a different bot (which would overwrite the old bot's settings row).
  const isLoadingSettings = useRef(false);

  useEffect(() => {
     const loadData = async () => {
       try {
         // Load bots first; create Bot 1 if the user has none
         let botList: BotType[] = await botsAPI.getAll();
         if (botList.length === 0) {
           const newBot = await botsAPI.create('Bot 1');
           botList = [newBot];
         }
         setBots(botList);
         const bot = botList[0];
         setActiveBot(bot);

         const [betsData, settingsData] = await Promise.all([
           betsAPI.getAll(bot.id),
           settingsAPI.get(bot.id)
         ]);
         setBets(betsData);
         isLoadingSettings.current = true;
         setAppSettings(settingsData);
       } catch (err) {
         console.error('Failed to load data:', err);
       }
       
       const envApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
       if (envApiKey) setApiKey(envApiKey);
     };
     loadData();
  }, []);

  useEffect(() => {
    const saveSettings = async () => {
      // If settings were just loaded (not user-modified), skip saving
      if (isLoadingSettings.current) {
        isLoadingSettings.current = false;
        return;
      }
      if (appSettings !== DEFAULT_SETTINGS && activeBot) {
        try {
          await settingsAPI.update(activeBot.id, appSettings);
        } catch (err) {
          console.error('Failed to save settings:', err);
        }
      }
    };
    saveSettings();
  }, [appSettings]);

  useEffect(() => {
    if (!activeBot) return;
    const pollBets = async () => {
      try {
        const betsData = await betsAPI.getAll(activeBot.id);
        setBets(prev => {
          // Keep any locally-added bets created in the last 30s that the server
          // hasn't acknowledged yet (race between optimistic add and poll).
          const serverIds = new Set(betsData.map((b: Bet) => b.id));
          const recentLocalOnly = prev.filter(
            b => !serverIds.has(b.id) && (Date.now() - Number(b.timestamp)) < 30000
          );
          return [...recentLocalOnly, ...betsData];
        });
      } catch (err) {
        console.error('Failed to refresh bets:', err);
      }
    };

    const intervalId = setInterval(pollBets, 10000);

    return () => clearInterval(intervalId);
  }, [activeBot]);

  useEffect(() => {
    if (scrollToBetId) {
      setTimeout(() => {
        const element = document.getElementById(`bet-${scrollToBetId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setScrollToBetId(null);
      }, 50);
    }
  }, [scrollToBetId]);

  const parseMatchTime = (timeString: string, dateStr: string, timezone: string): number | undefined => {
    try {
      let cleanTime = timeString.toLowerCase().replace(/\./g, '').trim(); 
      const timeRegex = /(\d{1,2}):(\d{2})\s*(am|pm)?/;
      const match = cleanTime.match(timeRegex);
      if (!match) return undefined;
      
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const meridian = match[3];
      if (meridian === 'pm' && hours < 12) hours += 12;
      if (meridian === 'am' && hours === 12) hours = 0;

      const [year, month, day] = dateStr.split('-').map(Number);

      // Build a naive UTC timestamp as if the local time were UTC, then use
      // Intl.DateTimeFormat to find out what that UTC instant looks like in the
      // target IANA timezone. The difference gives the true UTC offset for that
      // date (including DST), so we can compute the correct UTC timestamp without
      // any hardcoded, DST-unaware offset tables.
      const naiveUTC = Date.UTC(year, month - 1, day, hours, minutes, 0);

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const parts = Object.fromEntries(
        formatter.formatToParts(new Date(naiveUTC)).map(p => [p.type, p.value])
      );

      const displayedH = parseInt(parts.hour) % 24; // normalize 24:xx → 0:xx
      const displayedUTC = Date.UTC(
        parseInt(parts.year),
        parseInt(parts.month) - 1,
        parseInt(parts.day),
        displayedH,
        parseInt(parts.minute),
        parseInt(parts.second),
      );

      // naiveUTC - displayedUTC is the timezone's UTC offset in ms for this date.
      return naiveUTC + (naiveUTC - displayedUTC);
    } catch (e) {
      console.error('Error parsing match time:', e);
      return undefined;
    }
  };

  const handleImageUpload = async (base64: string) => {
    if (!apiKey) {
      setError("Please set your Gemini API Key in settings first.");
      setShowSettings(true);
      return;
    }
    if (!activeBot) return;
    
    console.log('Using API Key:', apiKey?.substring(0, 10) + '...');
    setLoading(true);
    setError(null);
    
    try {
        const newBetsRaw = await analyzeSlateImage(base64, apiKey, appSettings.aiInstructions);
        const processedBets = newBetsRaw.map(b => ({
            ...b,
            botId: activeBot.id,
            slateDate,
            matchTimestamp: parseMatchTime(b.time, slateDate, appSettings.slateTimezone),
            autoPost: false,
            isPosted: false
        }));
        for (const bet of processedBets) {
          await betsAPI.create(bet);
        }
        setBets(prev => [...processedBets, ...prev]);
    } catch (err: any) {
      console.error('Image analysis error:', err);
      const errorMsg = err?.message || err?.toString() || "Failed to analyze image. Please try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBet = async (id: string, updates: Partial<Bet>, shouldScroll = false) => {
    await betsAPI.update(id, updates);
    setBets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    if (shouldScroll) {
      setScrollToBetId(id);
    }
  };

  const handleDeleteBet = async (id: string) => {
    await betsAPI.delete(id);
    setBets(prev => prev.filter(b => b.id !== id));
  };

  const handleCopyBet = async (bet: Bet) => {
    const copiedBet: Bet = {
      ...bet,
      id: uuidv4(),
      timestamp: Date.now(),
      autoPost: false,
      isPosted: false,
      result: BetResult.PENDING,
      customScheduleTime: undefined,
      slateDate: slateDate,
    };
    // Optimistic add — appears instantly, before server round-trip
    setBets(prev => [copiedBet, ...prev]);
    setScrollToBetId(copiedBet.id);
    try {
      await betsAPI.create({ ...copiedBet, botId: activeBot?.id });
    } catch {
      // Revert if save failed
      setBets(prev => prev.filter(b => b.id !== copiedBet.id));
    }
  };

  // Copy within history/recap — stays posted with the original slateDate
  const handleCopyBetToHistory = async (bet: Bet) => {
    const copiedBet: Bet = {
      ...bet,
      id: uuidv4(),
      timestamp: Date.now(),
      autoPost: false,
      isPosted: true,
      result: BetResult.PENDING,
      customScheduleTime: undefined,
    };
    setBets(prev => [copiedBet, ...prev]);
    try {
      await betsAPI.create({ ...copiedBet, botId: activeBot?.id });
    } catch {
      setBets(prev => prev.filter(b => b.id !== copiedBet.id));
    }
  };

  const clearAllBets = async () => {
    if (window.confirm(`Clear all bets in the queue? This cannot be undone.`)) {
      await betsAPI.clearAll(undefined, activeBot?.id);
      setBets([]);
    }
  };
  
  const handleManualAdd = async () => {
     if (!activeBot) return;
     const newBet: Bet = {
         id: uuidv4(),
         botId: activeBot.id,
         league: 'Manual Entry',
         playerA: 'Player A',
         playerB: 'Player B',
         time: '12:00 PM',
         type: 'OVER',
         units: 1,
         result: BetResult.PENDING,
         timestamp: Date.now(),
         slateDate,
         autoPost: false,
         isPosted: false,
         matchTimestamp: parseMatchTime('12:00 PM', slateDate, appSettings.slateTimezone)
     };
     setBets(prev => [newBet, ...prev]);
     try {
       await betsAPI.create(newBet);
     } catch {
       setBets(prev => prev.filter(b => b.id !== newBet.id));
     }
  };

  const handleManualAddPosted = async () => {
     if (!activeBot) return;
     const newBet: Bet = {
         id: uuidv4(),
         botId: activeBot.id,
         league: 'Manual Entry',
         playerA: 'Player A',
         playerB: 'Player B',
         time: '12:00 PM',
         type: 'OVER',
         units: 1,
         result: BetResult.PENDING,
         timestamp: Date.now(),
         slateDate,
         autoPost: false,
         isPosted: true,
         matchTimestamp: parseMatchTime('12:00 PM', slateDate, appSettings.slateTimezone)
     };
     setBets(prev => [newBet, ...prev]);
     setScrollToBetId(newBet.id);
     try {
       await betsAPI.create(newBet);
     } catch {
       setBets(prev => prev.filter(b => b.id !== newBet.id));
     }
  };

  const handleScheduleAll = async () => {
    const confirm = window.confirm(`Schedule all queued bets to auto-post ${appSettings.scheduleOffsetMinutes} mins before start?`);
    if (confirm) {
      const now = Date.now();
      const updatePromises: Promise<void>[] = [];
      let skippedCount = 0;
      
      setBets(prev => prev.map(b => {
        if (!b.isPosted && b.matchTimestamp) {
          const scheduleTime = b.matchTimestamp - (appSettings.scheduleOffsetMinutes * 60000);
          
          // Only schedule if the scheduled time is in the future
          if (scheduleTime > now) {
            updatePromises.push(betsAPI.update(b.id, { autoPost: true }));
            return { ...b, autoPost: true };
          } else {
            skippedCount++;
          }
        }
        return b;
      }));
      
      await Promise.all(updatePromises);
      
      if (skippedCount > 0) {
        alert(`Scheduled ${updatePromises.length} bet${updatePromises.length !== 1 ? 's' : ''}. Skipped ${skippedCount} bet${skippedCount !== 1 ? 's' : ''} scheduled in the past.`);
      }
    }
  };

  const handlePostToDiscord = async (bet: Bet): Promise<boolean> => {
    if (!appSettings.discordWebhookUrl) {
      console.error('Discord webhook URL not configured');
      return false;
    }

    let mentionContent = appSettings.mentionString || "";
    if (mentionContent && /^\d+$/.test(mentionContent.trim())) {
      mentionContent = `<@&${mentionContent.trim()}>`;
    }

    const roleIds: string[] = [];
    const roleMatches = mentionContent.matchAll(/<@&(\d+)>/g);
    for (const match of roleMatches) {
      roleIds.push(match[1]);
    }

    const payload = {
      username: appSettings.botName || "AI BetSlate Automator",
      avatar_url: appSettings.botAvatarUrl || undefined,
      content: mentionContent,
      allowed_mentions: { 
        parse: roleIds.length > 0 ? [] : ["users", "roles"],
        roles: roleIds
      }, 
      embeds: [
        {
          title: bet.customTitle || appSettings.defaultBetAlertTitle,
          color: appSettings.betEmbedColor, 
          fields: [
            { name: "Match", value: `${bet.playerA} vs ${bet.playerB}`, inline: false },
            { name: "Type", value: bet.type, inline: true },
            { name: "Units", value: `${bet.units}u (${bet.odds || appSettings.defaultOdds})`, inline: true },
            { name: "League", value: bet.league, inline: true },
            { name: "Start Time", value: `${bet.time} EST`, inline: false }
          ]
        }
      ]
    };

    try {
      const response = await fetch(appSettings.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        await betsAPI.update(bet.id, { isPosted: true });
        setBets(prev => prev.map(b => b.id === bet.id ? { ...b, isPosted: true } : b));
        return true;
      }
      return false;
    } catch (e) {
      console.error("Discord Webhook Error:", e);
      return false;
    }
  };

  // ── Bot management handlers ──────────────────────────────────────────────
  const handleSwitchBot = async (bot: BotType) => {
    if (bot.id === activeBot?.id) return;
    setActiveBot(bot);
    try {
      const [betsData, settingsData] = await Promise.all([
        betsAPI.getAll(bot.id),
        settingsAPI.get(bot.id)
      ]);
      setBets(betsData);
      isLoadingSettings.current = true;
      setAppSettings(settingsData);
    } catch (err) {
      console.error('Failed to load bot data:', err);
    }
  };

  const handleCreateBot = async () => {
    const name = newBotName.trim();
    if (!name) return;
    try {
      const newBot = await botsAPI.create(name);
      const updatedBots = [...bots, newBot];
      setBots(updatedBots);
      setNewBotName('');
      setShowNewBotInput(false);
      await handleSwitchBot(newBot);
    } catch (err) {
      console.error('Failed to create bot:', err);
    }
  };

  const handleRenameBot = async (botId: string) => {
    const name = renamingBotName.trim();
    if (!name) { setRenamingBotId(null); return; }
    try {
      const updated = await botsAPI.rename(botId, name);
      setBots(prev => prev.map(b => b.id === botId ? updated : b));
      if (activeBot?.id === botId) setActiveBot(updated);
    } catch (err) {
      console.error('Failed to rename bot:', err);
    } finally {
      setRenamingBotId(null);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!window.confirm('Delete this bot and all its bets and recaps? This cannot be undone.')) return;
    try {
      await botsAPI.delete(botId);
      const updatedBots = bots.filter(b => b.id !== botId);
      setBots(updatedBots);
      if (activeBot?.id === botId && updatedBots.length > 0) {
        await handleSwitchBot(updatedBots[0]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete bot');
    }
  };

  const queueBets = bets.filter(b => !b.isPosted).sort((a, b) => {
    const timeA = a.customScheduleTime || (a.matchTimestamp ? a.matchTimestamp - (appSettings.scheduleOffsetMinutes * 60000) : 0);
    const timeB = b.customScheduleTime || (b.matchTimestamp ? b.matchTimestamp - (appSettings.scheduleOffsetMinutes * 60000) : 0);
    return timeA - timeB;
  });
  const historyBets = bets
    .filter(b => b.isPosted && b.slateDate === slateDate)
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  const filteredHistoryBets = historyBets.filter(bet => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'pending') return bet.result === BetResult.PENDING;
    if (historyFilter === 'won') return bet.result === BetResult.WIN;
    if (historyFilter === 'lost') return bet.result === BetResult.LOSS;
    if (historyFilter === 'push') return bet.result === BetResult.PUSH;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#36393f] font-sans text-gray-100 pb-20">
      <header className="bg-[#202225] p-4 shadow-md sticky top-0 z-50 border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/50">
                BS
             </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">BetSlate AI Automator</h1>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
            <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                title="Settings"
            >
                <Settings size={20} />
            </button>
            <button
                onClick={() => navigate('/account')}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                title="Account settings"
            >
                <UserCircle size={20} />
            </button>
            <button
                onClick={onLogout}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-full transition-colors"
                title="Sign out"
            >
                <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* ── Bot selector tabs ─────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto mt-3 flex items-center gap-1 overflow-x-auto pb-1">
          {bots.map(bot => (
            <div key={bot.id} className="flex-shrink-0 flex items-center group">
              {renamingBotId === bot.id ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={renamingInputRef}
                    value={renamingBotName}
                    onChange={e => setRenamingBotName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameBot(bot.id);
                      if (e.key === 'Escape') setRenamingBotId(null);
                    }}
                    className="bg-[#40444b] border border-indigo-500 rounded px-2 py-1 text-xs text-white w-24 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRenameBot(bot.id)}
                    className="p-1 text-green-400 hover:text-green-200"
                  ><Check size={12} /></button>
                </div>
              ) : (
                <button
                  onClick={() => handleSwitchBot(bot)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                    activeBot?.id === bot.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#2f3136] text-gray-400 hover:text-white hover:bg-[#40444b]'
                  }`}
                >
                  <Bot size={12} />
                  {bot.name}
                </button>
              )}
              {/* Per-bot action icons (shown on hover) */}
              {renamingBotId !== bot.id && (
                <div className="hidden group-hover:flex items-center ml-0.5 gap-0.5">
                  <button
                    onClick={() => {
                      setRenamingBotId(bot.id);
                      setRenamingBotName(bot.name);
                      setTimeout(() => renamingInputRef.current?.focus(), 0);
                    }}
                    className="p-1 text-gray-500 hover:text-gray-200 transition-colors"
                    title="Rename bot"
                  ><Pencil size={10} /></button>
                  {bots.length > 1 && (
                    <button
                      onClick={() => handleDeleteBot(bot.id)}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                      title="Delete bot"
                    ><Trash size={10} /></button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add new bot */}
          {showNewBotInput ? (
            <div className="flex-shrink-0 flex items-center gap-1">
              <input
                value={newBotName}
                onChange={e => setNewBotName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateBot();
                  if (e.key === 'Escape') { setShowNewBotInput(false); setNewBotName(''); }
                }}
                placeholder="Bot name"
                className="bg-[#40444b] border border-gray-600 rounded px-2 py-1 text-xs text-white w-24 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <button onClick={handleCreateBot} className="p-1 text-green-400 hover:text-green-200"><Check size={12} /></button>
              <button onClick={() => { setShowNewBotInput(false); setNewBotName(''); }} className="p-1 text-gray-500 hover:text-white"><X size={12} /></button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewBotInput(true)}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:text-white hover:bg-[#40444b] transition-colors"
              title="Add new bot"
            >
              <Plus size={12} /> Add Bot
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        
        {showSettings && (
          <div className="bg-[#2f3136] rounded-lg p-4 md:p-6 mb-8 border border-gray-700 shadow-xl animate-fade-in relative z-50 max-w-full overflow-x-hidden">
             <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20}/></button>
            <h3 className="text-lg font-bold mb-1 flex items-center border-b border-gray-700 pb-2">
              <Settings size={18} className="mr-2" /> Settings
              {activeBot && <span className="ml-2 text-sm font-normal text-indigo-400">— {activeBot.name}</span>}
            </h3>
            <div className="space-y-4">
               
               <div>
                 <label className="block text-sm text-gray-400 mb-1">Bot Display Name</label>
                 <input 
                   type="text" 
                   value={appSettings.botName}
                   onChange={(e) => setAppSettings({...appSettings, botName: e.target.value})}
                   placeholder="AI BetSlate Automator"
                   className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                 />
                 <p className="text-xs text-gray-500 mt-1">Name shown in Discord messages and bet cards</p>
               </div>

               <div>
                 <label className="block text-sm text-gray-400 mb-1">Role to Mention (Role ID)</label>
                 <input 
                   type="text" 
                   value={appSettings.mentionString}
                   onChange={(e) => setAppSettings({...appSettings, mentionString: e.target.value})}
                   placeholder="1456488731832750141"
                   className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                 />
                 <p className="text-xs text-gray-500 mt-1">Right-click role → Copy Role ID in Discord</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                   <label className="block text-sm text-gray-400 mb-1">Slate Timezone</label>
                    <select 
                      value={appSettings.slateTimezone}
                      onChange={(e) => setAppSettings({...appSettings, slateTimezone: e.target.value})}
                      className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="America/New_York">Eastern (EST)</option>
                      <option value="America/Chicago">Central (CST)</option>
                      <option value="America/Denver">Mountain (MST)</option>
                      <option value="America/Los_Angeles">Pacific (PST)</option>
                    </select>
                 </div>
                 <div>
                   <label className="block text-sm text-gray-400 mb-1">Default Odds</label>
                   <input 
                     type="text" 
                     value={appSettings.defaultOdds}
                     onChange={(e) => setAppSettings({...appSettings, defaultOdds: e.target.value})}
                     className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                   />
                 </div>
                 <div>
                   <label className="block text-sm text-gray-400 mb-1">Schedule Offset</label>
                   <div className="flex items-center space-x-2">
                     <input 
                       type="number" 
                       value={appSettings.scheduleOffsetMinutes}
                       onChange={(e) => setAppSettings({...appSettings, scheduleOffsetMinutes: parseInt(e.target.value) || 0})}
                       className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                     />
                   </div>
                 </div>
               </div>

               <div>
                 <label className="block text-sm text-gray-400 mb-1">Discord Webhook URL (Plays)</label>
                 <input 
                   type="text" 
                   value={appSettings.discordWebhookUrl}
                   onChange={(e) => setAppSettings({...appSettings, discordWebhookUrl: e.target.value})}
                   className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                 />
               </div>

               <div>
                 <label className="block text-sm text-gray-400 mb-1">Discord Webhook URL (Recaps - Optional)</label>
                 <input 
                   type="text" 
                   value={appSettings.recapWebhookUrl}
                   onChange={(e) => setAppSettings({...appSettings, recapWebhookUrl: e.target.value})}
                   placeholder="Leave empty to use main webhook"
                   className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                 />
               </div>

               <div>
                 <label className="block text-sm text-gray-400 mb-1">AI Analysis Instructions</label>
                 <textarea 
                   value={appSettings.aiInstructions}
                   onChange={(e) => setAppSettings({...appSettings, aiInstructions: e.target.value})}
                   rows={12}
                   placeholder="Enter custom instructions for AI image analysis..."
                   className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
                 />
                 <p className="text-xs text-gray-500 mt-1">Customize how the AI analyzes betting slates</p>
               </div>

               <div className="border-t border-gray-700 pt-4 mt-2">
                 <h3 className="text-sm font-semibold text-gray-300 mb-3">Discord Message Customization</h3>
                 
                 <div className="space-y-4">
                   <div>
                     <label className="block text-sm text-gray-400 mb-1">Default Bet Alert Title</label>
                     <input 
                       type="text" 
                       value={appSettings.defaultBetAlertTitle}
                       onChange={(e) => setAppSettings({...appSettings, defaultBetAlertTitle: e.target.value})}
                       placeholder="📢 Bet Alert"
                       className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                     />
                     <p className="text-xs text-gray-500 mt-1">Title shown in Discord for bet alerts (can be overridden per bet)</p>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm text-gray-400 mb-1">Bet Alert Color</label>
                       <div className="flex space-x-2">
                         <input 
                           type="number" 
                           value={appSettings.betEmbedColor}
                           onChange={(e) => setAppSettings({...appSettings, betEmbedColor: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                           className="flex-1 bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                         />
                         <div 
                           className="w-12 h-10 rounded border border-gray-600"
                           style={{ backgroundColor: `#${appSettings.betEmbedColor.toString(16).padStart(6, '0')}` }}
                         />
                       </div>
                       <p className="text-xs text-gray-500 mt-1">Decimal color code</p>
                     </div>

                     <div>
                       <label className="block text-sm text-gray-400 mb-1">Recap Color</label>
                       <div className="flex space-x-2">
                         <input 
                           type="number" 
                           value={appSettings.recapEmbedColor}
                           onChange={(e) => setAppSettings({...appSettings, recapEmbedColor: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                           className="flex-1 bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                         />
                         <div 
                           className="w-12 h-10 rounded border border-gray-600"
                           style={{ backgroundColor: `#${appSettings.recapEmbedColor.toString(16).padStart(6, '0')}` }}
                         />
                       </div>
                       <p className="text-xs text-gray-500 mt-1">Decimal color code</p>
                     </div>
                   </div>
                 </div>
               </div>

              <div className="flex justify-end pt-2">
                 <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">
                   Save Settings
                 </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-200 p-4 rounded-lg mb-6 flex justify-between items-center">
             <span>{error}</span>
             <button onClick={() => setError(null)}><Trash size={16}/></button>
          </div>
        )}

        <div className="flex space-x-2 mb-6 border-b border-gray-700 pb-1 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('queue')}
            className={`flex items-center px-3 md:px-4 py-2 font-medium transition-all rounded-t-lg whitespace-nowrap ${activeTab === 'queue' ? 'bg-[#2f3136] text-white border-t border-l border-r border-gray-600' : 'text-gray-400 hover:text-white hover:bg-[#2f3136]/50'}`}
          >
            <Layers size={16} className="mr-1 md:mr-2"/> Queue ({queueBets.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex items-center px-3 md:px-4 py-2 font-medium transition-all rounded-t-lg whitespace-nowrap ${activeTab === 'history' ? 'bg-[#2f3136] text-white border-t border-l border-r border-gray-600' : 'text-gray-400 hover:text-white hover:bg-[#2f3136]/50'}`}
          >
            <FileText size={16} className="mr-1 md:mr-2"/> History & Stats ({historyBets.length})
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center px-3 md:px-4 py-2 font-medium transition-all rounded-t-lg whitespace-nowrap ${activeTab === 'calendar' ? 'bg-[#2f3136] text-white border-t border-l border-r border-gray-600' : 'text-gray-400 hover:text-white hover:bg-[#2f3136]/50'}`}
          >
            <Calendar size={16} className="mr-1 md:mr-2"/> Calendar
          </button>
        </div>

        {activeTab === 'queue' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center bg-[#2f3136] p-3 rounded-lg border border-gray-700 justify-between">
                   <div className="flex items-center">
                       <Calendar size={20} className="text-gray-400 mr-2" />
                       <label className="text-sm text-gray-400 mr-2">Slate Date:</label>
                       <input 
                         type="date" 
                         value={slateDate}
                         onChange={(e) => setSlateDate(e.target.value)}
                         className="bg-[#202225] text-white border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                       />
                   </div>
                </div>
                
                <Uploader onImageSelected={handleImageUpload} isLoading={loading} />
              </div>
              
              <div className="flex flex-col space-y-3 justify-center">
                 <button onClick={handleManualAdd} className="flex items-center justify-center p-3 md:p-4 bg-[#2f3136] hover:bg-[#40444b] rounded-lg border border-gray-700 transition-colors">
                    <Plus size={18} className="mr-2 text-green-400 flex-shrink-0"/> <span className="font-semibold text-sm md:text-base">Add Manual Play</span>
                 </button>
                 
                 <button onClick={handleScheduleAll} className="flex items-center justify-center p-3 md:p-4 bg-[#2f3136] hover:bg-indigo-900/20 hover:border-indigo-500 rounded-lg border border-gray-700 transition-colors">
                    <Clock size={18} className="mr-2 text-indigo-400 flex-shrink-0"/> <span className="font-semibold text-indigo-100 text-sm md:text-base">Schedule All</span>
                 </button>

                 {queueBets.length > 0 && (
                   <button onClick={clearAllBets} className="flex items-center justify-center p-3 md:p-4 bg-[#2f3136] hover:bg-red-900/20 hover:border-red-500 rounded-lg border border-gray-700 transition-colors">
                      <Trash size={18} className="mr-2 text-red-400 flex-shrink-0"/> <span className="font-semibold text-red-100 text-sm md:text-base">Clear All Queue</span>
                   </button>
                 )}
              </div>
            </div>

            <div className="space-y-2">
              {queueBets.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border border-dashed border-gray-700 rounded-lg">
                   Queue is empty. Upload a slate or add a manual bet.
                </div>
              ) : (
                queueBets.map(bet => (
                  <BetCard 
                    key={bet.id} 
                    bet={bet} 
                    settings={appSettings}
                    onUpdate={handleUpdateBet}
                    onDelete={handleDeleteBet}
                    onCopy={handleCopyBet}
                    onPostToDiscord={handlePostToDiscord}
                  />
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <>
            {restoredDate && (
              <div className="flex items-center justify-between mb-4 px-4 py-2 bg-indigo-900/30 border border-indigo-600 rounded-lg text-sm">
                <span className="text-indigo-300 flex items-center gap-2">
                  <RotateCcw size={14} />
                  Viewing restored data for <strong>{restoredDate}</strong>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className="text-indigo-400 hover:text-indigo-200 underline"
                  >
                    Back to Calendar
                  </button>
                  <button
                    onClick={() => {
                      setRestoredDate(null);
                      setSlateDate(new Date().toISOString().split('T')[0]);
                    }}
                    className="text-gray-400 hover:text-white underline"
                  >
                    Cancel Restore
                  </button>
                </div>
              </div>
            )}
            <StatsOverview bets={bets} settings={appSettings} slateDate={slateDate} onUpdateSettings={setAppSettings} onDeleteBet={handleDeleteBet} botId={activeBot?.id} />
            
            <div className="flex justify-between items-center mb-3">
               <button onClick={handleManualAddPosted} className="flex items-center text-sm px-3 py-2 bg-[#2f3136] hover:bg-[#40444b] rounded-lg border border-gray-700 transition-colors">
                  <Plus size={16} className="mr-1 text-green-400"/> Add Manual Play
               </button>
               {!restoredDate && (
                 <button onClick={clearAllBets} className="flex items-center text-xs text-red-400 hover:text-red-200">
                   <RefreshCw size={12} className="mr-1"/> Reset All Data
                 </button>
               )}
            </div>

            {/* History sub-filter tabs */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {([ 
                { key: 'all',     label: 'All',     count: historyBets.length },
                { key: 'pending', label: 'Pending', count: historyBets.filter(b => b.result === BetResult.PENDING).length },
                { key: 'won',     label: 'Won',     count: historyBets.filter(b => b.result === BetResult.WIN).length },
                { key: 'lost',    label: 'Lost',    count: historyBets.filter(b => b.result === BetResult.LOSS).length },
                { key: 'push',    label: 'Push',    count: historyBets.filter(b => b.result === BetResult.PUSH).length },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setHistoryFilter(tab.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    historyFilter === tab.key
                      ? tab.key === 'won' ? 'bg-green-700 text-white'
                        : tab.key === 'lost' ? 'bg-red-700 text-white'
                        : tab.key === 'pending' ? 'bg-yellow-700 text-white'
                        : tab.key === 'push' ? 'bg-blue-700 text-white'
                        : 'bg-indigo-600 text-white'
                      : 'bg-[#2f3136] text-gray-400 hover:text-white hover:bg-[#40444b]'
                  }`}
                >
                  {tab.label} <span className="opacity-75">({tab.count})</span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredHistoryBets.length === 0 ? (
                 <div className="text-center py-12 text-gray-500">
                    {historyFilter === 'all'
                      ? `No posted bets for ${slateDate}.`
                      : `No ${historyFilter} bets for ${slateDate}.`
                    }
                 </div>
              ) : (
                filteredHistoryBets.map(bet => (
                  <BetCard 
                    key={bet.id} 
                    bet={bet} 
                    settings={appSettings}
                    onUpdate={handleUpdateBet}
                    onDelete={handleDeleteBet}
                    onCopy={handleCopyBetToHistory}
                    onPostToDiscord={handlePostToDiscord}
                  />
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'calendar' && (
          <div className="bg-[#2f3136] rounded-lg p-4 md:p-6 shadow-lg">
            <CalendarView
              settings={appSettings}
              botId={activeBot?.id}
              onCopy={handleCopyBetToHistory}
              onRestoreDate={(date) => {
                setSlateDate(date);
                setRestoredDate(date);
                setActiveTab('history');
              }}
            />
          </div>
        )}

      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    authAPI.me()
      .then(u => {
        setUser(u);
        setAuthChecked(true);
      })
      .catch(() => {
        clearToken();
        setAuthChecked(true);
      });
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    navigate('/login');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#36393f] flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignupPage />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
      <Route path="/account" element={user ? <AccountPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route
        path="/*"
        element={
          user
            ? <MainApp user={user} onLogout={handleLogout} />
            : <Navigate to="/login" state={{ from: location }} replace />
        }
      />
    </Routes>
  );
};

export default App;
