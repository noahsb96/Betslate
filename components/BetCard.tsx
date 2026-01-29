
import React, { useState } from 'react';
import { Bet, BetResult, AppSettings } from '../types';
import { Check, X, Clock, Edit2, Trash2, Save, Send, Loader2, CalendarClock, Settings2, ExternalLink, Copy } from 'lucide-react';

interface BetCardProps {
  bet: Bet;
  settings: AppSettings;
  onUpdate: (id: string, updates: Partial<Bet>, shouldScroll?: boolean) => void;
  onDelete: (id: string) => void;
  onCopy: (bet: Bet) => void;
  onPostToDiscord: (bet: Bet) => Promise<boolean>;
}

const BetCard: React.FC<BetCardProps> = ({ bet, settings, onUpdate, onDelete, onCopy, onPostToDiscord }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(bet);
  const [isPosting, setIsPosting] = useState(false);
  const [showScheduleEdit, setShowScheduleEdit] = useState(false);
  const [tempScheduleTime, setTempScheduleTime] = useState<string>('');

  const handleSave = () => {
    onUpdate(bet.id, {
      playerA: editForm.playerA,
      playerB: editForm.playerB,
      type: editForm.type,
      units: editForm.units,
      odds: editForm.odds,
      league: editForm.league,
      time: editForm.time,
      customTitle: editForm.customTitle
    });
    setIsEditing(false);
  };

  const handlePost = async () => {
    if (!settings.discordWebhookUrl) {
      alert("Please configure your Discord Webhook URL in settings first.");
      return;
    }
    setIsPosting(true);
    const success = await onPostToDiscord(bet);
    setIsPosting(false);
    if (success) {
      onUpdate(bet.id, { isPosted: true, autoPost: false });
    } else {
      alert("Failed to send. Check console for CORS or URL errors.");
    }
  };

  const toggleAutoSchedule = () => {
    if (bet.isPosted) return;
    
    // Check if enabling auto-schedule on a bet scheduled in the past
    if (!bet.autoPost) {
      const effectiveScheduleTime = bet.customScheduleTime 
        ? bet.customScheduleTime 
        : (bet.matchTimestamp ? bet.matchTimestamp - (settings.scheduleOffsetMinutes * 60000) : 0);
      
      if (effectiveScheduleTime > 0 && effectiveScheduleTime < Date.now()) {
        const minutesAgo = Math.round((Date.now() - effectiveScheduleTime) / 60000);
        alert(`Cannot enable auto-schedule: This bet was scheduled ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago. Please update the schedule time or post it manually.`);
        return;
      }
    }
    
    onUpdate(bet.id, { autoPost: !bet.autoPost });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this play?")) {
      onDelete(bet.id);
    }
  };

  const getStatusColor = (result: BetResult) => {
    switch (result) {
      case BetResult.WIN: return 'border-green-500 bg-green-500/10';
      case BetResult.LOSS: return 'border-red-500 bg-red-500/10';
      case BetResult.PUSH: return 'border-yellow-500 bg-yellow-500/10';
      default: return 'border-gray-700 bg-[#2f3136]';
    }
  };

  const effectiveTime = bet.customScheduleTime 
    ? bet.customScheduleTime 
    : (bet.matchTimestamp ? bet.matchTimestamp - (settings.scheduleOffsetMinutes * 60000) : 0);

  const isScheduledInPast = effectiveTime > 0 && effectiveTime < Date.now();
  const minutesAgo = isScheduledInPast ? Math.round((Date.now() - effectiveTime) / 60000) : 0;

  const scheduleDisplay = effectiveTime > 0 
    ? new Date(effectiveTime).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        month: 'short', 
        day: 'numeric',
        timeZone: settings.slateTimezone || 'America/New_York'
      }) + ` ${settings.slateTimezone === 'America/New_York' ? 'EST' : 
              settings.slateTimezone === 'America/Chicago' ? 'CST' :
              settings.slateTimezone === 'America/Denver' ? 'MST' :
              settings.slateTimezone === 'America/Los_Angeles' ? 'PST' : 'EST'}`
    : 'Not Scheduled';

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  };

  const formatForInput = (timestamp: number) => {
    const userTimezone = settings.slateTimezone || 'America/New_York';
    const date = new Date(timestamp);
    
    const formatted = new Intl.DateTimeFormat('sv-SE', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
    
    return formatted.replace(' ', 'T');
  };

  return (
    <div id={`bet-${bet.id}`} className={`relative flex flex-col mb-4 rounded-md border-l-4 ${getStatusColor(bet.result)} shadow-lg transition-all overflow-hidden`}>
      
      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 p-2 sm:p-3 md:p-4 bg-[#36393f] rounded-tr-md">
        {settings.botAvatarUrl ? (
          <img src={settings.botAvatarUrl} alt="Bot" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {getInitials(settings.botName || 'AI BetSlate Automator')}
          </div>
        )}
        
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm sm:text-base truncate">{settings.botName || 'AI BetSlate Automator'}</span>
            <span className="bg-[#5865f2] text-[10px] text-white px-1 rounded flex-shrink-0">APP</span>
            <span className="text-gray-400 text-xs flex-shrink-0">
              {bet.isPosted ? 'Posted' : `Starts at ${bet.time}`}
            </span>
          </div>
          <div className="text-[#a3a6aa] text-sm mt-0.5">
             {settings.mentionString ? (
               <span className="text-[#c9cdfb] bg-[#414653]/50 px-1 rounded hover:bg-[#5865f2] hover:text-white cursor-pointer transition-colors">
                 {settings.mentionString}
               </span>
             ) : (
               <span className="text-blue-400">@Chefs Plays</span>
             )}
          </div>
        </div>
        
        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
          
          {!bet.isPosted && (
             <div className="flex items-center gap-0.5 sm:gap-1 bg-[#202225] rounded p-0.5 md:p-1">
               <button 
                 onClick={toggleAutoSchedule}
                 className={`flex items-center px-1 sm:px-1.5 md:px-2 py-1 rounded text-xs transition-colors border ${bet.autoPost ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' : 'border-gray-600 text-gray-500 hover:text-gray-300'}`}
                 title={bet.autoPost ? 'Click to Disable Auto-Schedule' : 'Click to Auto-Schedule'}
               >
                 <CalendarClock size={12} className="sm:mr-1" />
                 <span className="hidden sm:inline text-[10px] sm:text-xs">{bet.autoPost ? 'On' : 'Off'}</span>
               </button>
               
               {showScheduleEdit ? (
                  <div className="flex items-center gap-1 animate-fade-in">
                    <input 
                      type="datetime-local"
                      className="text-black text-xs p-1 rounded w-32"
                      value={tempScheduleTime || (bet.customScheduleTime ? formatForInput(bet.customScheduleTime) : (effectiveTime ? formatForInput(effectiveTime) : ''))}
                      onChange={(e) => setTempScheduleTime(e.target.value)}
                      onBlur={(e) => {
                         if (e.target.value) {
                           const inputValue = e.target.value;
                           const [datePart, timePart] = inputValue.split('T');
                           const [year, month, day] = datePart.split('-').map(Number);
                           const [hour, minute] = timePart.split(':').map(Number);
                           
                           const userTimezone = settings.slateTimezone || 'America/New_York';
                           
                           // Create UTC timestamp
                           const testUTC = Date.UTC(year, month - 1, day, hour, minute);
                           const testDate = new Date(testUTC);
                           
                           // Format it back in the user's timezone to see what it would be
                           const formattedInUserTZ = new Intl.DateTimeFormat('sv-SE', {
                             timeZone: userTimezone,
                             year: 'numeric',
                             month: '2-digit',
                             day: '2-digit',
                             hour: '2-digit',
                             minute: '2-digit',
                             hour12: false
                           }).format(testDate);
                           
                           const [fDate, fTime] = formattedInUserTZ.split(' ');
                           const [fYear, fMonth, fDay] = fDate.split('-').map(Number);
                           const [fHour, fMin] = fTime.split(':').map(Number);
                           
                           // Calculate difference and adjust
                           const hourDiff = hour - fHour;
                           const minDiff = minute - fMin;
                           const offsetMs = (hourDiff * 60 + minDiff) * 60 * 1000;
                           
                           const finalTimestamp = testUTC + offsetMs;
                           
                           onUpdate(bet.id, { customScheduleTime: finalTimestamp, autoPost: true }, true);
                         }
                         setShowScheduleEdit(false);
                         setTempScheduleTime('');
                      }}
                      autoFocus
                    />
                    <button onClick={() => {
                      setShowScheduleEdit(false);
                      setTempScheduleTime('');
                    }} className="text-gray-400 hover:text-white"><X size={14}/></button>
                  </div>
               ) : (
                 <div 
                   onClick={() => setShowScheduleEdit(true)}
                   className={`flex items-center text-[10px] sm:text-xs cursor-pointer hover:text-white px-1 sm:px-2 whitespace-nowrap ${
                     isScheduledInPast ? 'text-yellow-300' : 'text-gray-400'
                   }`}
                   title={isScheduledInPast ? `Scheduled ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago - will not auto-post` : 'Click to edit schedule time'}
                 >
                   {isScheduledInPast && <span className="mr-0.5 sm:mr-1">⚠️</span>}
                   <span className="truncate max-w-[100px] sm:max-w-none">{scheduleDisplay}</span>
                   <Settings2 size={10} className="ml-0.5 sm:ml-1 opacity-50 flex-shrink-0"/>
                 </div>
               )}
             </div>
          )}

          {bet.isPosted && (
             <span className="text-[10px] sm:text-xs text-green-500 font-bold border border-green-900 bg-green-900/20 px-1 sm:px-2 py-0.5 sm:py-1 rounded flex-shrink-0">
               SENT
             </span>
          )}

          {isEditing ? (
             <button onClick={handleSave} className="p-1 sm:p-1.5 text-green-400 hover:bg-gray-700 rounded"><Save size={14}/></button>
          ) : (
             <button onClick={() => {
               setEditForm(bet);
               setIsEditing(true);
             }} className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"><Edit2 size={14}/></button>
          )}
          
          <button 
            onClick={() => onCopy(bet)}
            className="p-1 sm:p-1.5 text-purple-400 hover:text-white hover:bg-gray-700 rounded"
            title="Copy Play"
          >
            <Copy size={14}/>
          </button>
          
          <button 
            onClick={handlePost} 
            disabled={isPosting || bet.isPosted}
            className={`p-1 sm:p-1.5 rounded transition-colors ${bet.isPosted ? 'text-gray-600 cursor-not-allowed' : 'text-blue-400 hover:text-white hover:bg-blue-600/50'}`}
            title="Post Now (Immediate)"
          >
             {isPosting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14}/>}
          </button>

          <button onClick={handleDelete} className="p-1 sm:p-1.5 text-red-400 hover:bg-gray-700 rounded z-10">
            <Trash2 size={14}/>
          </button>
        </div>
      </div>

      <div className="p-3 md:p-4 bg-[#2f3136] rounded-br-md text-gray-100 pl-12 md:pl-16 pt-0">
        <div 
          className="bg-[#202225] border-l-4 rounded p-3 md:p-4 mt-2 max-w-full md:max-w-md shadow-sm overflow-hidden"
          style={{ borderLeftColor: `#${settings.betEmbedColor.toString(16).padStart(6, '0')}` }}
        >
          <div className="flex items-center text-white font-bold mb-2 break-words">
             {bet.customTitle || settings.defaultBetAlertTitle}
          </div>
          
          {isEditing ? (
            <div className="space-y-3 text-sm">
               <div>
                  <label className="block text-xs text-gray-400">Custom Title (Optional)</label>
                  <input 
                    className="bg-gray-700 text-white px-2 py-1 rounded w-full" 
                    value={editForm.customTitle || ''} 
                    onChange={e => setEditForm({...editForm, customTitle: e.target.value})} 
                    placeholder={settings.defaultBetAlertTitle}
                  />
               </div>
               <div>
                  <label className="block text-xs text-gray-400">Players</label>
                  <div className="flex space-x-2">
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full" value={editForm.playerA} onChange={e => setEditForm({...editForm, playerA: e.target.value})} />
                    <span className="text-gray-500 self-center">vs</span>
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full" value={editForm.playerB} onChange={e => setEditForm({...editForm, playerB: e.target.value})} />
                  </div>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                 <div>
                    <label className="block text-xs text-gray-400">Type</label>
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full text-sm" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs text-gray-400">Units</label>
                    <input type="number" step="0.5" className="bg-gray-700 text-white px-2 py-1 rounded w-full text-sm" value={editForm.units} onChange={e => setEditForm({...editForm, units: Number(e.target.value)})} />
                 </div>
                 <div>
                    <label className="block text-xs text-gray-400">Odds</label>
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full text-sm" placeholder="-120" value={editForm.odds || ''} onChange={e => setEditForm({...editForm, odds: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs text-gray-400">League</label>
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full text-sm" value={editForm.league} onChange={e => setEditForm({...editForm, league: e.target.value})} />
                 </div>
               </div>
               <div>
                  <label className="block text-xs text-gray-400">Start Time (Display)</label>
                  <input className="bg-gray-700 text-white px-2 py-1 rounded w-full" value={editForm.time} onChange={e => setEditForm({...editForm, time: e.target.value})} />
               </div>
            </div>
          ) : (
            <>
              <div className="mb-2">
                <div className="text-xs font-bold text-white mb-0.5">Match</div>
                <div className="text-sm text-gray-300 break-words">{bet.playerA} vs {bet.playerB}</div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-2">
                <div>
                   <div className="text-xs font-bold text-white">Type</div>
                   <div className="text-sm text-gray-300 uppercase break-words">{bet.type}</div>
                </div>
                <div>
                   <div className="text-xs font-bold text-white">Units</div>
                   <div className="text-sm text-gray-300 break-words">{bet.units}u <span className="text-gray-500 text-[10px]">{bet.odds || settings.defaultOdds}</span></div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                   <div className="text-xs font-bold text-white">League</div>
                   <div className="text-sm text-gray-300 break-words">{bet.league}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-white">Start Time</div>
                <div className="text-sm text-gray-300">{bet.time} EST</div>
              </div>
            </>
          )}
        </div>

        {bet.isPosted && (
          <div className="flex items-center space-x-2 mt-3 animate-fade-in flex-wrap gap-y-2">
            <button 
              onClick={() => onUpdate(bet.id, { result: BetResult.WIN })}
              className={`flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${bet.result === BetResult.WIN ? 'bg-green-600 text-white' : 'bg-[#4f545c] text-gray-300 hover:bg-green-700'}`}
            >
              <Check size={12} className="mr-1" /> WIN
            </button>
            <button 
               onClick={() => onUpdate(bet.id, { result: BetResult.LOSS })}
              className={`flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${bet.result === BetResult.LOSS ? 'bg-red-600 text-white' : 'bg-[#4f545c] text-gray-300 hover:bg-red-700'}`}
            >
              <X size={12} className="mr-1" /> LOSS
            </button>
            <button 
               onClick={() => onUpdate(bet.id, { result: BetResult.PUSH })}
              className={`flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${bet.result === BetResult.PUSH ? 'bg-yellow-600 text-black' : 'bg-[#4f545c] text-gray-300 hover:bg-yellow-700'}`}
            >
              <Clock size={12} className="mr-1" /> PUSH
            </button>
             <button 
               onClick={() => onUpdate(bet.id, { result: BetResult.PENDING })}
              className={`flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${bet.result === BetResult.PENDING ? 'bg-blue-600 text-white' : 'bg-[#4f545c] text-gray-300 hover:bg-blue-700'}`}
            >
              PENDING
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BetCard;
