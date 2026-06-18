import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { AuditLog } from '../../types/database.types';
import { 
  Search, RotateCw, Globe, Clock, User, 
  Terminal, Shield, Eye, Download, LogIn, LogOut, UserPlus
} from 'lucide-react';
import clsx from 'clsx';

export function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Analytics stats
  const [stats, setStats] = useState({
    total: 0,
    logins: 0,
    previews: 0,
    downloads: 0
  });

  const limit = 20;

  const fetchStats = async () => {
    try {
      const { count: total } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true });
      const { count: logins } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'user_login');
      const { count: previews } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'mstc_catalog_preview');
      const { count: downloads } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true }).in('action', ['mstc_catalog_download', 'mstc_catalog_pdf_served']);

      setStats({
        total: total || 0,
        logins: logins || 0,
        previews: previews || 0,
        downloads: downloads || 0
      });
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      // Apply action filter
      if (selectedAction !== 'all') {
        query = query.eq('action', selectedAction);
      }

      // Search by email, IP address, or general action
      if (searchQuery.trim() !== '') {
        const term = searchQuery.trim();
        // Since we store email inside the JSONB details object, we can query details->>email
        query = query.or(`action.ilike.%${term}%,ip_address.ilike.%${term}%,details->>email.ilike.%${term}%`);
      }

      const fromRange = (page - 1) * limit;
      const toRange = fromRange + limit - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(fromRange, toRange);

      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, selectedAction]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const totalPages = Math.ceil(totalCount / limit);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'user_login':
        return <LogIn className="w-4 h-4 text-emerald-500" />;
      case 'user_logout':
        return <LogOut className="w-4 h-4 text-slate-500" />;
      case 'user_register':
        return <UserPlus className="w-4 h-4 text-indigo-500" />;
      case 'mstc_catalog_preview':
        return <Eye className="w-4 h-4 text-blue-500" />;
      case 'mstc_catalog_download':
      case 'mstc_catalog_pdf_served':
        return <Download className="w-4 h-4 text-violet-500" />;
      default:
        return <Terminal className="w-4 h-4 text-amber-500" />;
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'user_login':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'user_logout':
        return 'bg-slate-50 text-slate-600 border-slate-200';
      case 'user_register':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'mstc_catalog_preview':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'mstc_catalog_download':
      case 'mstc_catalog_pdf_served':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-mono text-xs uppercase tracking-wider block">Total Sessions</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.total.toLocaleString()}</span>
          </div>
          <div className="p-3.5 bg-slate-100 text-slate-600 rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-mono text-xs uppercase tracking-wider block">Logins</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.logins.toLocaleString()}</span>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <LogIn className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-mono text-xs uppercase tracking-wider block">Catalog Previews</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.previews.toLocaleString()}</span>
          </div>
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-mono text-xs uppercase tracking-wider block">PDF Downloads</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.downloads.toLocaleString()}</span>
          </div>
          <div className="p-3.5 bg-violet-50 text-violet-600 rounded-xl">
            <Download className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <input
            type="text"
            placeholder="Search by email, action, or IP address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-primary focus:border-primary"
          />
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
        </form>

        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-auto pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-primary focus:border-primary"
          >
            <option value="all">All Actions</option>
            <option value="user_login">Logins</option>
            <option value="user_logout">Logouts</option>
            <option value="user_register">Registrations</option>
            <option value="mstc_catalog_preview">Catalog Previews</option>
            <option value="mstc_catalog_download">Catalog Downloads (UI)</option>
            <option value="mstc_catalog_pdf_served">PDF Downloads (API)</option>
            <option value="page_view">Page Views</option>
          </select>

          <button
            onClick={() => {
              fetchLogs();
              fetchStats();
            }}
            className="p-2 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="Refresh Logs"
          >
            <RotateCw className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-250/70 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Timestamp</th>
                <th className="px-6 py-4 font-bold">Action</th>
                <th className="px-6 py-4 font-bold">User / Email</th>
                <th className="px-6 py-4 font-bold">IP Address</th>
                <th className="px-6 py-4 font-bold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-20">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-slate-400 text-xs font-medium">Fetching Audit Logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-slate-500 font-medium">
                    No activity logs matched your criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const logDate = new Date(log.created_at);
                  const detailEmail = log.details?.email || 'Anonymous';
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {logDate.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border",
                          getActionBadgeClass(log.action)
                        )}>
                          {getActionIcon(log.action)}
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{detailEmail}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          {log.ip_address || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-primary hover:text-primary-750 font-bold text-xs hover:underline cursor-pointer"
                        >
                          {isExpanded ? 'Collapse' : 'Expand Metadata'}
                        </button>
                        {isExpanded && (
                          <div className="mt-3 text-left bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto shadow-inner max-w-lg ml-auto border border-slate-800">
                            <pre className="whitespace-pre-wrap">{JSON.stringify({
                              id: log.id,
                              user_id: log.user_id,
                              entity_type: log.entity_type,
                              entity_id: log.entity_id,
                              details: log.details
                            }, null, 2)}</pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50/75 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} of {totalCount} events
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-lg disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-lg disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
