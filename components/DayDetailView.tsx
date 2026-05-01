import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { recapsAPI } from '../services/api';
import { Bet, DailyRecap, AppSettings } from '../types';
import BetCard from './BetCard';

interface DayDetailViewProps {
  date: string;
  settings: AppSettings;
  botId?: string;
  onBack: () => void;
  onCopy?: (bet: Bet) => void;
  onRestoreDate?: (date: string) => void;
}

const DayDetailView: React.FC<DayDetailViewProps> = ({ date, settings, botId, onBack, onCopy, onRestoreDate }) => {
  const [recap, setRecap] = useState<DailyRecap | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!botId) return;
        const data = await recapsAPI.getDaily(date, botId);
        setRecap(data.recap);
        setBets((data.bets ?? []).slice().sort((a: Bet, b: Bet) => Number(a.timestamp) - Number(b.timestamp)));
      } catch (err) {
        console.error('Failed to load day detail:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [date]);

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const noOp = async () => {};

  const handleRestore = () => {
    if (onRestoreDate) {
      onRestoreDate(date);
    }
  };

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Calendar
        </button>
        {onRestoreDate && (
          <button
            onClick={handleRestore}
            className="flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors"
            title="Load this day into History & Stats tab to edit or re-send"
          >
            <RotateCcw size={12} className="mr-1.5" /> Restore to History & Stats
          </button>
        )}
      </div>

      <h2 className="text-xl font-bold mb-6">{displayDate}</h2>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <>
          {recap ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#202225] p-4 rounded border-l-4 border-blue-500">
                <div className="text-gray-400 text-xs uppercase font-bold">Record</div>
                <div className="text-2xl font-bold">
                  {recap.wins}-{recap.losses}-{recap.pushes}
                </div>
              </div>
              <div className="bg-[#202225] p-4 rounded border-l-4 border-green-500">
                <div className="text-gray-400 text-xs uppercase font-bold">Wins</div>
                <div className="text-2xl font-bold text-green-400">{recap.wins}</div>
              </div>
              <div className="bg-[#202225] p-4 rounded border-l-4 border-red-500">
                <div className="text-gray-400 text-xs uppercase font-bold">Losses</div>
                <div className="text-2xl font-bold text-red-400">{recap.losses}</div>
              </div>
              <div
                className={`bg-[#202225] p-4 rounded border-l-4 ${
                  recap.net_units >= 0 ? 'border-green-400' : 'border-red-400'
                }`}
              >
                <div className="text-gray-400 text-xs uppercase font-bold">Net Units</div>
                <div
                  className={`text-2xl font-bold ${
                    recap.net_units >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {recap.net_units > 0 ? '+' : ''}
                  {recap.net_units.toFixed(2)}u
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#202225] border border-dashed border-gray-700 rounded p-6 mb-8 text-center text-gray-500 text-sm">
              No recap was sent for this day. Individual bets are shown below.
            </div>
          )}

          {recap && recap.league_breakdown && recap.league_breakdown.length > 0 && (
            <div className="bg-[#2f3136] rounded p-4 mb-6 border border-gray-700">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                League Breakdown
              </h3>
              <div className="flex flex-wrap gap-2">
                {recap.league_breakdown.map((lb) => (
                  <span
                    key={lb.league}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      lb.units >= 0
                        ? 'bg-green-900/40 text-green-300'
                        : 'bg-red-900/40 text-red-300'
                    }`}
                  >
                    {lb.league}: {lb.units > 0 ? '+' : ''}
                    {lb.units.toFixed(2)}u
                  </span>
                ))}
              </div>
            </div>
          )}

          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">
            Bets ({bets.length})
          </h3>

          {bets.length === 0 ? (
            <div className="text-center py-10 text-gray-500 border border-dashed border-gray-700 rounded">
              No bets found with a slateDate of {date}.
            </div>
          ) : (
            <div className="space-y-2">
              {bets.map((bet) => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  settings={settings}
                  onUpdate={async () => {}}
                  onDelete={async () => {}}
                  onCopy={onCopy ?? (() => {})}
                  onPostToDiscord={async () => false}
                  readOnly
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DayDetailView;
