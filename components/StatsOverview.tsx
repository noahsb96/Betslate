
import React, { useState, useEffect } from 'react';
import { Bet, BetResult, AppSettings } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Send, Clock, CheckCircle } from 'lucide-react';

interface StatsOverviewProps {
  bets: Bet[];
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ bets, settings, onUpdateSettings }) => {
  const [recapTime, setRecapTime] = useState<string>('');
  const [recapScheduled, setRecapScheduled] = useState(false);
  const [useSeparateWebhook, setUseSeparateWebhook] = useState(false);

  const finishedBets = bets.filter(b => b.result !== BetResult.PENDING);
  
  const wins = finishedBets.filter(b => b.result === BetResult.WIN).length;
  const losses = finishedBets.filter(b => b.result === BetResult.LOSS).length;
  const pushes = finishedBets.filter(b => b.result === BetResult.PUSH).length;
  
  // Odds Calculator Helper
  const calculateProfit = (units: number, oddsStr?: string) => {
    const odds = parseInt(oddsStr || settings.defaultOdds || '-120');
    if (isNaN(odds)) return 0; // Fallback

    if (odds > 0) {
      // Positive odds (e.g., +150): Profit = Units * (Odds / 100)
      return units * (odds / 100);
    } else {
      // Negative odds (e.g., -120): Profit = Units * (100 / Math.abs(odds));
      return units * (100 / Math.abs(odds));
    }
  };

  const unitsWon = finishedBets
    .filter(b => b.result === BetResult.WIN)
    .reduce((acc, curr) => acc + calculateProfit(curr.units, curr.odds), 0);
    
  const unitsLost = finishedBets
    .filter(b => b.result === BetResult.LOSS)
    .reduce((acc, curr) => acc + curr.units, 0);
    
  const netUnits = unitsWon - unitsLost;
  const formattedNetUnits = netUnits.toFixed(2);

  const pieData = [
    { name: 'Wins', value: wins, color: '#22c55e' },
    { name: 'Losses', value: losses, color: '#ef4444' },
    { name: 'Push', value: pushes, color: '#eab308' },
  ].filter(d => d.value > 0);

  // League Performance with exact odds
  const leagueStats: Record<string, number> = {};
  finishedBets.forEach(bet => {
    if (!leagueStats[bet.league]) leagueStats[bet.league] = 0;
    if (bet.result === BetResult.WIN) leagueStats[bet.league] += calculateProfit(bet.units, bet.odds);
    if (bet.result === BetResult.LOSS) leagueStats[bet.league] -= bet.units;
  });

  const barData = Object.keys(leagueStats).map(league => ({
    name: league,
    units: parseFloat(leagueStats[league].toFixed(2))
  }));

  // Recap Scheduler Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (recapScheduled && recapTime) {
      interval = setInterval(async () => {
        const now = new Date();
        const [targetHours, targetMinutes] = recapTime.split(':').map(Number);
        
        if (now.getHours() === targetHours && now.getMinutes() === targetMinutes && now.getSeconds() < 10) {
          await handleSendRecap();
          setRecapScheduled(false); // Only run once per day setting
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [recapScheduled, recapTime, finishedBets]);

  const handleSendRecap = async () => {
    const url = (useSeparateWebhook && settings.recapWebhookUrl) ? settings.recapWebhookUrl : settings.discordWebhookUrl;
    
    if (!url) {
      alert("No Webhook URL configured for recap.");
      return;
    }

    const payload = {
        username: settings.botName,
        avatar_url: settings.botAvatarUrl,
        embeds: [{
            title: `📅 Daily Recap - ${new Date().toLocaleDateString()}`,
            color: netUnits >= 0 ? 5763719 : 15548997, // Green or Red
            fields: [
                { name: "Record", value: `${wins}-${losses}-${pushes}`, inline: true },
                { name: "Net Units", value: `${netUnits > 0 ? '+' : ''}${formattedNetUnits}u`, inline: true },
                { name: "Total ROI", value: `${finishedBets.length > 0 ? ((netUnits / finishedBets.reduce((a,b) => a+b.units,0)) * 100).toFixed(1) : 0}%`, inline: true }
            ],
            footer: { text: "The Commissioner • Auto-Generated" }
        }]
    };

    try {
        await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        alert("Recap sent successfully!");
    } catch(e) {
        console.error(e);
        alert("Failed to send recap.");
    }
  };

  return (
    <div className="bg-[#2f3136] rounded-lg p-6 shadow-lg mb-8 text-white">
      <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
        <span className="flex items-center"><span className="mr-2">📊</span> Recap & Performance</span>
      </h2>

      {/* Recap Controls */}
      <div className="bg-[#202225] p-4 rounded mb-6 border border-gray-700">
         <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide flex items-center">
            <Clock size={14} className="mr-2"/> Automated Recap
         </h3>
         <div className="flex flex-col md:flex-row items-center gap-4">
             <div className="flex items-center space-x-2">
                 <input 
                   type="time" 
                   value={recapTime} 
                   onChange={(e) => setRecapTime(e.target.value)}
                   className="bg-[#2f3136] border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
                 />
                 <button 
                    onClick={() => setRecapScheduled(!recapScheduled)}
                    className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${recapScheduled ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'}`}
                 >
                    {recapScheduled ? 'Scheduled' : 'Schedule'}
                 </button>
             </div>
             
             <div className="flex items-center space-x-2">
                 <input 
                    type="checkbox" 
                    id="webhookToggle"
                    checked={useSeparateWebhook}
                    onChange={(e) => setUseSeparateWebhook(e.target.checked)}
                    className="rounded bg-gray-700 border-gray-600"
                 />
                 <label htmlFor="webhookToggle" className="text-xs text-gray-400">Use separate Recap Webhook</label>
             </div>

             <div className="ml-auto">
                 <button onClick={handleSendRecap} className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition-colors">
                    <Send size={14} className="mr-2"/> Send Recap Now
                 </button>
             </div>
         </div>
         {useSeparateWebhook && (
             <div className="mt-3">
                 <input 
                    type="text" 
                    placeholder="Paste Recap Webhook URL here..."
                    value={settings.recapWebhookUrl || ''}
                    onChange={(e) => onUpdateSettings({...settings, recapWebhookUrl: e.target.value})}
                    className="w-full bg-[#2f3136] border border-gray-600 rounded px-3 py-1 text-xs text-gray-300 focus:outline-none"
                 />
             </div>
         )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#202225] p-4 rounded border-l-4 border-blue-500">
           <div className="text-gray-400 text-xs uppercase font-bold">Total Bets</div>
           <div className="text-2xl font-bold">{finishedBets.length}</div>
        </div>
        <div className="bg-[#202225] p-4 rounded border-l-4 border-green-500">
           <div className="text-gray-400 text-xs uppercase font-bold">Wins</div>
           <div className="text-2xl font-bold">{wins}</div>
        </div>
        <div className="bg-[#202225] p-4 rounded border-l-4 border-red-500">
           <div className="text-gray-400 text-xs uppercase font-bold">Losses</div>
           <div className="text-2xl font-bold">{losses}</div>
        </div>
         <div className={`bg-[#202225] p-4 rounded border-l-4 ${netUnits >= 0 ? 'border-green-400' : 'border-red-400'}`}>
           <div className="text-gray-400 text-xs uppercase font-bold">Net Units</div>
           <div className={`text-2xl font-bold ${netUnits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
             {netUnits > 0 ? '+' : ''}{formattedNetUnits}u
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-64">
        {pieData.length > 0 ? (
          <div className="w-full h-full">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 text-center">Win/Loss Ratio</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{backgroundColor: '#202225', border: 'none', borderRadius: '8px'}} itemStyle={{color: '#fff'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
            <div className="flex items-center justify-center text-gray-500 text-sm italic">
                No finished bets to chart.
            </div>
        )}

        {barData.length > 0 ? (
          <div className="w-full h-full">
             <h3 className="text-sm font-semibold text-gray-400 mb-2 text-center">Net Units by League</h3>
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={barData}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#40444b" vertical={false} />
                 <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tick={{fill: '#9ca3af'}} />
                 <YAxis stroke="#9ca3af" fontSize={10} tick={{fill: '#9ca3af'}} />
                 <Tooltip cursor={{fill: '#40444b', opacity: 0.3}} contentStyle={{backgroundColor: '#202225', border: 'none', borderRadius: '8px'}} itemStyle={{color: '#fff'}} />
                 <Bar dataKey="units">
                    {barData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.units >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>
        ) : (
             <div className="flex items-center justify-center text-gray-500 text-sm italic">
                No league data available.
            </div>
        )}
      </div>
    </div>
  );
};

export default StatsOverview;
