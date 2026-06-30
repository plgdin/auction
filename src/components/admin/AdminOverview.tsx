import { useEffect, useState } from 'react';
import { Users, Gavel, FileText, Activity, ShieldAlert, BarChart3, Clock } from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { AuditLog } from '../../types/database.types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function AdminOverview() {
  const [analytics, setAnalytics] = useState({ totalUsers: 0, activeListings: 0, upcomingAuctions: 0 });
  const [categoryStats, setCategoryStats] = useState<{ currentTotals: {name: string, count: number}[], historicalTotals: {name: string, count: number}[], daily: any[] }>({ currentTotals: [], historicalTotals: [], daily: [] });
  const [totalsTab, setTotalsTab] = useState<'current' | 'history'>('current');
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | 'all' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [analyticsData, logsData, catData] = await Promise.all([
        adminService.getGlobalAnalytics(),
        adminService.getAuditLogs(10), // Get top 10 recent logs
        adminService.getCategoryAnalytics()
      ]);
      setAnalytics({
        totalUsers: analyticsData.totalUsers,
        activeListings: analyticsData.activeListings || 0,
        upcomingAuctions: analyticsData.upcomingAuctions || 0
      });
      setLogs(logsData);
      setCategoryStats(catData);
      setIsLoading(false);
    }
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Filter logic
  const now = new Date();
  const filterDate = new Date();
  if (dateFilter === '7d') filterDate.setDate(now.getDate() - 7);
  if (dateFilter === '30d') filterDate.setDate(now.getDate() - 30);

  const filteredDaily = categoryStats.daily.filter(d => {
    if (dateFilter === 'all') return true;
    
    const dDate = new Date(d.date);
    if (dateFilter === 'custom') {
      if (customStartDate && dDate < new Date(customStartDate)) return false;
      if (customEndDate && dDate > new Date(customEndDate)) return false;
      return true;
    }
    
    return dDate >= filterDate;
  });

  const filteredTotalsMap: Record<string, number> = {};
  filteredDaily.forEach(day => {
    Object.keys(day).forEach(key => {
      if (key !== 'date') {
        filteredTotalsMap[key] = (filteredTotalsMap[key] || 0) + day[key];
      }
    });
  });

  const filteredTotals = Object.entries(filteredTotalsMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Define some colors for the chart bars
  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const getDisplayTotals = () => {
    if (totalsTab === 'current') return categoryStats.currentTotals;
    return dateFilter === 'all' ? categoryStats.historicalTotals : filteredTotals;
  };
  
  const displayTotals = getDisplayTotals();
  const topCategories = (dateFilter === 'all' ? categoryStats.historicalTotals : filteredTotals).slice(0, 5).map(t => t.name); // always use history for chart colors

  return (
    <div className="space-y-6">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Total Registered Users</h3>
          <p className="text-3xl font-extrabold text-slate-900">{analytics.totalUsers}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Gavel className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Active Listings</h3>
          <p className="text-3xl font-extrabold text-slate-900">{analytics.activeListings}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Upcoming Auctions</h3>
          <p className="text-3xl font-extrabold text-slate-900">{analytics.upcomingAuctions}</p>
        </div>
      </div>

      {/* Category Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-2 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-primary" /> Category Addition Timeline
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-slate-400 text-sm">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
          
          {filteredDaily.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500">No category timeline data available.</div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredDaily}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend wrapperStyle={{paddingTop: '20px'}} />
                  {topCategories.map((category, index) => (
                    <Bar key={category} dataKey={category} stackId="a" fill={colors[index % colors.length]} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Category Totals List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-primary" /> Total Items by Category
            </h2>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
            <button
              onClick={() => setTotalsTab('current')}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${totalsTab === 'current' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Current Inventory
            </button>
            <button
              onClick={() => setTotalsTab('history')}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${totalsTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              All-Time History
            </button>
          </div>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {displayTotals.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No categories found in this period.</p>
            ) : (
              displayTotals.map((cat, idx) => (
                <div key={cat.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: topCategories.includes(cat.name) ? colors[topCategories.indexOf(cat.name) % colors.length] : '#cbd5e1' }}
                    />
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]" title={cat.name}>
                      {cat.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">
                    {cat.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-primary" /> System Activity Log
          </h2>
        </div>
        
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No recent system activity recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-semibold">Action</th>
                  <th className="px-6 py-4 font-semibold">User ID</th>
                  <th className="px-6 py-4 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{log.action}</p>
                          <p className="text-xs text-slate-500">
                            {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : (log.entity_type ? `${log.entity_type} (${log.entity_id || 'N/A'})` : 'No details available')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {log.user_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
