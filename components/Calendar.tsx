import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, BarChart2, TrendingUp, Send } from 'lucide-react';
import { recapsAPI } from '../services/api';
import { DailyRecap, MonthlyRecap, YearlyRecap, AppSettings } from '../types';
import DayDetailView from './DayDetailView';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

type CalendarView = 'month' | 'monthly-stats' | 'yearly';

interface CalendarProps {
  settings: AppSettings;
  botId?: string;
  onCopy?: (bet: any) => void;
  onRestoreDate?: (date: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const Calendar: React.FC<CalendarProps> = ({ settings, botId, onCopy, onRestoreDate }) => {
  const today = new Date();
  const [view, setView] = useState<CalendarView>('month');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [calendarDays, setCalendarDays] = useState<DailyRecap[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRecap | null>(null);
  const [yearlyData, setYearlyData] = useState<YearlyRecap | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Clear selected date when bot changes so stale day details don't show
  useEffect(() => {
    setSelectedDate(null);
  }, [botId]);

  useEffect(() => {
    if (view === 'month' || view === 'monthly-stats') {
      loadMonthData();
    } else if (view === 'yearly') {
      loadYearData();
    }
  }, [view, year, month, botId]);

  const loadMonthData = async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const [calData, monthData] = await Promise.all([
        recapsAPI.getCalendar(year, month, botId),
        recapsAPI.getMonthly(year, month, botId)
      ]);
      setCalendarDays(calData);
      setMonthlyData(monthData);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadYearData = async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const data = await recapsAPI.getYearly(year, botId);
      setYearlyData(data);
    } catch (err) {
      console.error('Failed to load yearly data:', err);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const sendToDiscord = async (embed: object) => {
    const url = (settings.recapWebhookUrl && settings.recapWebhookUrl.trim())
      ? settings.recapWebhookUrl
      : settings.discordWebhookUrl;
    if (!url) {
      alert('No Webhook URL configured. Add one in Settings.');
      return;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: settings.botName || 'AI BetSlate Automator',
          avatar_url: settings.botAvatarUrl || undefined,
          embeds: [embed]
        })
      });
      if (res.ok) {
        alert('Recap sent to Discord!');
      } else {
        alert('Failed to send recap. Check your webhook URL.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to send recap.');
    }
  };

  const handleSendMonthlyRecap = async () => {
    if (!monthlyData || monthlyData.total_bets === 0) return;
    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: 'Record', value: `${monthlyData.wins}-${monthlyData.losses}-${monthlyData.pushes}`, inline: true },
      { name: 'Net Units', value: `${monthlyData.net_units > 0 ? '+' : ''}${monthlyData.net_units.toFixed(2)}u`, inline: true },
      { name: 'ROI', value: `${monthlyData.roi > 0 ? '+' : ''}${monthlyData.roi.toFixed(1)}%`, inline: true },
    ];
    if (monthlyData.league_breakdown && monthlyData.league_breakdown.length > 0) {
      fields.push({
        name: 'League Breakdown',
        value: monthlyData.league_breakdown
          .map(lb => `${lb.league}: ${lb.units > 0 ? '+' : ''}${lb.units.toFixed(2)}u`)
          .join('\n'),
        inline: false
      });
    }
    await sendToDiscord({
      title: `Monthly Recap - ${MONTH_NAMES[month - 1]} ${year}`,
      color: settings.recapEmbedColor,
      fields,
      footer: { text: `${settings.botName || 'AI BetSlate Automator'} • Auto-Generated` }
    });
  };

  const handleSendYearlyRecap = async () => {
    if (!yearlyData || yearlyData.total_bets === 0) return;
    const monthLines = yearlyData.months
      .map(m => {
        const name = SHORT_MONTH_NAMES[parseInt(m.month.slice(5)) - 1];
        const sign = m.net_units > 0 ? '+' : '';
        return `${name}: ${m.wins}-${m.losses} / ${sign}${m.net_units.toFixed(2)}u`;
      })
      .join('\n');
    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: 'Record', value: `${yearlyData.wins}-${yearlyData.losses}-${yearlyData.pushes}`, inline: true },
      { name: 'Net Units', value: `${yearlyData.net_units > 0 ? '+' : ''}${yearlyData.net_units.toFixed(2)}u`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
    ];
    if (monthLines) {
      fields.push({ name: 'Monthly Breakdown', value: monthLines, inline: false });
    }
    if (yearlyData.league_breakdown && yearlyData.league_breakdown.length > 0) {
      fields.push({
        name: 'League Breakdown',
        value: yearlyData.league_breakdown
          .map(lb => `${lb.league}: ${lb.units > 0 ? '+' : ''}${lb.units.toFixed(2)}u`)
          .join('\n'),
        inline: false
      });
    }
    await sendToDiscord({
      title: `Yearly Recap - ${year}`,
      color: settings.recapEmbedColor,
      fields,
      footer: { text: `${settings.botName || 'AI BetSlate Automator'} • Auto-Generated` }
    });
  };

  // Build calendar grid for the current month
  const buildGrid = () => {
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const recapMap: Record<string, DailyRecap> = {};
    for (const r of calendarDays) {
      recapMap[r.date] = r;
    }
    return { firstDay, daysInMonth, recapMap };
  };

  if (selectedDate) {
    return (
      <DayDetailView
        date={selectedDate}
        settings={settings}
        botId={botId}
        onBack={() => setSelectedDate(null)}
        onCopy={onCopy}
        onRestoreDate={onRestoreDate}
      />
    );
  }

  const { firstDay, daysInMonth, recapMap } = buildGrid();

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="text-white">
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-[#202225] rounded-lg p-1">
          <button
            onClick={() => setView('month')}
            className={`flex items-center px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'month' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <CalendarDays size={14} className="mr-1.5" /> Month
          </button>
          <button
            onClick={() => setView('monthly-stats')}
            className={`flex items-center px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'monthly-stats' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <BarChart2 size={14} className="mr-1.5" /> Monthly Stats
          </button>
          <button
            onClick={() => setView('yearly')}
            className={`flex items-center px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'yearly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <TrendingUp size={14} className="mr-1.5" /> Yearly
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          {view !== 'yearly' && (
            <button onClick={prevMonth} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
              <ChevronLeft size={18} />
            </button>
          )}
          {view !== 'yearly' && (
            <span className="font-semibold text-white min-w-[140px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          )}
          {view === 'yearly' && (
            <>
              <button onClick={() => setYear(y => y - 1)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="font-semibold text-white min-w-[60px] text-center">{year}</span>
              <button onClick={() => setYear(y => y + 1)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                <ChevronRight size={18} />
              </button>
            </>
          )}
          {view !== 'yearly' && (
            <button onClick={nextMonth} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Month Grid View */}
          {view === 'month' && (
            <div>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-xs text-gray-500 font-semibold py-2 uppercase">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const recap = recapMap[dateStr];
                  const isToday = dateStr === todayStr;
                  const isFuture = dateStr > todayStr;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`
                        relative min-h-[70px] p-1.5 rounded-lg border transition-all
                        ${isFuture ? 'border-gray-800 opacity-30' : 'cursor-pointer hover:border-indigo-500'}
                        ${isToday ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 bg-[#2f3136]'}
                        ${recap ? (recap.net_units >= 0 ? 'hover:bg-green-900/10' : 'hover:bg-red-900/10') : 'hover:bg-[#40444b]'}
                      `}
                    >
                      <div className={`text-xs font-bold mb-1 ${isToday ? 'text-indigo-400' : 'text-gray-400'}`}>
                        {day}
                      </div>
                      {recap && (
                        <div className="space-y-0.5">
                          <div className={`text-[10px] font-bold ${recap.net_units >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {recap.wins}-{recap.losses}{recap.pushes > 0 ? `-${recap.pushes}` : ''}
                          </div>
                          <div className={`text-[10px] ${recap.net_units >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                            {recap.net_units > 0 ? '+' : ''}{recap.net_units.toFixed(1)}u
                          </div>
                          <div
                            className={`h-1 rounded-full mt-1 ${recap.net_units >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: '100%', opacity: 0.6 }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Month summary bar */}
              {monthlyData && monthlyData.total_bets > 0 && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#202225] p-3 rounded border-l-4 border-blue-500">
                    <div className="text-gray-400 text-xs uppercase font-bold">Month Bets</div>
                    <div className="text-xl font-bold">{monthlyData.total_bets}</div>
                  </div>
                  <div className="bg-[#202225] p-3 rounded border-l-4 border-green-500">
                    <div className="text-gray-400 text-xs uppercase font-bold">Record</div>
                    <div className="text-xl font-bold">{monthlyData.wins}-{monthlyData.losses}-{monthlyData.pushes}</div>
                  </div>
                  <div className={`bg-[#202225] p-3 rounded border-l-4 ${monthlyData.net_units >= 0 ? 'border-green-400' : 'border-red-400'}`}>
                    <div className="text-gray-400 text-xs uppercase font-bold">Net Units</div>
                    <div className={`text-xl font-bold ${monthlyData.net_units >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {monthlyData.net_units > 0 ? '+' : ''}{monthlyData.net_units.toFixed(2)}u
                    </div>
                  </div>
                  <div className="bg-[#202225] p-3 rounded border-l-4 border-purple-500">
                    <div className="text-gray-400 text-xs uppercase font-bold">ROI</div>
                    <div className={`text-xl font-bold ${monthlyData.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {monthlyData.roi > 0 ? '+' : ''}{monthlyData.roi.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monthly Stats View */}
          {view === 'monthly-stats' && monthlyData && (
            <div>
              {monthlyData.total_bets === 0 ? (
                <div className="text-center py-16 text-gray-500 border border-dashed border-gray-700 rounded">
                  No recap data for {MONTH_NAMES[month - 1]} {year}.
                </div>
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={handleSendMonthlyRecap}
                      className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition-colors"
                    >
                      <Send size={14} className="mr-2" /> Send Monthly Recap to Discord
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-[#202225] p-4 rounded border-l-4 border-blue-500">
                      <div className="text-gray-400 text-xs uppercase font-bold">Total Bets</div>
                      <div className="text-2xl font-bold">{monthlyData.total_bets}</div>
                    </div>
                    <div className="bg-[#202225] p-4 rounded border-l-4 border-green-500">
                      <div className="text-gray-400 text-xs uppercase font-bold">Wins</div>
                      <div className="text-2xl font-bold text-green-400">{monthlyData.wins}</div>
                    </div>
                    <div className="bg-[#202225] p-4 rounded border-l-4 border-red-500">
                      <div className="text-gray-400 text-xs uppercase font-bold">Losses</div>
                      <div className="text-2xl font-bold text-red-400">{monthlyData.losses}</div>
                    </div>
                    <div className={`bg-[#202225] p-4 rounded border-l-4 ${monthlyData.net_units >= 0 ? 'border-green-400' : 'border-red-400'}`}>
                      <div className="text-gray-400 text-xs uppercase font-bold">Net Units</div>
                      <div className={`text-2xl font-bold ${monthlyData.net_units >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {monthlyData.net_units > 0 ? '+' : ''}{monthlyData.net_units.toFixed(2)}u
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-64 mb-8">
                    {monthlyData.total_bets > 0 && (
                      <div className="w-full h-full">
                        <h3 className="text-sm font-semibold text-gray-400 mb-2 text-center">Win/Loss Ratio</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Wins', value: monthlyData.wins, color: '#22c55e' },
                                { name: 'Losses', value: monthlyData.losses, color: '#ef4444' },
                                { name: 'Push', value: monthlyData.pushes, color: '#eab308' }
                              ].filter(d => d.value > 0)}
                              cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none"
                            >
                              {[
                                { name: 'Wins', value: monthlyData.wins, color: '#22c55e' },
                                { name: 'Losses', value: monthlyData.losses, color: '#ef4444' },
                                { name: 'Push', value: monthlyData.pushes, color: '#eab308' }
                              ].filter(d => d.value > 0).map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#202225', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {monthlyData.days.length > 0 && (
                      <div className="w-full h-full">
                        <h3 className="text-sm font-semibold text-gray-400 mb-2 text-center">Net Units by Day</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData.days.map(d => ({ name: d.date.slice(-2), units: d.net_units }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#40444b" vertical={false} />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tick={{ fill: '#9ca3af' }} />
                            <YAxis stroke="#9ca3af" fontSize={10} tick={{ fill: '#9ca3af' }} />
                            <Tooltip cursor={{ fill: '#40444b', opacity: 0.3 }} contentStyle={{ backgroundColor: '#202225', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                            <Bar dataKey="units">
                              {monthlyData.days.map((entry, index) => (
                                <Cell key={index} fill={entry.net_units >= 0 ? '#22c55e' : '#ef4444'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {monthlyData.league_breakdown && monthlyData.league_breakdown.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">League Breakdown</h3>
                      <div className="flex flex-wrap gap-2">
                        {monthlyData.league_breakdown.map(lb => (
                          <span
                            key={lb.league}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                              lb.units >= 0 ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                            }`}
                          >
                            {lb.league}: {lb.units > 0 ? '+' : ''}{lb.units.toFixed(2)}u
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Yearly View */}
          {view === 'yearly' && yearlyData && (
            <div>
              {yearlyData.total_bets === 0 ? (
                <div className="text-center py-16 text-gray-500 border border-dashed border-gray-700 rounded">
                  No recap data for {year}.
                </div>
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={handleSendYearlyRecap}
                      className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition-colors"
                    >
                      <Send size={14} className="mr-2" /> Send Yearly Recap to Discord
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-[#202225] p-4 rounded border-l-4 border-blue-500">
                      <div className="text-gray-400 text-xs uppercase font-bold">Total Bets</div>
                      <div className="text-2xl font-bold">{yearlyData.total_bets}</div>
                    </div>
                    <div className="bg-[#202225] p-4 rounded border-l-4 border-green-500">
                      <div className="text-gray-400 text-xs uppercase font-bold">Record</div>
                      <div className="text-2xl font-bold">{yearlyData.wins}-{yearlyData.losses}</div>
                    </div>
                    <div className={`bg-[#202225] p-4 rounded border-l-4 ${yearlyData.net_units >= 0 ? 'border-green-400' : 'border-red-400'}`}>
                      <div className="text-gray-400 text-xs uppercase font-bold">Net Units</div>
                      <div className={`text-2xl font-bold ${yearlyData.net_units >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {yearlyData.net_units > 0 ? '+' : ''}{yearlyData.net_units.toFixed(2)}u
                      </div>
                    </div>
                    <div className="bg-[#202225] p-4 rounded border-l-4 border-purple-500">
                      <div className="text-gray-400 text-xs uppercase font-bold">Active Months</div>
                      <div className="text-2xl font-bold">{yearlyData.months.length}</div>
                    </div>
                  </div>

                  {/* Month-by-month bar chart */}
                  {yearlyData.months.length > 0 && (
                    <div className="h-64 mb-8">
                      <h3 className="text-sm font-semibold text-gray-400 mb-2 text-center">Net Units by Month</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yearlyData.months.map(m => ({
                          name: SHORT_MONTH_NAMES[parseInt(m.month.slice(5)) - 1],
                          units: m.net_units
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#40444b" vertical={false} />
                          <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tick={{ fill: '#9ca3af' }} />
                          <YAxis stroke="#9ca3af" fontSize={10} tick={{ fill: '#9ca3af' }} />
                          <Tooltip cursor={{ fill: '#40444b', opacity: 0.3 }} contentStyle={{ backgroundColor: '#202225', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                          <Bar dataKey="units">
                            {yearlyData.months.map((entry, index) => (
                              <Cell key={index} fill={entry.net_units >= 0 ? '#22c55e' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Month breakdown table */}
                  <div className="space-y-2 mb-6">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Month Breakdown</h3>
                    {yearlyData.months.map(m => {
                      const monthIdx = parseInt(m.month.slice(5)) - 1;
                      return (
                        <div
                          key={m.month}
                          onClick={() => {
                            setYear(parseInt(m.month.slice(0, 4)));
                            setMonth(parseInt(m.month.slice(5)));
                            setView('monthly-stats');
                          }}
                          className="flex items-center justify-between bg-[#2f3136] hover:bg-[#40444b] p-3 rounded border border-gray-700 cursor-pointer transition-colors"
                        >
                          <span className="font-medium">{MONTH_NAMES[monthIdx]}</span>
                          <div className="flex items-center gap-6 text-sm">
                            <span className="text-gray-400">{m.wins}-{m.losses}-{m.pushes}</span>
                            <span className={`font-bold ${m.net_units >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {m.net_units > 0 ? '+' : ''}{m.net_units.toFixed(2)}u
                            </span>
                            <span className="text-gray-500 text-xs">{m.days_with_recaps} recap{m.days_with_recaps !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {yearlyData.league_breakdown && yearlyData.league_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">League Breakdown (Full Year)</h3>
                      <div className="flex flex-wrap gap-2">
                        {yearlyData.league_breakdown.map(lb => (
                          <span
                            key={lb.league}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                              lb.units >= 0 ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                            }`}
                          >
                            {lb.league}: {lb.units > 0 ? '+' : ''}{lb.units.toFixed(2)}u
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Calendar;
