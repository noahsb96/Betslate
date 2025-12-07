
import React, { useState } from 'react';
import { Bet, BetResult, AppSettings } from '../types';
import { Check, X, Clock, Edit2, Trash2, Save, Send, Loader2, CalendarClock, Settings2, ExternalLink } from 'lucide-react';

interface BetCardProps {
  bet: Bet;
  settings: AppSettings;
  onUpdate: (id: string, updates: Partial<Bet>) => void;
  onDelete: (id: string) => void;
  onPostToDiscord: (bet: Bet) => Promise<boolean>;
}

const BetCard: React.FC<BetCardProps> = ({ bet, settings, onUpdate, onDelete, onPostToDiscord }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(bet);
  const [isPosting, setIsPosting] = useState(false);
  const [showScheduleEdit, setShowScheduleEdit] = useState(false);

  const handleSave = () => {
    onUpdate(bet.id, editForm);
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
    onUpdate(bet.id, { autoPost: !bet.autoPost });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this play?")) {
      onDelete(bet.id);
    }
  };

  const openSofascore = () => {
    // Basic search on Sofascore
    const query = `${bet.playerA} ${bet.playerB}`;
    window.open(`https://www.sofascore.com/search?q=${encodeURIComponent(query)}`, '_blank');
  };

  const getStatusColor = (result: BetResult) => {
    switch (result) {
      case BetResult.WIN: return 'border-green-500 bg-green-500/10';
      case BetResult.LOSS: return 'border-red-500 bg-red-500/10';
      case BetResult.PUSH: return 'border-yellow-500 bg-yellow-500/10';
      default: return 'border-gray-700 bg-[#2f3136]';
    }
  };

  // Determine the effective scheduled time
  const effectiveTime = bet.customScheduleTime 
    ? bet.customScheduleTime 
    : (bet.matchTimestamp ? bet.matchTimestamp - (settings.scheduleOffsetMinutes * 60000) : 0);

  const scheduleDisplay = effectiveTime > 0 
    ? new Date(effectiveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    : 'Not Scheduled';

  const formatForInput = (timestamp: number) => {
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  return (
    <div className={`relative flex flex-col mb-4 rounded-md border-l-4 ${getStatusColor(bet.result)} shadow-lg transition-all`}>
      
      {/* Discord Mockup Header */}
      <div className="flex items-center space-x-3 p-4 bg-[#36393f] rounded-tr-md">
        {settings.botAvatarUrl ? (
          <img src={settings.botAvatarUrl} alt="Bot" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
            TC
          </div>
        )}
        
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-white">{settings.botName || 'The Commissioner'}</span>
            <span className="bg-[#5865f2] text-[10px] text-white px-1 rounded">APP</span>
            <span className="text-gray-400 text-xs">
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
        
        {/* Actions */}
        <div className="ml-auto flex items-center space-x-2">
          
          {/* Scheduling Controls */}
          {!bet.isPosted && (
             <div className="flex items-center space-x-1 mr-2 bg-[#202225] rounded p-1">
               <button 
                 onClick={toggleAutoSchedule}
                 className={`flex items-center px-2 py-1 rounded text-xs transition-colors border ${bet.autoPost ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' : 'border-gray-600 text-gray-500 hover:text-gray-300'}`}
                 title={bet.autoPost ? 'Click to Disable Auto-Schedule' : 'Click to Auto-Schedule'}
               >
                 <CalendarClock size={14} className="mr-1" />
                 {bet.autoPost ? 'On' : 'Off'}
               </button>
               
               {showScheduleEdit ? (
                  <div className="flex items-center space-x-1 animate-fade-in">
                    <input 
                      type="datetime-local"
                      className="text-black text-xs p-1 rounded w-32"
                      value={bet.customScheduleTime ? formatForInput(bet.customScheduleTime) : (effectiveTime ? formatForInput(effectiveTime) : '')}
                      onChange={(e) => {
                         const time = new Date(e.target.value).getTime();
                         onUpdate(bet.id, { customScheduleTime: time, autoPost: true });
                      }}
                    />
                    <button onClick={() => setShowScheduleEdit(false)} className="text-gray-400 hover:text-white"><X size={14}/></button>
                  </div>
               ) : (
                 <div 
                   onClick={() => setShowScheduleEdit(true)}
                   className="flex items-center text-xs text-gray-400 cursor-pointer hover:text-white px-2"
                 >
                   <span>{scheduleDisplay}</span>
                   <Settings2 size={12} className="ml-1 opacity-50"/>
                 </div>
               )}
             </div>
          )}

          {bet.isPosted && (
             <span className="text-xs text-green-500 font-bold border border-green-900 bg-green-900/20 px-2 py-1 rounded mr-2">
               SENT
             </span>
          )}

          {isEditing ? (
             <button onClick={handleSave} className="p-1.5 text-green-400 hover:bg-gray-700 rounded"><Save size={16}/></button>
          ) : (
             <button onClick={() => setIsEditing(true)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"><Edit2 size={16}/></button>
          )}
          
          <button 
            onClick={handlePost} 
            disabled={isPosting || bet.isPosted}
            className={`p-1.5 rounded transition-colors ${bet.isPosted ? 'text-gray-600 cursor-not-allowed' : 'text-blue-400 hover:text-white hover:bg-blue-600/50'}`}
            title="Post Now (Immediate)"
          >
             {isPosting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16}/>}
          </button>

          <button onClick={handleDelete} className="p-1.5 text-red-400 hover:bg-gray-700 rounded z-10">
            <Trash2 size={16}/>
          </button>
        </div>
      </div>

      {/* Embed Content */}
      <div className="p-4 bg-[#2f3136] rounded-br-md text-gray-100 pl-16 pt-0">
        <div className="bg-[#202225] border-l-4 border-[#ff4d4d] rounded p-4 mt-2 max-w-md shadow-sm">
          <div className="flex items-center text-white font-bold mb-2">
             📢 Bet Alert
          </div>
          
          {isEditing ? (
            <div className="space-y-3 text-sm">
               <div>
                  <label className="block text-xs text-gray-400">Players</label>
                  <div className="flex space-x-2">
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full" value={editForm.playerA} onChange={e => setEditForm({...editForm, playerA: e.target.value})} />
                    <span className="text-gray-500 self-center">vs</span>
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full" value={editForm.playerB} onChange={e => setEditForm({...editForm, playerB: e.target.value})} />
                  </div>
               </div>
               <div className="grid grid-cols-4 gap-2">
                 <div className="col-span-1">
                    <label className="block text-xs text-gray-400">Type</label>
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} />
                 </div>
                 <div className="col-span-1">
                    <label className="block text-xs text-gray-400">Units</label>
                    <input type="number" step="0.5" className="bg-gray-700 text-white px-2 py-1 rounded w-full" value={editForm.units} onChange={e => setEditForm({...editForm, units: Number(e.target.value)})} />
                 </div>
                 <div className="col-span-1">
                    <label className="block text-xs text-gray-400">Odds</label>
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full" placeholder="-120" value={editForm.odds || ''} onChange={e => setEditForm({...editForm, odds: e.target.value})} />
                 </div>
                 <div className="col-span-1">
                    <label className="block text-xs text-gray-400">League</label>
                    <input className="bg-gray-700 text-white px-2 py-1 rounded w-full" value={editForm.league} onChange={e => setEditForm({...editForm, league: e.target.value})} />
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
                <div className="text-sm text-gray-300">{bet.playerA} vs {bet.playerB}</div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-2">
                <div>
                   <div className="text-xs font-bold text-white">Type</div>
                   <div className="text-sm text-gray-300 uppercase">{bet.type}</div>
                </div>
                <div>
                   <div className="text-xs font-bold text-white">Units</div>
                   <div className="text-sm text-gray-300">{bet.units}u <span className="text-gray-500 text-[10px]">{bet.odds || settings.defaultOdds}</span></div>
                </div>
                <div>
                   <div className="text-xs font-bold text-white">League</div>
                   <div className="text-sm text-gray-300">{bet.league}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-white">Start Time</div>
                <div className="text-sm text-gray-300">{bet.time} EST</div>
              </div>
            </>
          )}
        </div>

        {/* Result Tracking Buttons (Only show if posted) */}
        {bet.isPosted && (
          <div className="flex items-center space-x-2 mt-3 animate-fade-in flex-wrap gap-y-2">
             {/* Sofascore Helper Link */}
             <button 
               onClick={openSofascore}
               className="flex items-center px-2 py-1 bg-[#202225] border border-gray-600 rounded text-xs text-blue-400 hover:text-white hover:border-blue-500 mr-2"
               title="Search Result on Sofascore"
             >
               <ExternalLink size={12} className="mr-1"/> Grade
             </button>

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
