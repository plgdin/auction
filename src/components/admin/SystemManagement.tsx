// @ts-nocheck
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Megaphone, Plus, Save, Clock, CheckCircle2, ShieldAlert, Eye, X, Globe2, Monitor, Smartphone, Wifi, MapPin, UserRound } from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { Announcement } from '../../types/database.types';

const announcementSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

const directMessageSchema = z.object({
  userId: z.string().min(10, 'Valid User ID required'),
  title: z.string().min(5, 'Title required'),
  message: z.string().min(10, 'Message required'),
});

type AnnouncementValues = z.infer<typeof announcementSchema>;
type DirectMessageValues = z.infer<typeof directMessageSchema>;

function detectBrowser(userAgent = '') {
  if (userAgent.includes('Edg/')) return 'Microsoft Edge';
  if (userAgent.includes('Chrome/')) return 'Chrome';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Safari';
  return 'Unknown';
}

function detectOs(userAgent = '', platform = '') {
  const source = `${userAgent} ${platform}`.toLowerCase();
  if (source.includes('windows')) return 'Windows';
  if (source.includes('android')) return 'Android';
  if (source.includes('iphone') || source.includes('ipad') || source.includes('ios')) return 'iOS';
  if (source.includes('mac')) return 'macOS';
  if (source.includes('linux')) return 'Linux';
  return platform || 'Unknown';
}

function detectDevice(userAgent = '', maxTouchPoints = 0) {
  const source = userAgent.toLowerCase();
  if (source.includes('mobile') || source.includes('iphone') || source.includes('android')) return 'Mobile';
  if (source.includes('ipad') || source.includes('tablet')) return 'Tablet';
  return maxTouchPoints > 1 ? 'Touch desktop/tablet' : 'Desktop';
}

function DetailItem({ label, value }: { label: string; value: any }) {
  const displayValue = value === undefined || value === null || value === '' ? 'Unknown' : String(value);
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-xs font-semibold text-slate-700">{displayValue}</dd>
    </div>
  );
}

function capturedValue(value: any) {
  return value === undefined || value === null || value === '' ? 'Not captured' : value;
}

async function fetchIpGeoDetails(ipAddress: string) {
  if (!ipAddress || ipAddress === 'Unknown') return null;

  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ipAddress)}/json/`);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      city: data.city,
      region: data.region,
      country: data.country_name,
      countryCode: data.country_code,
      postal: data.postal,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      org: data.org,
      asn: data.asn
    };
  } catch (_) {
    return null;
  }
}

export function SystemManagement() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'announcements' | 'direct' | 'maintenance' | 'security'>('announcements');
  const [dmSuccess, setDmSuccess] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [isUpdatingMaintenance, setIsUpdatingMaintenance] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedSecurityLog, setSelectedSecurityLog] = useState<any | null>(null);
  const [isEnrichingLog, setIsEnrichingLog] = useState(false);

  const { register: registerAnnounce, handleSubmit: handleAnnounceSubmit, reset: resetAnnounce, formState: { errors: errorsAnnounce } } = useForm<AnnouncementValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { priority: 'normal' }
  });

  const { register: registerDm, handleSubmit: handleDmSubmit, reset: resetDm, formState: { errors: errorsDm } } = useForm<DirectMessageValues>({
    resolver: zodResolver(directMessageSchema)
  });

  const loadAnnouncements = async () => {
    const data = await adminService.getActiveAnnouncements();
    setAnnouncements(data);
  };

  const loadMaintenanceState = async () => {
    const { publicService } = await import('../../services/publicService');
    const state = await publicService.getMaintenanceMode();
    setMaintenanceEnabled(state);
  };

  const loadSecurityLogs = async () => {
    setIsLoadingLogs(true);
    const data = await adminService.getSecurityLogs(50);
    setSecurityLogs(data);
    setIsLoadingLogs(false);
  };

  useEffect(() => {
    loadAnnouncements();
    loadMaintenanceState();
  }, []);

  useEffect(() => {
    if (activeTab === 'security') {
      loadSecurityLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!selectedSecurityLog) return;

    const sys = selectedSecurityLog.system_info || {};
    const geo = sys.geo || {};
    const needsGeoDetails = !geo.asn || !geo.latitude || !geo.longitude || !geo.timezone;
    if (!needsGeoDetails) return;

    let isMounted = true;
    setIsEnrichingLog(true);

    fetchIpGeoDetails(selectedSecurityLog.ip_address)
      .then((freshGeo) => {
        if (!isMounted || !freshGeo) return;

        setSelectedSecurityLog((current: any) => {
          if (!current || current.id !== selectedSecurityLog.id) return current;
          return {
            ...current,
            system_info: {
              ...(current.system_info || {}),
              geo: {
                ...((current.system_info || {}).geo || {}),
                ...freshGeo
              }
            }
          };
        });
      })
      .finally(() => {
        if (isMounted) setIsEnrichingLog(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSecurityLog?.id]);

  const handleToggleMaintenance = async () => {
    setIsUpdatingMaintenance(true);
    const success = await adminService.toggleMaintenanceMode(!maintenanceEnabled);
    if (success) {
      setMaintenanceEnabled(!maintenanceEnabled);
    }
    setIsUpdatingMaintenance(false);
  };

  const onAnnounceSubmit = async (data: AnnouncementValues) => {
    setIsSubmitting(true);
    const newAnnouncement = await adminService.publishAnnouncement({
      title: data.title,
      content: data.content,
      priority: data.priority,
      is_published: true,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Valid for 30 days
    });

    if (newAnnouncement) {
      resetAnnounce();
      setIsCreating(false);
      loadAnnouncements();
    }
    setIsSubmitting(false);
  };

  const onDmSubmit = async (data: DirectMessageValues) => {
    setIsSubmitting(true);
    setDmSuccess(false);
    
    const notification = await adminService.sendNotification({
      user_id: data.userId,
      title: data.title,
      message: data.message,
      is_read: false
    });

    if (notification) {
      setDmSuccess(true);
      resetDm();
      setTimeout(() => setDmSuccess(false), 3000);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs for System Tools */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'announcements' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Public Announcements
        </button>
        <button 
          onClick={() => setActiveTab('direct')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'direct' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Direct User Messages
        </button>
        <button 
          onClick={() => setActiveTab('maintenance')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'maintenance' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Maintenance Mode
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'security' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Security Logs
        </button>
      </div>

      {activeTab === 'announcements' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <Megaphone className="w-5 h-5 mr-2 text-primary" /> Global Announcements
            </h2>
            {!isCreating && (
              <button 
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-black transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" /> New Announcement
              </button>
            )}
          </div>

        {isCreating && (
          <form onSubmit={handleAnnounceSubmit(onAnnounceSubmit)} className="p-6 bg-slate-50 border-b border-slate-200">
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  {...registerAnnounce('title')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="System Maintenance Notice"
                />
                {errorsAnnounce.title && <p className="mt-1 text-sm text-red-600">{errorsAnnounce.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Content</label>
                <textarea
                  {...registerAnnounce('content')}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                />
                {errorsAnnounce.content && <p className="mt-1 text-sm text-red-600">{errorsAnnounce.content.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Priority Level</label>
                <select
                  {...registerAnnounce('priority')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-bold text-white bg-slate-900 rounded-lg hover:bg-black flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : <><Save className="w-4 h-4 mr-2" /> Publish Now</>}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="p-6">
          {announcements.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No active announcements.</p>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-4">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    announcement.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                    announcement.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-slate-900">{announcement.title}</h3>
                      <span className="flex items-center text-xs font-semibold text-slate-500 uppercase">
                        <Clock className="w-3 h-3 mr-1" /> {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{announcement.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === 'direct' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Push Direct Notification</h2>
            <p className="text-slate-500 text-sm mb-6">Send an immediate in-app alert to a specific user's notification center.</p>
            
            {dmSuccess && (
              <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-xl text-sm font-bold border border-green-200 flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2" /> Message delivered successfully!
              </div>
            )}

            <form onSubmit={handleDmSubmit(onDmSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">User ID (UUID)</label>
                <input
                  type="text"
                  {...registerDm('userId')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm"
                  placeholder="e.g., a1b2c3d4-..."
                />
                {errorsDm.userId && <p className="mt-1 text-sm text-red-600">{errorsDm.userId.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Alert Title</label>
                <input
                  type="text"
                  {...registerDm('title')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Important Account Update"
                />
                {errorsDm.title && <p className="mt-1 text-sm text-red-600">{errorsDm.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Message Body</label>
                <textarea
                  {...registerDm('message')}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  placeholder="Enter the alert message..."
                />
                {errorsDm.message && <p className="mt-1 text-sm text-red-600">{errorsDm.message.message}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 text-sm font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : <><Megaphone className="w-4 h-4 mr-2" /> Push Alert Now</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
              <ShieldAlert className="w-5 h-5 mr-2 text-red-500" /> System Maintenance Mode
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              When Maintenance Mode is active, all normal users will see a maintenance message and won't be able to access the site. Admins and superadmins will bypass this and can continue testing.
            </p>

            <div className={`p-6 rounded-2xl border ${maintenanceEnabled ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'} transition-colors duration-300`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`relative flex h-3 w-3 ${maintenanceEnabled ? 'visible' : 'hidden'}`}>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </div>
                  {!maintenanceEnabled && (
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Status: {maintenanceEnabled ? 'Active (Offline for users)' : 'Inactive (Online)'}
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {maintenanceEnabled 
                        ? 'Users will see the maintenance page. Admins can bypass.' 
                        : 'All features are fully operational.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleToggleMaintenance}
                  disabled={isUpdatingMaintenance}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    maintenanceEnabled ? 'bg-red-600' : 'bg-slate-300'
                  } disabled:opacity-50 cursor-pointer`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                      maintenanceEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-red-500" /> Security & Access Logs
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Unauthorized login attempts at the admin/moderator terminal.
              </p>
            </div>
            <button 
              onClick={loadSecurityLogs}
              disabled={isLoadingLogs}
              className="px-4 py-2 border border-slate-200 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Refresh Logs
            </button>
          </div>

          <div>
            {isLoadingLogs ? (
              <div className="py-20 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : securityLogs.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                No unauthorized login attempts logged.
              </div>
            ) : (
              <table className="w-full table-fixed text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-150">
                    <th className="w-[15%] px-6 py-4">Time</th>
                    <th className="w-[16%] px-6 py-4">Email</th>
                    <th className="w-[13%] px-6 py-4">IP Address</th>
                    <th className="w-[22%] px-6 py-4">Location</th>
                    <th className="w-[25%] px-6 py-4">System Details</th>
                    <th className="w-[9%] px-6 py-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {securityLogs.map((log) => {
                    const sys = log.system_info || {};
                    const geo = sys.geo || {};
                    const browser = detectBrowser(sys.userAgent || log.user_agent);
                    const os = detectOs(sys.userAgent || log.user_agent, sys.platform);
                    const device = detectDevice(sys.userAgent || log.user_agent, sys.maxTouchPoints);
                    
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-slate-500 text-xs font-mono break-words">
                          {new Date(log.attempted_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800 break-words">
                          {log.email}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-650 break-words">
                          {log.ip_address}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-xs">
                          {geo.city || geo.country ? (
                            <span>
                              {geo.city && `${geo.city}, `}{geo.country || 'Unknown'}
                              {geo.org && <span className="block text-[10px] text-slate-400 font-medium break-words">{geo.org}</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400">Unavailable</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[11px] space-y-0.5 text-slate-500">
                            <div><span className="font-semibold text-slate-700">Device:</span> {device}</div>
                            <div><span className="font-semibold text-slate-700">Browser/OS:</span> {browser} / {os}</div>
                            <div><span className="font-semibold text-slate-700">Screen:</span> {sys.screen || 'Unknown'} (VP: {sys.viewport || 'Unknown'})</div>
                            <div className="break-words" title={log.user_agent}><span className="font-semibold text-slate-700">Agent:</span> {sys.userAgent || log.user_agent}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedSecurityLog(log)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {selectedSecurityLog && (() => {
        const log = selectedSecurityLog;
        const sys = log.system_info || {};
        const geo = sys.geo || {};
        const browser = detectBrowser(sys.userAgent || log.user_agent);
        const os = detectOs(sys.userAgent || log.user_agent, sys.platform);
        const device = detectDevice(sys.userAgent || log.user_agent, sys.maxTouchPoints);
        const connection = sys.connection || {};

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                <div>
                  <h3 className="flex items-center text-base font-bold text-slate-900">
                    <ShieldAlert className="mr-2 h-5 w-5 text-red-500" />
                    Login Attempt Details
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(log.attempted_at).toLocaleString()} from {log.ip_address || 'Unknown IP'}
                  </p>
                  {isEnrichingLog && (
                    <p className="mt-1 text-[11px] font-semibold text-primary">
                      Fetching latest IP details...
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSecurityLog(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Close details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[75vh] overflow-y-auto p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-xl border border-slate-200 p-4">
                    <h4 className="mb-4 flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                      <UserRound className="mr-2 h-4 w-4 text-primary" />
                      Attempt
                    </h4>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <DetailItem label="Email" value={log.email} />
                      <DetailItem label="User ID" value={log.user_id} />
                      <DetailItem label="Failure" value={sys.failureReason || 'Role not allowed'} />
                      <DetailItem label="Page" value={capturedValue(sys.page)} />
                      <DetailItem label="Referrer" value={capturedValue(sys.referrer)} />
                      <DetailItem label="Language" value={sys.language} />
                    </dl>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <h4 className="mb-4 flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                      <MapPin className="mr-2 h-4 w-4 text-primary" />
                      Network
                    </h4>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <DetailItem label="IP Address" value={log.ip_address} />
                      <DetailItem label="City" value={geo.city} />
                      <DetailItem label="Region" value={geo.region} />
                      <DetailItem label="Country" value={geo.country || geo.countryCode} />
                      <DetailItem label="Postal" value={geo.postal} />
                      <DetailItem label="ISP / Org" value={geo.org} />
                      <DetailItem label="ASN" value={geo.asn} />
                      <DetailItem label="Lat / Lng" value={geo.latitude !== undefined && geo.longitude !== undefined ? `${geo.latitude}, ${geo.longitude}` : 'Unknown'} />
                    </dl>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <h4 className="mb-4 flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                      <Monitor className="mr-2 h-4 w-4 text-primary" />
                      Browser
                    </h4>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <DetailItem label="Browser" value={browser} />
                      <DetailItem label="OS" value={os} />
                      <DetailItem label="Platform" value={sys.platform} />
                      <DetailItem label="Timezone" value={sys.timezone || geo.timezone} />
                      <DetailItem label="Cookies" value={sys.cookieEnabled === undefined ? 'Not captured' : sys.cookieEnabled ? 'Enabled' : 'Disabled'} />
                      <DetailItem label="Online" value={sys.online === undefined ? 'Not captured' : sys.online ? 'Yes' : 'No'} />
                    </dl>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <h4 className="mb-4 flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                      <Smartphone className="mr-2 h-4 w-4 text-primary" />
                      Device
                    </h4>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <DetailItem label="Device Type" value={device} />
                      <DetailItem label="Screen" value={sys.screen} />
                      <DetailItem label="Viewport" value={sys.viewport} />
                      <DetailItem label="Pixel Ratio" value={capturedValue(sys.pixelRatio)} />
                      <DetailItem label="Color Depth" value={sys.colorDepth ? `${sys.colorDepth}-bit` : 'Not captured'} />
                      <DetailItem label="Touch Points" value={capturedValue(sys.maxTouchPoints)} />
                      <DetailItem label="CPU Threads" value={capturedValue(sys.hardwareConcurrency)} />
                      <DetailItem label="Device Memory" value={sys.deviceMemory ? `${sys.deviceMemory} GB` : 'Not captured'} />
                    </dl>
                  </section>
                </div>

                <section className="mt-4 rounded-xl border border-slate-200 p-4">
                  <h4 className="mb-4 flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Wifi className="mr-2 h-4 w-4 text-primary" />
                    Connection
                  </h4>
                  <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                    <DetailItem label="Type" value={capturedValue(connection.effectiveType)} />
                    <DetailItem label="Downlink" value={connection.downlink ? `${connection.downlink} Mbps` : 'Not captured'} />
                    <DetailItem label="RTT" value={connection.rtt ? `${connection.rtt} ms` : 'Not captured'} />
                    <DetailItem label="Save Data" value={connection.saveData === undefined ? 'Not captured' : connection.saveData ? 'Yes' : 'No'} />
                  </dl>
                </section>

                <section className="mt-4 rounded-xl border border-slate-200 p-4">
                  <h4 className="mb-3 flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Globe2 className="mr-2 h-4 w-4 text-primary" />
                    User Agent
                  </h4>
                  <p className="break-words rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
                    {sys.userAgent || log.user_agent || 'Unknown'}
                  </p>
                </section>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
