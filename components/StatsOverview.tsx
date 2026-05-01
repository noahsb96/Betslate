
import React, { useState, useEffect } from 'react';
import { Bet, BetResult, AppSettings } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Send, Clock, CheckCircle, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { recapsAPI } from '../services/api';

interface StatsOverviewProps {
  bets: Bet[];
  settings: AppSettings;
  slateDate: string;
  onUpdateSettings: (s: AppSettings) => void;
  onDeleteBet: (id: string) => void;
  botId?: string;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ bets, settings, slateDate, onUpdateSettings, onDeleteBet, botId }) => {
  const [recapTime, setRecapTime] = useState<string>('');
  const [recapScheduled, setRecapScheduled] = useState(false);
  const [showRecapSettings, setShowRecapSettings] = useState(false);
  const [showRecapPreview, setShowRecapPreview] = useState(false);
  // Editable recap date — defaults to slateDate but user can change it before sending
  const [recapDate, setRecapDate] = useState<string>(slateDate);

  // Keep recapDate in sync when the slate date picker changes
  useEffect(() => { setRecapDate(slateDate); }, [slateDate]);

  // Filter to bets for the current slate date only
  const dateBets = slateDate
    ? bets.filter(b => b.slateDate === slateDate)
    : bets;

  const finishedBets = dateBets.filter(b => b.result !== BetResult.PENDING);
  
  const wins = finishedBets.filter(b => b.result === BetResult.WIN).length;
  const losses = finishedBets.filter(b => b.result === BetResult.LOSS).length;
  const pushes = finishedBets.filter(b => b.result === BetResult.PUSH).length;
  
  const calculateProfit = (units: number, oddsStr?: string) => {
    const odds = parseInt(oddsStr || settings.defaultOdds || '-120');
    if (isNaN(odds)) return 0;

    if (odds > 0) {
      return units * (odds / 100);
    } else {
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

  // Unit size breakdown: net units grouped by unit size (1u, 1.5u, 3u, etc.)
  const unitSizeStats: Record<string, number> = {};
  finishedBets.forEach(bet => {
    const key = `${bet.units}u`;
    if (!unitSizeStats[key]) unitSizeStats[key] = 0;
    if (bet.result === BetResult.WIN) unitSizeStats[key] += calculateProfit(bet.units, bet.odds);
    if (bet.result === BetResult.LOSS) unitSizeStats[key] -= bet.units;
  });

  const unitSizeBarData = Object.keys(unitSizeStats)
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .map(size => ({
      name: size,
      units: parseFloat(unitSizeStats[size].toFixed(2))
    }));

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (recapScheduled && recapTime) {
      interval = setInterval(async () => {
        const now = new Date();
        const [targetHours, targetMinutes] = recapTime.split(':').map(Number);
        
        if (now.getHours() === targetHours && now.getMinutes() === targetMinutes && now.getSeconds() < 10) {
          await handleSendRecap();
          setRecapScheduled(false);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [recapScheduled, recapTime, finishedBets]);

  const buildRecapEmbed = () => {
    const fields: Array<{ name: string; value: string; inline: boolean }> = [];
    
    if (settings.recapIncludeRecord) {
      fields.push({ name: "Record", value: `${wins}-${losses}-${pushes}`, inline: true });
    }
    
    if (settings.recapIncludeNetUnits) {
      fields.push({ name: "Net Units", value: `${netUnits > 0 ? '+' : ''}${formattedNetUnits}u`, inline: true });
    }
    
    if (settings.recapIncludeROI) {
      const roi = finishedBets.length > 0 ? ((netUnits / finishedBets.reduce((a,b) => a+b.units,0)) * 100).toFixed(1) : 0;
      fields.push({ name: "Total ROI", value: `${roi}%`, inline: true });
    }
    
    if (settings.recapIncludeLeagueStats && barData.length > 0) {
      const leagueStatsText = barData.map(d => `${d.name}: ${d.units > 0 ? '+' : ''}${d.units}u`).join('\n');
      fields.push({ name: "League Breakdown", value: leagueStatsText, inline: false });
    }
    
    const titleDate = settings.recapIncludeDate
      ? ` - ${recapDate ? new Date(recapDate + 'T12:00:00').toLocaleDateString() : new Date().toLocaleDateString()}`
      : '';
    
    return {
      title: `${settings.recapTitle || 'Daily Recap'}${titleDate}`,
      color: settings.recapEmbedColor,
      fields: fields,
      footer: { text: `${settings.botName || 'AI BetSlate Automator'} • Auto-Generated` }
    };
  };

  const handleSendRecap = async () => {
    const url = (settings.recapWebhookUrl && settings.recapWebhookUrl.trim()) ? settings.recapWebhookUrl : settings.discordWebhookUrl;
    
    if (!url) {
      alert("No Webhook URL configured for recap.");
      return;
    }

    const pendingBets = dateBets.filter(b => b.result === BetResult.PENDING && b.isPosted);
    
    if (pendingBets.length > 0) {
      const confirmMessage = `There are ${pendingBets.length} pending play(s) that haven't been marked yet.\n\nDo you want to continue?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    const payload = {
        username: settings.botName,
        avatar_url: settings.botAvatarUrl,
        embeds: [buildRecapEmbed()]
    };

    try {
        await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        // Save the recap snapshot to DB for calendar history
        if (recapDate && botId) {
          const roi = finishedBets.length > 0
            ? parseFloat(((netUnits / finishedBets.reduce((a, b) => a + b.units, 0)) * 100).toFixed(1))
            : 0;
          const leagueBD = Object.entries(leagueStats).map(([league, units]) => ({
            league,
            units: parseFloat((units as number).toFixed(2))
          }));
          await recapsAPI.saveDaily({
              date: recapDate,
              wins,
              losses,
              pushes,
              net_units: parseFloat(formattedNetUnits),
              roi,
              league_breakdown: leagueBD,
              botId
            });
        }
        
        alert("Recap sent and saved to calendar history!");

        // Delete all finished (non-pending) bets for the recap date after recap is sent
        const finishedToDelete = bets.filter(b => b.slateDate === recapDate && b.result !== BetResult.PENDING);
        finishedToDelete.forEach(b => onDeleteBet(b.id));
    } catch(e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        alert(`Failed to send recap: ${msg}`);
    }
  };

  return (
    <div className="bg-[#2f3136] rounded-lg p-6 shadow-lg mb-8 text-white">
      <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
        <span className="flex items-center"><span className="mr-2">📊</span> Recap & Performance</span>
      </h2>

      <div className="bg-[#202225] p-4 rounded mb-6 border border-gray-700">
         <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide flex items-center">
            <Clock size={14} className="mr-2"/> Automated Recap
         </h3>
         <div className="flex flex-col gap-3">
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
               <div className="flex items-center space-x-2">
                 <label className="text-xs text-gray-400 whitespace-nowrap">Recap Date</label>
                 <input
                   type="date"
                   value={recapDate}
                   onChange={(e) => setRecapDate(e.target.value)}
                   className="bg-[#2f3136] border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                 />
                 {recapDate !== slateDate && (
                   <button
                     onClick={() => setRecapDate(slateDate)}
                     className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                     title="Reset to slate date"
                   >
                     Reset
                   </button>
                 )}
               </div>
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
               <div className="sm:ml-auto">
                 <button onClick={handleSendRecap} className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition-colors">
                    <Send size={14} className="mr-2"/> Send Recap Now
                 </button>
               </div>
             </div>
             {recapDate !== slateDate && (
               <p className="text-xs text-yellow-400">
                 ⚠️ Recap will be saved to <strong>{recapDate}</strong> (not today's slate date)
               </p>
             )}
         </div>
      </div>

      <div className="bg-[#202225] p-4 rounded mb-6 border border-gray-700">
         <button 
           onClick={() => setShowRecapSettings(!showRecapSettings)}
           className="w-full flex items-center justify-between text-sm font-bold text-gray-300 uppercase tracking-wide hover:text-white transition-colors"
         >
            <span className="flex items-center">
              <Send size={14} className="mr-2"/> Recap Customization
            </span>
            {showRecapSettings ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
         </button>
         
         {showRecapSettings && (
           <div className="mt-4 space-y-4 animate-fade-in">
             <div>
               <label className="block text-xs text-gray-400 mb-1">Recap Title</label>
               <input 
                 type="text" 
                 value={settings.recapTitle || 'Daily Recap'}
                 onChange={(e) => onUpdateSettings({...settings, recapTitle: e.target.value})}
                 placeholder="Daily Recap"
                 className="w-full bg-[#2f3136] border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
               />
             </div>

             <div>
               <label className="block text-xs text-gray-400 mb-2">Include in Recap</label>
               <div className="grid grid-cols-2 gap-2">
                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={settings.recapIncludeDate}
                     onChange={(e) => onUpdateSettings({...settings, recapIncludeDate: e.target.checked})}
                     className="rounded bg-gray-700 border-gray-600"
                   />
                   <span className="text-sm text-gray-300">Date in Title</span>
                 </label>

                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={settings.recapIncludeRecord}
                     onChange={(e) => onUpdateSettings({...settings, recapIncludeRecord: e.target.checked})}
                     className="rounded bg-gray-700 border-gray-600"
                   />
                   <span className="text-sm text-gray-300">Record (W-L-P)</span>
                 </label>
                 
                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={settings.recapIncludeNetUnits}
                     onChange={(e) => onUpdateSettings({...settings, recapIncludeNetUnits: e.target.checked})}
                     className="rounded bg-gray-700 border-gray-600"
                   />
                   <span className="text-sm text-gray-300">Net Units</span>
                 </label>
                 
                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={settings.recapIncludeROI}
                     onChange={(e) => onUpdateSettings({...settings, recapIncludeROI: e.target.checked})}
                     className="rounded bg-gray-700 border-gray-600"
                   />
                   <span className="text-sm text-gray-300">Total ROI</span>
                 </label>
                 
                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={settings.recapIncludeLeagueStats}
                     onChange={(e) => onUpdateSettings({...settings, recapIncludeLeagueStats: e.target.checked})}
                     className="rounded bg-gray-700 border-gray-600"
                   />
                   <span className="text-sm text-gray-300">League Breakdown</span>
                 </label>
               </div>
             </div>

             <button 
               onClick={() => setShowRecapPreview(!showRecapPreview)}
               className="flex items-center text-xs px-3 py-2 bg-[#2f3136] hover:bg-[#40444b] rounded border border-gray-600 transition-colors"
             >
               <Eye size={14} className="mr-1"/> {showRecapPreview ? 'Hide' : 'Show'} Preview
             </button>

             {showRecapPreview && (
               <div className="bg-[#36393f] p-4 rounded border border-gray-600">
                 <div className="text-xs text-gray-400 mb-2">Discord Embed Preview:</div>
                 <div 
                   className="bg-[#2f3136] rounded p-3 border-l-4" 
                   style={{borderColor: `#${settings.recapEmbedColor.toString(16).padStart(6, '0')}`}}
                 >
                   <div className="font-bold text-white mb-2">{buildRecapEmbed().title}</div>
                   <div className="space-y-1">
                     {buildRecapEmbed().fields.map((field, idx) => (
                       <div key={idx} className={field.inline ? 'inline-block mr-4' : 'block'}>
                         <div className="text-xs font-semibold text-gray-300">{field.name}</div>
                         <div className="text-sm text-white whitespace-pre-line">{field.value}</div>
                       </div>
                     ))}
                   </div>
                   <div className="text-xs text-gray-500 mt-2">{buildRecapEmbed().footer.text}</div>
                 </div>
               </div>
             )}
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

      {unitSizeBarData.length > 0 && (
        <div className="h-64 mt-8">
          <h3 className="text-sm font-semibold text-gray-400 mb-2 text-center">Net Units by Unit Size</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={unitSizeBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#40444b" vertical={false} />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tick={{fill: '#9ca3af'}} />
              <YAxis stroke="#9ca3af" fontSize={10} tick={{fill: '#9ca3af'}} />
              <Tooltip
                cursor={{fill: '#40444b', opacity: 0.3}}
                contentStyle={{backgroundColor: '#202225', border: 'none', borderRadius: '8px'}}
                itemStyle={{color: '#fff'}}
                formatter={(value: number) => [`${value > 0 ? '+' : ''}${value}u`, 'Net Units']}
              />
              <Bar dataKey="units">
                {unitSizeBarData.map((entry, index) => (
                  <Cell key={`ubar-${index}`} fill={entry.units >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default StatsOverview;
