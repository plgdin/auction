import { useEffect, useState } from 'react';
import { Users, Gavel, Activity, ShieldAlert, Clock } from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { AuditLog } from '../../types/database.types';

export function AdminOverview() {
  const [analytics, setAnalytics] = useState({ totalUsers: 0, activeListings: 0, upcomingAuctions: 0 });
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [analyticsData, logsData] = await Promise.all([
        adminService.getGlobalAnalytics(),
        adminService.getAuditLogs(10) // Get top 10 recent logs
      ]);
      setAnalytics({
        totalUsers: analyticsData.totalUsers,
        activeListings: analyticsData.activeListings || 0,
        upcomingAuctions: analyticsData.upcomingAuctions || 0
      });
      setLogs(logsData);
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
