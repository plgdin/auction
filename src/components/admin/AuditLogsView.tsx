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
  const [userTypeTab, setUserTypeTab] = useState<'registered' | 'unregistered'>('registered');
  const [geoDetails, setGeoDetails] = useState<Record<string, any>>({});
  const [loadingGeo, setLoadingGeo] = useState<Record<string, boolean>>({});
  
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
      let queryTotal = supabase.from('audit_logs').select('*', { count: 'exact', head: true });
      let queryLogins = supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'user_login');
      let queryPreviews = supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'mstc_catalog_preview');
      let queryDownloads = supabase.from('audit_logs').select('*', { count: 'exact', head: true }).in('action', ['mstc_catalog_download', 'mstc_catalog_pdf_served']);

      if (userTypeTab === 'registered') {
        queryTotal = queryTotal.not('user_id', 'is', null);
        queryLogins = queryLogins.not('user_id', 'is', null);
        queryPreviews = queryPreviews.not('user_id', 'is', null);
        queryDownloads = queryDownloads.not('user_id', 'is', null);
      } else {
        queryTotal = queryTotal.is('user_id', null);
        queryLogins = queryLogins.is('user_id', null);
        queryPreviews = queryPreviews.is('user_id', null);
        queryDownloads = queryDownloads.is('user_id', null);
      }

      const [{ count: total }, { count: logins }, { count: previews }, { count: downloads }] = await Promise.all([
        queryTotal,
        queryLogins,
        queryPreviews,
        queryDownloads
      ]);

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

      // Filter by registration status
      if (userTypeTab === 'registered') {
        query = query.not('user_id', 'is', null);
      } else {
        query = query.is('user_id', null);
      }

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
  }, [page, selectedAction, userTypeTab]);

  useEffect(() => {
    fetchStats();
  }, [userTypeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleToggleExpand = async (log: AuditLog) => {
    const isExpanding = expandedLogId !== log.id;
    setExpandedLogId(isExpanding ? log.id : null);
    
    if (isExpanding && log.ip_address && log.ip_address !== 'N/A' && log.ip_address !== '127.0.0.1' && log.ip_address !== '::1') {
      const ip = log.ip_address;
      if (geoDetails[log.id] || loadingGeo[log.id]) return;
      
      setLoadingGeo(prev => ({ ...prev, [log.id]: true }));
      try {
        const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
        if (response.ok) {
          const data = await response.json();
          setGeoDetails(prev => ({
            ...prev,
            [log.id]: {
              city: data.city,
              region: data.region,
              country: data.country_name,
              countryCode: data.country_code
            }
          }));
        }
      } catch (e) {
        console.warn('Geolocation fetch failed for ip:', ip, e);
      } finally {
        setLoadingGeo(prev => ({ ...prev, [log.id]: false }));
      }
    }
  };

  const getGeoLocationText = (log: AuditLog) => {
    const ip = log.ip_address;
    if (!ip || ip === 'N/A') return 'No IP Address';
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return 'Local Network / Loopback';
    }
    
    const geo = geoDetails[log.id];
    if (geo) {
      if (geo.country === 'India' || geo.countryCode === 'IN') {
        return geo.region ? `${geo.region}, India` : 'India';
      }
      if (geo.city && geo.country) {
        return `${geo.city}, ${geo.country}`;
      }
      return geo.country || 'Unknown Location';
    }
    
    if (loadingGeo[log.id]) {
      return 'Fetching location...';
    }
    
    return 'Location Unavailable';
  };

  const renderDetailRow = (label: string, value: any) => {
    if (value === undefined || value === null) return null;
    const displayVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return (
      <div key={label} className="grid grid-cols-3 gap-4 py-2 border-b border-slate-100 last:border-0 text-xs">
        <span className="font-bold text-slate-500 uppercase tracking-wider">{label.replace(/_/g, ' ')}</span>
        <span className="col-span-2 text-slate-800 font-medium break-all">{displayVal}</span>
      </div>
    );
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
      
      {/* Registration Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button 
          onClick={() => {
            setUserTypeTab('registered');
            setPage(1);
          }}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
            userTypeTab === 'registered' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Registered Users
        </button>
        <button 
          onClick={() => {
            setUserTypeTab('unregistered');
            setPage(1);
          }}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
            userTypeTab === 'unregistered' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Unregistered Users
        </button>
      </div>

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
                          onClick={() => handleToggleExpand(log)}
                          className="text-primary hover:text-primary-750 font-bold text-xs hover:underline cursor-pointer"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                        {isExpanded && (
                          <div className="mt-4 p-5 text-left bg-slate-50 border border-slate-200 rounded-2xl shadow-inner max-w-2xl ml-auto animate-fade-in">
                            <h4 className="text-xs font-black text-slate-900 tracking-wider uppercase mb-3 pb-1.5 border-b border-slate-200">
                              Activity Log Details
                            </h4>
                            
                            <div className="space-y-3">
                              {/* Metadata columns */}
                              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-200/60">
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Log ID</span>
                                  <span className="text-xs font-semibold text-slate-700 font-mono break-all">{log.id}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">User ID</span>
                                  <span className="text-xs font-semibold text-slate-700 font-mono break-all">{log.user_id || 'Anonymous / Guest'}</span>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-200/60">
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entity Info</span>
                                  <span className="text-xs font-semibold text-slate-700 font-mono">
                                    {log.entity_type ? `${log.entity_type} (${log.entity_id || 'No ID'})` : 'None'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location / IP</span>
                                  <span className="text-xs font-semibold text-slate-700 block font-mono">
                                    {log.ip_address || 'N/A'}
                                  </span>
                                  <span className="text-[11px] font-bold text-primary block mt-0.5">
                                    {getGeoLocationText(log)}
                                  </span>
                                </div>
                              </div>

                              {/* Custom payload details */}
                              {log.details && Object.keys(log.details).length > 0 ? (
                                <div className="pt-1">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payload Data</span>
                                  <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 divide-y divide-slate-100">
                                    {Object.entries(log.details).map(([key, val]) => renderDetailRow(key, val))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 font-semibold italic pt-1">
                                  No additional payload data recorded.
                                </div>
                              )}
                            </div>
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
