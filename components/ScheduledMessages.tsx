import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Clock, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { AppSettings, ScheduledMessage } from '../types';
import { messagesAPI } from '../services/api';
import { getAvailableRoles } from '../src/utils/roleUtils';

interface ScheduledMessagesProps {
  botId: string;
  settings: AppSettings;
}

const ScheduledMessages: React.FC<ScheduledMessagesProps> = ({ botId, settings }) => {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [showSent, setShowSent] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<'url' | 'file'>('url');
  const [useEmbed, setUseEmbed] = useState(false);
  const [form, setForm] = useState<Partial<ScheduledMessage>>({
    content: '',
    imageUrl: '',
    imageData: '',
    imageFilename: '',
    embedTitle: '',
    embedColor: settings.betEmbedColor,
    roleMentions: [],
    scheduledTime: Date.now() + 3600000,
  });

  const loadMessages = async () => {
    try {
      const data = await messagesAPI.getAll(botId, showSent);
      setMessages(data);
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  };

  useEffect(() => { loadMessages(); }, [botId, showSent]);

  const resetForm = () => {
    setForm({
      content: '',
      imageUrl: '',
      imageData: '',
      imageFilename: '',
      embedTitle: '',
      embedColor: settings.betEmbedColor,
      roleMentions: [],
      scheduledTime: Date.now() + 3600000,
    });
    setUseEmbed(false);
    setImageMode('url');
  };

  // Convert a UTC ms timestamp to a datetime-local value in the user's configured timezone
  const tsToInputValue = (ts: number): string => {
    const d = new Date(ts);
    const tz = settings.slateTimezone || 'America/New_York';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    const hour = String(Number(get('hour')) % 24).padStart(2, '0');
    return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
  };

  // Convert a datetime-local string (in user's tz) back to a UTC ms timestamp
  const inputValueToTs = (value: string): number => {
    if (!value) return Date.now() + 3600000;
    const [datePart, timePart] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const tz = settings.slateTimezone || 'America/New_York';
    const naiveUTC = Date.UTC(year, month - 1, day, hour, minute);
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date(naiveUTC));
    const getP = (t: string) => Number(tzParts.find(p => p.type === t)?.value ?? '0');
    const tzNaive = Date.UTC(getP('year'), getP('month') - 1, getP('day'), getP('hour') % 24, getP('minute'));
    return naiveUTC + (naiveUTC - tzNaive);
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setForm(prev => ({ ...prev, imageData: base64, imageFilename: file.name, imageUrl: '' }));
    };
    reader.readAsDataURL(file);
  };

  const handleToggleRole = (roleId: string, roleName: string) => {
    setForm(prev => {
      const current = prev.roleMentions || [];
      const exists = current.some(r => r.id === roleId);
      return {
        ...prev,
        roleMentions: exists
          ? current.filter(r => r.id !== roleId)
          : [...current, { id: roleId, name: roleName }],
      };
    });
  };

  const handleSave = async () => {
    if (!form.scheduledTime) return;
    try {
      if (editingId) {
        const updated = await messagesAPI.update(editingId, { ...form, botId });
        setMessages(prev => prev.map(m => m.id === editingId ? updated : m));
        setEditingId(null);
      } else {
        const created = await messagesAPI.create({ ...form, botId });
        setMessages(prev => [...prev, created].sort((a, b) => a.scheduledTime - b.scheduledTime));
      }
      resetForm();
      setShowForm(false);
    } catch (e: any) {
      alert(e.message || 'Failed to save message');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this scheduled message?')) return;
    try {
      await messagesAPI.delete(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch (e: any) {
      alert(e.message || 'Failed to delete message');
    }
  };

  const handleEdit = (msg: ScheduledMessage) => {
    setEditingId(msg.id);
    setForm({
      content: msg.content,
      imageUrl: msg.imageUrl,
      imageData: msg.imageData,
      imageFilename: msg.imageFilename,
      embedTitle: msg.embedTitle,
      embedColor: msg.embedColor,
      roleMentions: msg.roleMentions,
      scheduledTime: msg.scheduledTime,
    });
    setUseEmbed(!!msg.embedTitle);
    setImageMode(msg.imageData ? 'file' : 'url');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const availableRoles = null; // kept for shape; role tagging now uses mentionString directly
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-indigo-400" /> Scheduled Messages
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Schedule text or image messages to Discord — independent of plays and recaps
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSent(!showSent)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              showSent ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10' : 'border-gray-600 text-gray-400 hover:text-white'
            }`}
          >
            {showSent ? 'Hide Sent' : 'Show Sent'}
          </button>
          <button
            onClick={() => { resetForm(); setEditingId(null); setShowForm(s => !s); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded transition-colors"
          >
            <Plus size={14} /> New Message
          </button>
        </div>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-[#2f3136] rounded-lg border border-gray-700 p-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              {editingId ? 'Edit Message' : 'New Scheduled Message'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} className="text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Scheduled Time */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Scheduled Time</label>
            <input
              type="datetime-local"
              value={form.scheduledTime ? tsToInputValue(form.scheduledTime) : ''}
              onChange={e => setForm(prev => ({ ...prev, scheduledTime: inputValueToTs(e.target.value) }))}
              className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Message Content */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Message Content</label>
            <textarea
              value={form.content || ''}
              onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
              rows={3}
              placeholder="Type your message here..."
              className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-y"
            />
          </div>

          {/* Embed Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
            <input type="checkbox" checked={useEmbed} onChange={e => setUseEmbed(e.target.checked)} className="rounded" />
            Use Discord embed (adds title + accent color)
          </label>

          {useEmbed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-4 border-l-2 border-indigo-700">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Embed Title</label>
                <input
                  value={form.embedTitle || ''}
                  onChange={e => setForm(prev => ({ ...prev, embedTitle: e.target.value }))}
                  placeholder="Optional embed title"
                  className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Embed Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={form.embedColor ?? 16731469}
                    onChange={e => setForm(prev => ({ ...prev, embedColor: parseInt(e.target.value) || 16731469 }))}
                    className="flex-1 bg-[#202225] border border-gray-700 rounded p-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <div
                    className="w-8 h-8 rounded border border-gray-600 flex-shrink-0"
                    style={{ backgroundColor: `#${((form.embedColor ?? 16731469)).toString(16).padStart(6, '0')}` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Image */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Image (optional)</label>
            <div className="flex gap-2 mb-2">
              {(['url', 'file'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setImageMode(mode)}
                  className={`text-xs px-3 py-1 rounded transition-colors ${
                    imageMode === mode ? 'bg-indigo-600 text-white' : 'bg-[#202225] text-gray-400 hover:text-white'
                  }`}
                >
                  {mode === 'url' ? 'URL' : 'Upload File'}
                </button>
              ))}
            </div>
            {imageMode === 'url' ? (
              <input
                value={form.imageUrl || ''}
                onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value, imageData: '', imageFilename: '' }))}
                placeholder="https://example.com/image.png"
                className="w-full bg-[#202225] border border-gray-700 rounded p-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="text-sm text-gray-400 file:mr-2 file:px-3 file:py-1 file:rounded file:bg-indigo-600 file:text-white file:border-0 file:text-xs hover:file:bg-indigo-700 cursor-pointer"
                />
                {form.imageData && (
                  <span className="text-xs text-green-400">✓ {form.imageFilename}</span>
                )}
              </div>
            )}
            {(form.imageUrl || form.imageData) && (
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, imageUrl: '', imageData: '', imageFilename: '' }))}
                className="text-xs text-red-400 hover:text-red-200 mt-1"
              >
                Remove image
              </button>
            )}
          </div>

          {/* Role Tags */}
          {(() => {
            const roles = getAvailableRoles(settings);
            if (roles.length === 0) return (
              <p className="text-xs text-gray-500 italic">Configure roles in Settings to enable role tagging.</p>
            );
            return (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tag Roles (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {roles.map(role => {
                    const isSelected = (form.roleMentions || []).some(r => r.id === role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          roleMentions: isSelected
                            ? (prev.roleMentions || []).filter(r => r.id !== role.id)
                            : [...(prev.roleMentions || []), { id: role.id, name: role.name }]
                        }))}
                        title={role.source !== 'Default' ? `${role.source} override` : 'Default role'}
                        className={`text-xs px-3 py-1 rounded transition-colors border ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                            : 'bg-[#202225] border-gray-600 text-gray-400 hover:text-white'
                        }`}
                      >
                        @{role.name}
                        {role.source !== 'Default' && <span className="ml-1 opacity-50 text-[10px]">({role.source})</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
            >
              {editingId ? 'Save Changes' : 'Schedule Message'}
            </button>
          </div>
        </div>
      )}

      {/* Messages List */}
      {messages.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border border-dashed border-gray-700 rounded-lg">
          No scheduled messages yet. Click "New Message" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`bg-[#2f3136] rounded-lg border p-4 transition-opacity ${
                msg.isSent ? 'border-gray-700 opacity-60' : 'border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Status + meta row */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      msg.isSent
                        ? 'bg-gray-700 text-gray-400'
                        : 'bg-indigo-900/50 text-indigo-300 border border-indigo-700'
                    }`}>
                      {msg.isSent ? '✓ Sent' : '⏰ Scheduled'}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} /> {formatDisplayTime(msg.scheduledTime)}
                    </span>
                    {(msg.imageUrl || msg.imageData) && (
                      <span className="text-xs text-purple-400 flex items-center gap-1">
                        <ImageIcon size={10} /> Image
                      </span>
                    )}
                    {msg.roleMentions.length > 0 && msg.roleMentions.map(r => (
                      <span key={r.id} className="text-xs bg-[#414653]/50 text-[#c9cdfb] px-1.5 py-0.5 rounded">
                        @{r.name}
                      </span>
                    ))}
                  </div>

                  {/* Content preview */}
                  {msg.embedTitle && (
                    <div className="text-sm font-bold text-white mb-0.5">{msg.embedTitle}</div>
                  )}
                  {msg.content && (
                    <div className="text-sm text-gray-300 truncate">{msg.content}</div>
                  )}
                  {msg.imageUrl && (
                    <div className="text-xs text-blue-400 truncate mt-0.5">{msg.imageUrl}</div>
                  )}
                  {msg.imageData && !msg.imageUrl && (
                    <div className="text-xs text-purple-400 mt-0.5">📎 {msg.imageFilename || 'uploaded image'}</div>
                  )}
                </div>

                {!msg.isSent && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(msg)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="p-1.5 text-red-400 hover:bg-gray-700 rounded"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScheduledMessages;
