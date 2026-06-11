import React from 'react';
import { MessageSquare, Trash2, Edit2, Clock } from 'lucide-react';
import { ScheduledMessage, AppSettings } from '../types';

interface QueueMessageCardProps {
  message: ScheduledMessage;
  settings: AppSettings;
  onDelete: (id: string) => void;
  onEdit: (message: ScheduledMessage) => void;
}

const QueueMessageCard: React.FC<QueueMessageCardProps> = ({ message, settings, onDelete, onEdit }) => {
  const formatDisplayTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleString('en-US', {
        timeZone: settings.slateTimezone || 'America/New_York',
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return new Date(ts).toLocaleString();
    }
  };

  return (
    <div className="flex items-start gap-3 bg-[#2f3136] border border-indigo-800/60 rounded-lg p-3 shadow">
      <div className="flex-shrink-0 w-9 h-9 bg-indigo-900/50 border border-indigo-700/50 rounded-full flex items-center justify-center mt-0.5">
        <MessageSquare size={15} className="text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={10} />{formatDisplayTime(message.scheduledTime)}
          </span>
          {message.roleMentions.map(r => (
            <span key={r.id} className="text-indigo-400">@{r.name}</span>
          ))}
        </div>
        {message.embedTitle && (
          <div className="text-sm font-semibold text-white">{message.embedTitle}</div>
        )}
        {message.content && (
          <div className="text-sm text-gray-300 truncate">{message.content}</div>
        )}
        {message.imageUrl && (
          <div className="text-xs text-blue-400 truncate mt-0.5">🖼 {message.imageUrl}</div>
        )}
        {message.imageData && !message.imageUrl && (
          <div className="text-xs text-purple-400 mt-0.5">📎 {message.imageFilename || 'uploaded image'}</div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(message)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Edit message"
        >
          <Edit2 size={13} />
        </button>
        <button
          onClick={() => {
            if (window.confirm('Delete this scheduled message?')) onDelete(message.id);
          }}
          className="p-1.5 text-red-400 hover:bg-gray-700 rounded"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

export default QueueMessageCard;
