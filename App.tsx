
import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, Trash, Plus, Calendar, Clock, PlayCircle, Layers, FileText, X, User, Image as ImageIcon, LogOut, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Uploader from './components/Uploader';
import BetCard from './components/BetCard';
import StatsOverview from './components/StatsOverview';
import { analyzeSlateImage } from './services/geminiService';
import { Bet, BetResult, AppSettings } from './types';

const DEFAULT_SETTINGS: AppSettings = {
    mentionString: '@Chefs Plays',
    discordWebhookUrl: '',
    recapWebhookUrl: '',
    botName: 'The Commissioner',
    botAvatarUrl: '',
    scheduleOffsetMinutes: 15,
    slateTimezone: 'America/New_York',
    defaultOdds: '-120'
};

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // --- APP STATE ---
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || '');
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [slateDate, setSlateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // --- EFFECT: LOAD SESSION ---
  useEffect(() => {
     const sessionUser = localStorage.getItem('sessionUser');
     if (sessionUser) {
        handleLoginSuccess(sessionUser);
     }
  }, []);

  // --- EFFECT: SAVE DATA ---
  useEffect(() => {
    if (currentUser) {
       localStorage.setItem(`bets_${currentUser}`, JSON.stringify(bets));
       localStorage.setItem(`settings_${currentUser}`, JSON.stringify(appSettings));
    }
  }, [bets, appSettings, currentUser]);

  // --- AUTH HANDLERS ---
  const handleLoginSuccess = (username: string) => {
     setCurrentUser(username);
     localStorage.setItem('sessionUser', username);
     
     // Load User Data
     const savedBets = localStorage.getItem(`bets_${username}`);
     const savedSettings = localStorage.getItem(`settings_${username}`);
     
     if (savedBets) setBets(JSON.parse(savedBets));
     else setBets([]);
     
     if (savedSettings) setAppSettings(JSON.parse(savedSettings));
     else setAppSettings(DEFAULT_SETTINGS);

     setAuthUsername('');
     setAuthPassword('');
     setAuthError(null);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername || !authPassword) {
        setAuthError("Username and password required");
        return;
    }

    const storedUser = localStorage.getItem(`user_${authUsername}`);

    if (authMode === 'register') {
        if (storedUser) {
            setAuthError("Username already exists");
            return;
        }
        // Register new user
        localStorage.setItem(`user_${authUsername}`, JSON.stringify({ password: authPassword }));
        handleLoginSuccess(authUsername);
    } else {
        // Login
        if (!storedUser) {
            setAuthError("User not found");
            return;
        }
        const userObj = JSON.parse(storedUser);
        if (userObj.password !== authPassword) {
            setAuthError("Invalid password");
            return;
        }
        handleLoginSuccess(authUsername);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sessionUser');
    setBets([]);
    setAppSettings(DEFAULT_SETTINGS);
  };

  // --- SCHEDULER LOGIC ---
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      
      bets.forEach(async (bet) => {
        if (bet.autoPost && !bet.isPosted) {
          const postTime = bet.customScheduleTime 
             ? bet.customScheduleTime 
             : (bet.matchTimestamp ? bet.matchTimestamp - (appSettings.scheduleOffsetMinutes * 60 * 1000) : null);
          
          if (postTime && now >= postTime) {
            console.log(`Auto-posting bet: ${bet.playerA} vs ${bet.playerB}`);
            const success = await handlePostToDiscord(bet);
            if (success) {
              handleUpdateBet(bet.id, { isPosted: true, autoPost: false }); 
            }
          }
        }
      });
    }, 10000); 

    return () => clearInterval(intervalId);
  }, [bets, appSettings]);

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

      const isoTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      const fullDateTimeStr = `${dateStr}T${isoTime}`;
      const localDate = new Date(fullDateTimeStr); 
      return localDate.getTime(); 
    } catch (e) {
      return undefined;
    }
  };

  const handleImageUpload = async (base64: string) => {
    if (!apiKey) {
      setError("Please set your Gemini API Key in settings first.");
      setShowSettings(true);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
        const newBetsRaw = await analyzeSlateImage(base64, apiKey);
        const processedBets = newBetsRaw.map(b => ({
            ...b,
            matchTimestamp: parseMatchTime(b.time, slateDate, appSettings.slateTimezone),
            autoPost: false,
            isPosted: false
        }));
        setBets(prev => [...processedBets, ...prev]);
    } catch (err) {
      setError("Failed to analyze image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBet = (id: string, updates: Partial<Bet>) => {
    setBets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleDeleteBet = (id: string) => {
    setBets(prev => prev.filter(b => b.id !== id));
  };

  const clearAllBets = () => {
    if (window.confirm("Clear all history? This cannot be undone.")) {
      setBets([]);
    }
  };
  
  const handleManualAdd = () => {
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
     setBets(prev => [newBet, ...prev]);
  };

  const handleScheduleAll = () => {
    const confirm = window.confirm(`Schedule all queued bets to auto-post ${appSettings.scheduleOffsetMinutes} mins before start?`);
    if (confirm) {
      setBets(prev => prev.map(b => {
        if (!b.isPosted && b.matchTimestamp && b.matchTimestamp > Date.now()) {
          return { ...b, autoPost: true };
        }
        return b;
      }));
    }
  };

  const handlePostToDiscord = async (bet: Bet): Promise<boolean> => {
    if (!appSettings.discordWebhookUrl) return false;

    const payload = {
      username: appSettings.botName || "The Commissioner",
      avatar_url: appSettings.botAvatarUrl || undefined,
      content: appSettings.mentionString || "",
      allowed_mentions: { parse: ["users", "roles"] }, 
      embeds: [
        {
          title: "📢 Bet Alert",
          color: 16731469, 
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
      return response.ok;
    } catch (e) {
      console.error("Discord Webhook Error:", e);
      return false;
    }
  };

  const queueBets = bets.filter(b => !b.isPosted);
  const historyBets = bets.filter(b => b.isPosted);

  // --- RENDER LOGIN SCREEN ---
  if (!currentUser) {
      return (
          <div className="min-h-screen bg-[#36393f] flex items-center justify-center p-4">
              <div className="bg-[#202225] p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
                  <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white text-2xl shadow-lg shadow-indigo-500/50">
                        TC
                     </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white text-center mb-1">The Commissioner</h2>
                  <p className="text-gray-400 text-center text-sm mb-6">Automated Sports Betting Manager</p>
                  
                  {authError && (
                      <div className="bg-red-500/10 border border-red-500 text-red-200 p-3 rounded text-sm mb-4 text-center">
                          {authError}
                      </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                      <div>
                          <label className="block text-xs uppercase text-gray-400 font-bold mb-1">Username</label>
                          <input 
                            type="text" 
                            className="w-full bg-[#2f3136] border border-gray-600 rounded p-2 text-white focus:border-indigo-500 focus:outline-none"
                            value={authUsername}
                            onChange={(e) => setAuthUsername(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-xs uppercase text-gray-400 font-bold mb-1">Password</label>
                          <input 
                            type="password" 
                            className="w-full bg-[#2f3136] border border-gray-600 rounded p-2 text-white focus:border-indigo-500 focus:outline-none"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                          />
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded transition-colors">
                          {authMode === 'login' ? 'Login' : 'Create Account'}
                      </button>
                  </form>
                  
                  <div className="mt-4 text-center">
                      <button 
                        onClick={() => {
                            setAuthMode(authMode === 'login' ? 'register' : 'login');
                            setAuthError(null);
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300 underline"
                      >
                          {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- RENDER MAIN APP ---
  return (
    <div className="min-h-screen bg-[#36393f] font-sans text-gray-100 pb-20">
      {/* Header */}
      <header className="bg-[#202225] p-4 shadow-md sticky top-0 z-50 border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/50">
                TC
             </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">The Commissioner</h1>
              <div className="flex items-center space-x-2">
                 <div className="text-[10px] bg-gray-700 px-2 py-0.5 rounded text-gray-300 flex items-center">
                    <User size={10} className="mr-1"/> {currentUser}
                 </div>
              </div>
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
            <button 
                onClick={handleLogout}
                className="p-2 text-red-400 hover:text-red-200 hover:bg-gray-700 rounded-full transition-colors"
                title="Logout"
            >
                <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        
        {/* Settings Modal */}
        {showSettings && (
          <div className="bg-[#2f3136] rounded-lg p-6 mb-8 border border-gray-700 shadow-xl animate-fade-in relative z-50">
             <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20}/></button>
            <h3 className="text-lg font-bold mb-4 flex items-center border-b border-gray-700 pb-2">
              <Settings size={18} className="mr-2" /> Application Settings
            </h3>
            <div className="space-y-4">
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Bot Name</label>
                    <input 
                      type="text" 
                      value={appSettings.botName}
                      onChange={(e) => setAppSettings({...appSettings, botName: e.target.value})}
                      className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Mention String</label>
                    <input 
                      type="text" 
                      value={appSettings.mentionString}
                      onChange={(e) => setAppSettings({...appSettings, mentionString: e.target.value})}
                      placeholder="<@&12345678>"
                      className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
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
                   type="password" 
                   value={appSettings.discordWebhookUrl}
                   onChange={(e) => setAppSettings({...appSettings, discordWebhookUrl: e.target.value})}
                   className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                 />
               </div>

               <div>
                 <label className="block text-sm text-gray-400 mb-1">Discord Webhook URL (Recaps - Optional)</label>
                 <input 
                   type="password" 
                   value={appSettings.recapWebhookUrl}
                   onChange={(e) => setAppSettings({...appSettings, recapWebhookUrl: e.target.value})}
                   placeholder="Leave empty to use main webhook"
                   className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                 />
               </div>
               
               <div>
                 <label className="block text-sm text-gray-400 mb-1">Bot Avatar URL</label>
                 <input 
                   type="text" 
                   value={appSettings.botAvatarUrl}
                   onChange={(e) => setAppSettings({...appSettings, botAvatarUrl: e.target.value})}
                   className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                 />
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

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-6 border-b border-gray-700 pb-1">
          <button 
            onClick={() => setActiveTab('queue')}
            className={`flex items-center px-4 py-2 font-medium transition-all rounded-t-lg ${activeTab === 'queue' ? 'bg-[#2f3136] text-white border-t border-l border-r border-gray-600' : 'text-gray-400 hover:text-white hover:bg-[#2f3136]/50'}`}
          >
            <Layers size={16} className="mr-2"/> Queue ({queueBets.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex items-center px-4 py-2 font-medium transition-all rounded-t-lg ${activeTab === 'history' ? 'bg-[#2f3136] text-white border-t border-l border-r border-gray-600' : 'text-gray-400 hover:text-white hover:bg-[#2f3136]/50'}`}
          >
            <FileText size={16} className="mr-2"/> History & Stats ({historyBets.length})
          </button>
        </div>

        {/* QUEUE TAB */}
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
                 <button onClick={handleManualAdd} className="flex items-center justify-center p-4 bg-[#2f3136] hover:bg-[#40444b] rounded-lg border border-gray-700 transition-colors">
                    <Plus size={20} className="mr-2 text-green-400"/> <span className="font-semibold">Add Manual Play</span>
                 </button>
                 
                 <button onClick={handleScheduleAll} className="flex items-center justify-center p-4 bg-[#2f3136] hover:bg-indigo-900/20 hover:border-indigo-500 rounded-lg border border-gray-700 transition-colors">
                    <Clock size={20} className="mr-2 text-indigo-400"/> <span className="font-semibold text-indigo-100">Schedule All</span>
                 </button>
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
                    onPostToDiscord={handlePostToDiscord}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <>
            <StatsOverview bets={bets} settings={appSettings} onUpdateSettings={setAppSettings} />
            
            <div className="flex justify-end mb-4">
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
