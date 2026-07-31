import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { auctionService } from '../../services/auctionService';
import { dashboardService } from '../../services/dashboardService';
import type { ReminderSetting } from '../../services/dashboardService';
import { Bell, BellOff, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import type { Auction } from '../../types/database.types';
import { toast } from 'react-hot-toast';

type AuctionWithMstc = Auction & { reference_number?: string; raw_materials_text?: string };

import { MstcSearchService } from '../../services/publicService';
import type { MstcSanitizedAuction } from '../../services/publicService';

export function Reminders() {
  const { user } = useAuthStore();
  const [watchlist, setWatchlist] = useState<AuctionWithMstc[]>([]);
  const [reminders, setReminders] = useState<ReminderSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      setIsLoading(true);
      try {
        const wIds = await auctionService.getUserWatchlistIds(user.id);
        let standardAuctions: AuctionWithMstc[] = [];
        if (wIds.length > 0) {
          const auctions = await Promise.all(
            wIds.map(id => auctionService.getAuctionById(id))
          );
          standardAuctions = auctions.filter((a): a is Auction => a !== null);
        }

        const mstcIds = dashboardService.getInterestedAuctions(user.id);
        let mstcAuctions: AuctionWithMstc[] = [];
        if (mstcIds.length > 0) {
          const items = await Promise.all(
            mstcIds.map(id => MstcSearchService.getMstcAuctionById(id))
          );
          mstcAuctions = items
            .filter((item): item is MstcSanitizedAuction => item !== null)
            .map(item => ({
              id: item.id,
              title: `${item.mstc_auction_number} (${item.category_name || 'Government Lot'})`,
              description: item.raw_materials_text || '',
              category_id: '',
              seller_id: item.seller_name,
              status: 'active' as any,
              starting_price: 0,
              bid_increment: 0,
              emd_amount: 0,
              start_time: item.opening_date,
              end_time: item.closing_date,
              reference_number: item.mstc_auction_number,
              raw_materials_text: item.raw_materials_text || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));
        }

        setWatchlist([...standardAuctions, ...mstcAuctions]);
        setReminders(dashboardService.getReminderSettings(user.id));
      } catch (err) {
        console.error('Failed to load reminders data', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleReminderSettingsChange = (
    auctionId: string,
    timeValue: number,
    timeUnit: 'minutes' | 'hours' | 'days',
    remindersCount: number,
    enabled: boolean
  ) => {
    if (!user?.id) return;
    dashboardService.updateReminderSettings(user.id, auctionId, timeValue, timeUnit, remindersCount, enabled);
    setReminders(dashboardService.getReminderSettings(user.id));
    toast.success(enabled ? `Reminder configured successfully` : 'Reminder disabled');
  };

  // Helper to get active setting for an auction
  const getSettingForAuction = (auctionId: string): ReminderSetting => {
    return reminders.find(r => r.auctionId === auctionId) || { 
      auctionId, 
      daysPrior: 2, 
      enabled: false,
      timeValue: 2,
      timeUnit: 'days',
      remindersCount: 1
    };
  };

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Helper to parse MSTC custom dates (DD-MM-YYYY etc)
  const parseMstcDateString = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const match = dateStr.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  };

  // Extract start, end, and inspection dates for an auction
  const getAuctionCalendarDates = (a: AuctionWithMstc) => {
    let auctionStart = new Date(a.start_time);
    let auctionEnd = new Date(a.end_time);
    let inspectionStart: Date | null = null;
    let inspectionEnd: Date | null = null;

    if (a.raw_materials_text) {
      try {
        const parsed = JSON.parse(a.raw_materials_text);
        if (parsed) {
          const schedule = parsed.inspectionSchedule;
          if (schedule) {
            const dates = schedule.match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g);
            if (dates && dates.length === 2) {
              inspectionStart = parseMstcDateString(dates[0]);
              inspectionEnd = parseMstcDateString(dates[1]);
            }
          }
          if (parsed.auctionStartTime) {
            const match = parsed.auctionStartTime.trim().match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
            if (match) {
              const startD = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10), parseInt(match[4], 10), parseInt(match[5], 10));
              if (!isNaN(startD.getTime())) auctionStart = startD;
            }
          }
          if (parsed.auctionCloseTime) {
            const match = parsed.auctionCloseTime.trim().match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
            if (match) {
              const closeD = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10), parseInt(match[4], 10), parseInt(match[5], 10));
              if (!isNaN(closeD.getTime())) auctionEnd = closeD;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!inspectionStart || !inspectionEnd) {
      inspectionStart = new Date(auctionStart.getTime() - 14 * 24 * 60 * 60 * 1000);
      inspectionEnd = new Date(auctionStart.getTime() - 1 * 24 * 60 * 60 * 1000);
    }

    return { auctionStart, auctionEnd, inspectionStart, inspectionEnd };
  };

  interface CalendarEvent {
    id: string;
    title: string;
    type: 'auction_start' | 'auction_end' | 'inspection_start' | 'inspection_end';
    date: Date;
    colorClass: string;
    icon: string;
  }

  // Pre-calculate all events from the watchlist
  const getCalendarEvents = (): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    watchlist.forEach(a => {
      const { auctionStart, auctionEnd, inspectionStart, inspectionEnd } = getAuctionCalendarDates(a);
      
      // Auction events
      events.push({
        id: `${a.id}-start`,
        title: a.title,
        type: 'auction_start',
        date: auctionStart,
        colorClass: 'bg-blue-100 border-blue-200 text-blue-800',
        icon: '▶'
      });
      
      events.push({
        id: `${a.id}-end`,
        title: a.title,
        type: 'auction_end',
        date: auctionEnd,
        colorClass: 'bg-amber-100 border-amber-200 text-amber-800',
        icon: '■'
      });

      // Only push inspection start and end events
      if (inspectionStart) {
        events.push({
          id: `${a.id}-insp-start`,
          title: a.title,
          type: 'inspection_start',
          date: inspectionStart,
          colorClass: 'bg-purple-100 border-purple-200 text-purple-800',
          icon: '🔍'
        });
      }

      if (inspectionEnd) {
        events.push({
          id: `${a.id}-insp-end`,
          title: a.title,
          type: 'inspection_end',
          date: inspectionEnd,
          colorClass: 'bg-indigo-100 border-indigo-200 text-indigo-800',
          icon: '⌛'
        });
      }
    });
    return events;
  };

  // Find events for a specific calendar date (day)
  const getEventsForDate = (day: number) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return getCalendarEvents().filter(e => e.date.toDateString() === d.toDateString());
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayIndex = getFirstDayOfMonth(currentDate);
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const cells: React.ReactNode[] = [];

    // Empty cells for padding before first day
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100 opacity-50"></div>);
    }

    // Days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = getEventsForDate(day);
      const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
      
      cells.push(
        <div 
          key={`day-${day}`} 
          className={`h-24 p-2 border border-slate-100 flex flex-col justify-start items-start hover:bg-slate-50 transition-colors ${isToday ? 'bg-primary/5 border-primary/30' : 'bg-white'}`}
        >
          <span className={`text-xs font-bold mb-1 ${isToday ? 'w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center' : 'text-slate-700'}`}>
            {day}
          </span>
          <div className="space-y-1 overflow-y-auto flex-grow custom-scrollbar mt-1 w-full">
            {dayEvents.map(e => {
              const prefix = e.type === 'auction_start' 
                ? 'Opens' 
                : e.type === 'auction_end' 
                ? 'Closes' 
                : e.type === 'inspection_start' 
                ? 'Insp Start' 
                : e.type === 'inspection_end'
                ? 'Insp End'
                : 'Insp';
              return (
                <div 
                  key={e.id} 
                  className={`text-[9px] px-1 py-0.5 rounded truncate font-bold border flex items-center gap-1 w-full ${e.colorClass}`}
                  title={`${e.title} (${prefix})`}
                >
                  <span className="shrink-0">{e.icon}</span>
                  <span className="truncate">{prefix}: {e.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-2 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="p-2 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days labels */}
        <div className="grid grid-cols-7 text-center bg-slate-50 border-b border-slate-100 py-2">
          {dayLabels.map(label => (
            <span key={label} className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
          ))}
        </div>

        {/* Grid Cells */}
        <div className="grid grid-cols-7">
          {cells}
        </div>
      </div>
    );
  };

  const getUpcomingReminders = () => {
    const list: { auction: Auction; date: Date; timeDiffMs: number; label: string; text: string }[] = [];
    const now = new Date();

    watchlist.forEach(a => {
      const setting = getSettingForAuction(a.id);
      if (!setting.enabled) return;

      const endTime = new Date(a.end_time);
      const timeDiffMs = endTime.getTime() - now.getTime();
      if (timeDiffMs <= 0) return; // Already ended

      // Calculate the configured time value in milliseconds
      const timeUnit = setting.timeUnit ?? 'days';
      const timeValue = setting.timeValue ?? setting.daysPrior ?? 2;
      
      let configMs = 0;
      if (timeUnit === 'minutes') configMs = timeValue * 60 * 1000;
      else if (timeUnit === 'hours') configMs = timeValue * 60 * 60 * 1000;
      else configMs = timeValue * 24 * 60 * 60 * 1000;

      // Show alert if the time remaining is less than or equal to the configured trigger time
      if (timeDiffMs <= configMs) {
        // Human readable time remaining
        let remainingLabel = '';
        const minutesRemaining = Math.ceil(timeDiffMs / (60 * 1000));
        if (minutesRemaining < 60) {
          remainingLabel = `Closing in ${minutesRemaining}m!`;
        } else {
          const hoursRemaining = Math.ceil(timeDiffMs / (60 * 60 * 1000));
          if (hoursRemaining < 24) {
            remainingLabel = `Closing in ${hoursRemaining}h!`;
          } else {
            const daysRemaining = Math.ceil(timeDiffMs / (24 * 60 * 60 * 1000));
            remainingLabel = `Closing in ${daysRemaining}d!`;
          }
        }

        const frequencyText = setting.remindersCount && setting.remindersCount > 1 
          ? `(Set to remind ${setting.remindersCount} times)`
          : '';

        list.push({
          auction: a,
          date: endTime,
          timeDiffMs,
          label: remainingLabel,
          text: `Reminder: "${a.title}" closes on ${endTime.toLocaleDateString()} at ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ${frequencyText}`
        });
      }
    });

    return list.sort((a, b) => a.timeDiffMs - b.timeDiffMs);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Interested Calendar & Reminders</h1>
        <p className="text-slate-500">View upcoming bidding schedules and setup custom notifications before interested auctions close.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Calendar */}
          <div className="lg:col-span-2 space-y-6">
            {renderCalendar()}
            
            {/* Calendar Legend */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 px-3 bg-slate-50 py-3 rounded-lg border border-slate-200">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-200 inline-block"></span> Auction Opens</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-200 inline-block"></span> Auction Closes</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-purple-100 border border-purple-200 inline-block"></span> Inspection Starts</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-100 border border-indigo-200 inline-block"></span> Inspection Ends</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-primary/20 border border-primary inline-block"></span> Today's Date</span>
            </div>
          </div>

          {/* Right Col: Reminder Settings and Active Alerts */}
          <div className="space-y-6">
            {/* Active Alerts */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 flex items-center mb-4">
                <Bell className="w-5 h-5 mr-2 text-primary animate-swing" />
                Active Alerts
              </h2>
              {getUpcomingReminders().length === 0 ? (
                <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm">No active alerts at the moment.</p>
                  <p className="text-xs text-slate-400 mt-1">Enable notifications below to see alert feeds.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getUpcomingReminders().map((reminder, idx) => (
                    <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                        !
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-800">{reminder.label}</p>
                        <p className="text-sm text-slate-700 font-medium mt-0.5 leading-snug">{reminder.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Alert Settings */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Notification Settings</h2>
              {watchlist.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">Your interested list is empty.</p>
                  <p className="text-xs mt-1">Add items to interested list to set alerts.</p>
                </div>
              ) : (
                <div className="space-y-4 divide-y divide-slate-100">
                  {watchlist.map((item, idx) => {
                    const setting = getSettingForAuction(item.id);
                    return (
                      <div key={item.id} className={`pt-4 ${idx === 0 ? 'pt-0' : ''}`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-slate-900 truncate" title={item.title}>
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">REF: {item.reference_number}</p>
                            
                            {/* Auction and Inspection Date display */}
                            {(() => {
                              const { auctionStart, auctionEnd, inspectionStart, inspectionEnd } = getAuctionCalendarDates(item);
                              return (
                                <div className="mt-2 space-y-1 text-[11px] text-slate-600 font-medium bg-slate-50/50 p-2 rounded border border-slate-100">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] w-16">Auction:</span>
                                    <span>{auctionStart.toLocaleDateString()} {auctionStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} to {auctionEnd.toLocaleDateString()} {auctionEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] w-16">Inspection:</span>
                                    <span>{inspectionStart ? `${inspectionStart.toLocaleDateString()} to ${inspectionEnd ? inspectionEnd.toLocaleDateString() : 'N/A'}` : 'N/A'}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          
                          <button
                            onClick={() => {
                              const tVal = setting.timeValue ?? setting.daysPrior ?? 2;
                              const tUnit = setting.timeUnit ?? 'days';
                              const rCount = setting.remindersCount ?? 1;
                              handleReminderSettingsChange(item.id, tVal, tUnit, rCount, !setting.enabled);
                            }}
                            className={`flex items-center px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                              setting.enabled
                                ? 'bg-primary/10 border-primary text-primary hover:bg-primary/20'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {setting.enabled ? (
                              <>
                                <Bell className="w-3.5 h-3.5 mr-1" />
                                On
                              </>
                            ) : (
                              <>
                                <BellOff className="w-3.5 h-3.5 mr-1" />
                                Off
                              </>
                            )}
                          </button>
                        </div>
                        
                        {setting.enabled && (
                          <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium">Remind me:</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={setting.timeValue ?? setting.daysPrior ?? 2}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    handleReminderSettingsChange(
                                      item.id,
                                      val,
                                      setting.timeUnit ?? 'days',
                                      setting.remindersCount ?? 1,
                                      true
                                    );
                                  }}
                                  className="w-12 text-center border border-slate-200 rounded bg-white px-1 py-0.5 font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <select
                                  value={setting.timeUnit ?? 'days'}
                                  onChange={(e) => {
                                    handleReminderSettingsChange(
                                      item.id,
                                      setting.timeValue ?? setting.daysPrior ?? 2,
                                      e.target.value as 'minutes' | 'hours' | 'days',
                                      setting.remindersCount ?? 1,
                                      true
                                    );
                                  }}
                                  className="border border-slate-200 rounded bg-white px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                                >
                                  <option value="minutes">Mins</option>
                                  <option value="hours">Hours</option>
                                  <option value="days">Days</option>
                                </select>
                                <span className="text-slate-500 font-medium">prior</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium">Frequency:</span>
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={setting.remindersCount ?? 1}
                                  onChange={(e) => {
                                    handleReminderSettingsChange(
                                      item.id,
                                      setting.timeValue ?? setting.daysPrior ?? 2,
                                      setting.timeUnit ?? 'days',
                                      parseInt(e.target.value) || 1,
                                      true
                                    );
                                  }}
                                  className="border border-slate-200 rounded bg-white px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                                >
                                  <option value={1}>1 time</option>
                                  <option value={2}>2 times</option>
                                  <option value={3}>3 times</option>
                                  <option value={5}>5 times</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
