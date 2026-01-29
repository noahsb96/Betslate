
import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, Trash, Plus, Calendar, Clock, Layers, FileText, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Uploader from './components/Uploader';
import BetCard from './components/BetCard';
import StatsOverview from './components/StatsOverview';
import { analyzeSlateImage } from './services/geminiService';
import { betsAPI, settingsAPI } from './services/api';
import { Bet, BetResult, AppSettings } from './types';

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

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [slateDate, setSlateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [scrollToBetId, setScrollToBetId] = useState<string | null>(null);

  useEffect(() => {
     const loadData = async () => {
       try {
         const [betsData, settingsData] = await Promise.all([
           betsAPI.getAll(),
           settingsAPI.get()
         ]);
         setBets(betsData);
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
      if (appSettings !== DEFAULT_SETTINGS) {
        try {
          await settingsAPI.update(appSettings);
        } catch (err) {
          console.error('Failed to save settings:', err);
        }
      }
    };
    saveSettings();
  }, [appSettings]);

  useEffect(() => {
    const pollBets = async () => {
      try {
        const betsData = await betsAPI.getAll();
        setBets(betsData);
      } catch (err) {
        console.error('Failed to refresh bets:', err);
      }
    };

    const intervalId = setInterval(pollBets, 10000);

    return () => clearInterval(intervalId);
  }, []);

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
      
      const localDate = new Date(year, month - 1, day, hours, minutes, 0);
      
      const timezoneOffsets = {
        'EST': -5,
        'EDT': -4,
        'CST': -6,
        'CDT': -5,
        'MST': -7,
        'MDT': -6,
        'PST': -8,
        'PDT': -7 
      };
      
      const targetTzOffset = timezoneOffsets[timezone] || -5;
      const localTzOffset = -localDate.getTimezoneOffset() / 60;
      
      const offsetDiff = (targetTzOffset - localTzOffset) * 60 * 60 * 1000;
      
      return localDate.getTime() + offsetDiff;
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
    
    console.log('Using API Key:', apiKey?.substring(0, 10) + '...');
    setLoading(true);
    setError(null);
    
    try {
        const newBetsRaw = await analyzeSlateImage(base64, apiKey, appSettings.aiInstructions);
        const processedBets = newBetsRaw.map(b => ({
            ...b,
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
      result: bet.isPosted ? bet.result : BetResult.PENDING
    };
    await betsAPI.create(copiedBet);
    setBets(prev => [copiedBet, ...prev]);
    setScrollToBetId(copiedBet.id);
  };

  const clearAllBets = async () => {
    if (window.confirm("Clear all bets? This cannot be undone.")) {
      await betsAPI.clearAll();
      setBets([]);
    }
  };
  
  const handleManualAdd = async () => {
     const newBet: Bet = {
         id: uuidv4(),
         league: 'Manual Entry',
         playerA: 'Player A',
         playerB: 'Player B',
         time: '12:00 PM',
         type: 'OVER',
         units: 1,
         result: BetResult.PENDING,
         timestamp: Date.now(),
         autoPost: false,
         isPosted: false,
         matchTimestamp: parseMatchTime('12:00 PM', slateDate, appSettings.slateTimezone)
     };
     await betsAPI.create(newBet);
     setBets(prev => [newBet, ...prev]);
  };

  const handleManualAddPosted = async () => {
     const newBet: Bet = {
         id: uuidv4(),
         league: 'Manual Entry',
         playerA: 'Player A',
         playerB: 'Player B',
         time: '12:00 PM',
         type: 'OVER',
         units: 1,
         result: BetResult.PENDING,
         timestamp: Date.now(),
         autoPost: false,
         isPosted: true,
         matchTimestamp: parseMatchTime('12:00 PM', slateDate, appSettings.slateTimezone)
     };
     await betsAPI.create(newBet);
     setBets(prev => [newBet, ...prev]);
     setScrollToBetId(newBet.id);
  };

  const handleScheduleAll = async () => {
    const confirm = window.confirm(`Schedule all queued bets to auto-post ${appSettings.scheduleOffsetMinutes} mins before start?`);
    if (confirm) {
      const updatePromises: Promise<void>[] = [];
      setBets(prev => prev.map(b => {
        if (!b.isPosted && b.matchTimestamp && b.matchTimestamp > Date.now()) {
          updatePromises.push(betsAPI.update(b.id, { autoPost: true }));
          return { ...b, autoPost: true };
        }
        return b;
      }));
      await Promise.all(updatePromises);
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

  const queueBets = bets.filter(b => !b.isPosted).sort((a, b) => {
    const timeA = a.customScheduleTime || (a.matchTimestamp ? a.matchTimestamp - (appSettings.scheduleOffsetMinutes * 60000) : 0);
    const timeB = b.customScheduleTime || (b.matchTimestamp ? b.matchTimestamp - (appSettings.scheduleOffsetMinutes * 60000) : 0);
    return timeA - timeB;
  });
  const historyBets = bets.filter(b => b.isPosted);

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
            <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                title="Settings"
            >
                <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        
        {showSettings && (
          <div className="bg-[#2f3136] rounded-lg p-4 md:p-6 mb-8 border border-gray-700 shadow-xl animate-fade-in relative z-50 max-w-full overflow-x-hidden">
             <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20}/></button>
            <h3 className="text-lg font-bold mb-4 flex items-center border-b border-gray-700 pb-2">
              <Settings size={18} className="mr-2" /> Application Settings
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
            <StatsOverview bets={bets} settings={appSettings} onUpdateSettings={setAppSettings} onDeleteBet={handleDeleteBet} />
            
            <div className="flex justify-between items-center mb-4">
               <button onClick={handleManualAddPosted} className="flex items-center text-sm px-3 py-2 bg-[#2f3136] hover:bg-[#40444b] rounded-lg border border-gray-700 transition-colors">
                  <Plus size={16} className="mr-1 text-green-400"/> Add Manual Play
               </button>
               <button onClick={clearAllBets} className="flex items-center text-xs text-red-400 hover:text-red-200">
                  <RefreshCw size={12} className="mr-1"/> Reset All Data
               </button>
            </div>

            <div className="space-y-2">
              {historyBets.length === 0 ? (
                 <div className="text-center py-12 text-gray-500">
                    No posted bets yet.
                 </div>
              ) : (
                historyBets.map(bet => (
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

      </main>
    </div>
  );
};

export default App;
