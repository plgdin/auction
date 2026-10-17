import { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare, Send, CheckCircle2, RefreshCw,
  Search, Smartphone, BarChart3, Radio,
  ShieldCheck, ArrowUpRight, ArrowDownLeft,
  Sparkles, AlertTriangle, Copy, Check
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { WhatsAppMessage } from '../../types/database.types';
import toast from 'react-hot-toast';
import clsx from 'clsx';

type WhatsAppHubTab = 'direct' | 'broadcast' | 'logs';

export function WhatsAppManagement() {
  const [activeTab, setActiveTab] = useState<WhatsAppHubTab>('direct');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    outbound: 0,
    inbound: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Available campaign styles
  const [availableStyles, setAvailableStyles] = useState<Array<{ id: string; style: string; group: string }>>([]);

  // Spending Cap & Budget Guard
  const [budget, setBudget] = useState<{
    allowed: boolean;
    currentSpend: number;
    budgetCap: number;
    remainingBudget: number;
    messageCountThisMonth: number;
  }>({
    allowed: true,
    currentSpend: 0,
    budgetCap: 2000,
    remainingBudget: 2000,
    messageCountThisMonth: 0,
  });

  // Direct Send state
  const [directPhone, setDirectPhone] = useState('');
  const [directRecipientName, setDirectRecipientName] = useState('Valued Partner');
  const [directMode, setDirectMode] = useState<'template' | 'custom'>('template');
  const [selectedStyleId, setSelectedStyleId] = useState('new_lot_alert');
  const [directLotTitle, setDirectLotTitle] = useState('MSTC Heavy Copper Scrap & Transformer Lot');
  const [directLotPrice, setDirectLotPrice] = useState('350000');
  const [directLotLocation, setDirectLotLocation] = useState('Mumbai, Maharashtra');
  const [customDirectMessage, setCustomDirectMessage] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  // Broadcast state
  const [broadcastMode, setBroadcastMode] = useState<'template' | 'custom'>('template');
  const [broadcastStyleId, setBroadcastStyleId] = useState('new_lot_alert');
  const [broadcastCustomMessage, setBroadcastCustomMessage] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{ eligibleCount?: number; sample?: any[] } | null>(null);
  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<WhatsAppMessage[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<WhatsAppMessage | null>(null);

  // Load initial data
  const loadStatsAndStyles = async () => {
    setIsLoadingStats(true);
    try {
      const [statsData, stylesData] = await Promise.all([
        adminService.getWhatsAppStats(),
        adminService.getWhatsAppCampaignStyles(),
      ]);
      setStats(statsData);
      setAvailableStyles(stylesData.availableStyles || []);
      if (stylesData.budget) {
        setBudget(stylesData.budget);
      }
      if (stylesData.sampleGeneratedNotification?.fullMessage) {
        setPreviewContent(stylesData.sampleGeneratedNotification.fullMessage);
      }
    } catch (err) {
      console.error('Error loading WhatsApp stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logsData = await adminService.getWhatsAppLogs(200);
      setLogs(logsData);
    } catch (err) {
      console.error('Error loading WhatsApp logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadStatsAndStyles();
    loadLogs();
  }, []);

  // Update preview when template or context changes
  useEffect(() => {
    if (directMode === 'custom') {
      setPreviewContent(customDirectMessage);
      return;
    }

    if (!selectedStyleId) return;

    let isMounted = true;
    setIsGeneratingPreview(true);

    adminService.previewWhatsAppStyle({
      styleId: selectedStyleId,
      recipientName: directRecipientName,
      title: directLotTitle,
      location: directLotLocation,
      price: Number(directLotPrice) || 350000,
    })
      .then((preview) => {
        if (isMounted && preview?.fullMessage) {
          setPreviewContent(preview.fullMessage);
        }
      })
      .catch((err) => {
        console.error('Failed to preview style:', err);
      })
      .finally(() => {
        if (isMounted) setIsGeneratingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    directMode,
    selectedStyleId,
    directRecipientName,
    directLotTitle,
    directLotPrice,
    directLotLocation,
    customDirectMessage,
  ]);

  // Handle direct message send
  const handleSendDirect = async () => {
    const rawDigits = directPhone.replace(/\D/g, '');
    if (rawDigits.length < 10) {
      toast.error('Please enter a valid phone number (at least 10 digits).');
      return;
    }

    const messageText = directMode === 'custom' ? customDirectMessage : previewContent;
    if (!messageText.trim()) {
      toast.error('Message content is empty.');
      return;
    }

    setIsSendingDirect(true);
    try {
      const res = await adminService.sendDirectWhatsApp({
        phone: directPhone,
        message: messageText,
        recipientName: directRecipientName,
        styleId: directMode === 'template' ? selectedStyleId : undefined,
      });

      if (res.success) {
        toast.success(`WhatsApp message sent successfully to +${rawDigits}!`, {
          icon: '🚀',
          duration: 4000,
        });
        loadStatsAndStyles();
        loadLogs();
      } else {
        toast.error(res.error || 'Failed to send WhatsApp message');
      }
    } catch (err: any) {
      toast.error(err.message || 'Dispatch error occurred');
    } finally {
      setIsSendingDirect(false);
    }
  };

  // Handle broadcast dry-run
  const handleDryRun = async () => {
    setIsDryRunning(true);
    try {
      const res = await adminService.broadcastWhatsApp({
        dryRun: true,
        styleId: broadcastMode === 'template' ? broadcastStyleId : undefined,
        customMessage: broadcastMode === 'custom' ? broadcastCustomMessage : undefined,
        categoryFilter: categoryFilter !== 'all' ? categoryFilter : undefined,
        stateFilter: stateFilter !== 'all' ? stateFilter : undefined,
      });

      if (res.success) {
        setDryRunResult({
          eligibleCount: res.eligibleRecipientsCount,
        });
        toast.success(`Audience preview: ${res.eligibleRecipientsCount} verified recipients ready.`, {
          icon: '👥',
        });
      } else {
        toast.error(res.error || 'Dry run failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Dry run error');
    } finally {
      setIsDryRunning(false);
    }
  };

  // Handle broadcast launch
  const handleLaunchBroadcast = async () => {
    setShowBroadcastConfirm(false);
    setIsBroadcasting(true);
    try {
      const res = await adminService.broadcastWhatsApp({
        dryRun: false,
        styleId: broadcastMode === 'template' ? broadcastStyleId : undefined,
        customMessage: broadcastMode === 'custom' ? broadcastCustomMessage : undefined,
        categoryFilter: categoryFilter !== 'all' ? categoryFilter : undefined,
        stateFilter: stateFilter !== 'all' ? stateFilter : undefined,
      });

      if (res.success) {
        toast.success(`Broadcast completed! Sent: ${res.sent || 0}, Failed: ${res.failed || 0}`, {
          icon: '📢',
          duration: 6000,
        });
        loadStatsAndStyles();
        loadLogs();
      } else {
        toast.error(res.error || 'Broadcast failed to execute');
      }
    } catch (err: any) {
      toast.error(err.message || 'Broadcast error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(previewContent);
    setHasCopied(true);
    toast.success('Message copied to clipboard');
    setTimeout(() => setHasCopied(false), 2000);
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const phone = (log.phone || '').toLowerCase();
        const content = (log.content || '').toLowerCase();
        const name = `${log.profiles?.first_name || ''} ${log.profiles?.last_name || ''}`.toLowerCase();
        if (!phone.includes(q) && !content.includes(q) && !name.includes(q)) return false;
      }
      if (directionFilter !== 'all' && log.direction !== directionFilter) return false;
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      return true;
    });
  }, [logs, searchQuery, directionFilter, statusFilter]);

  const deliveryRate = stats.outbound > 0 ? Math.round((stats.delivered / stats.outbound) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* ── Header: Account Status & Meta Connection ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center border border-[#25D366]/20 shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  WhatsApp Production Hub
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Meta Cloud API
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                  +91 81388 89406
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Yedn Tech Private Limited • Phone ID: <code className="text-slate-700 dark:text-slate-300 font-mono">1313308228530944</code> • Webhook: <code className="text-emerald-600 dark:text-emerald-400 font-mono">lelam.co/api/whatsapp-webhook</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadStatsAndStyles();
                loadLogs();
                toast.success('Refreshed WhatsApp metrics and logs');
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', (isLoadingStats || isLoadingLogs) && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Top Metrics Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Outbound Sent</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.outbound.toLocaleString()}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Inbound Received</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {stats.inbound.toLocaleString()}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Delivered / Read</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.delivered.toLocaleString()}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Success Rate</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {deliveryRate}%
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Failed / Undelivered</p>
            <p className={`text-xl font-bold mt-1 ${stats.failed > 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {stats.failed}
            </p>
          </div>
        </div>

        {/* ── Monthly Spending Cap Guard (₹2,000 Cap) ── */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-transparent border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Monthly Spending Guard: ₹{budget.budgetCap.toLocaleString()} Cap
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                Active Safeguard
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total monthly outbound spend is automatically tracked. Server stops all dispatches if spend reaches ₹{budget.budgetCap.toLocaleString()}.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 min-w-[280px]">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Current Month Spend</p>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                ₹{budget.currentSpend.toFixed(2)}
                <span className="text-xs font-normal text-slate-400"> / ₹{budget.budgetCap.toLocaleString()}</span>
              </p>
            </div>

            <div className="flex-1 w-full sm:w-36">
              <div className="flex justify-between text-[10px] text-slate-400 font-medium mb-1">
                <span>{Math.round((budget.currentSpend / budget.budgetCap) * 100)}% Used</span>
                <span>₹{budget.remainingBudget.toFixed(2)} Left</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={clsx(
                    'h-full transition-all duration-500 rounded-full',
                    budget.currentSpend / budget.budgetCap > 0.9
                      ? 'bg-red-500'
                      : budget.currentSpend / budget.budgetCap > 0.7
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(100, Math.max(3, Math.round((budget.currentSpend / budget.budgetCap) * 100)))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('direct')}
          className={clsx(
            'flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer',
            activeTab === 'direct'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          )}
        >
          <Smartphone className="w-4 h-4" />
          <span>Direct Send & Live Preview</span>
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={clsx(
            'flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer',
            activeTab === 'broadcast'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          )}
        >
          <Radio className="w-4 h-4" />
          <span>Audience Broadcast</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={clsx(
            'flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer',
            activeTab === 'logs'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Audit Logs ({logs.length})</span>
        </button>
      </div>

      {/* ── TAB 1: Direct Send & Interactive Phone Preview ── */}
      {activeTab === 'direct' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Configuration */}
          <div className="lg:col-span-7 space-y-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Dispatch Single WhatsApp Message
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target any client or test number with live cloud dispatch
              </p>
            </div>

            {/* Recipient Phone & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Destination Phone Number *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={directPhone}
                    onChange={(e) => setDirectPhone(e.target.value)}
                    className="w-full pl-12 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Recipient Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patel"
                  value={directRecipientName}
                  onChange={(e) => setDirectRecipientName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Mode Toggle: Template vs Custom */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Copy Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDirectMode('template')}
                  className={clsx(
                    'p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer flex items-center gap-2',
                    directMode === 'template'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  )}
                >
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div>AI Campaign Hooks</div>
                    <div className="text-[10px] font-normal text-slate-400">42 Zomato & B2B Tones</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDirectMode('custom')}
                  className={clsx(
                    'p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer flex items-center gap-2',
                    directMode === 'custom'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  )}
                >
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div>Freeform Custom Copy</div>
                    <div className="text-[10px] font-normal text-slate-400">Direct ad-hoc text</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Template Specific Options */}
            {directMode === 'template' ? (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Select Campaign Copy Style (42 Available)
                  </label>
                  <select
                    value={selectedStyleId}
                    onChange={(e) => setSelectedStyleId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <optgroup label="Promotional Urgency Hooks (30)">
                      {availableStyles
                        .filter(s => s.group.includes('Promotional'))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.style}</option>
                        ))}
                    </optgroup>
                    <optgroup label="B2B Cold Outreach (12)">
                      {availableStyles
                        .filter(s => s.group.includes('Outreach'))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.style}</option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Sample Lot Title
                    </label>
                    <input
                      type="text"
                      value={directLotTitle}
                      onChange={(e) => setDirectLotTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Reserve Price (₹)
                    </label>
                    <input
                      type="number"
                      value={directLotPrice}
                      onChange={(e) => setDirectLotPrice(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Location
                    </label>
                    <input
                      type="text"
                      value={directLotLocation}
                      onChange={(e) => setDirectLotLocation(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Custom Message Content
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {customDirectMessage.length} chars
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={customDirectMessage}
                  onChange={(e) => setCustomDirectMessage(e.target.value)}
                  placeholder="Write message to send directly via official WhatsApp API..."
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopyPreview}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{hasCopied ? 'Copied' : 'Copy Message'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendDirect}
                disabled={isSendingDirect || !directPhone.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none shadow-sm hover:shadow transition-all cursor-pointer"
              >
                {isSendingDirect ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending to Meta...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Message Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Interactive WhatsApp Phone Mockup */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[360px] bg-slate-900 rounded-[42px] p-3 shadow-2xl border-4 border-slate-800">
              {/* Speaker & Camera notch */}
              <div className="w-24 h-4 bg-slate-950 rounded-full mx-auto mb-2 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mr-2" />
                <div className="w-8 h-1 bg-slate-800 rounded-full" />
              </div>

              {/* Screen container */}
              <div className="bg-[#efeae2] dark:bg-[#0b141a] rounded-[32px] overflow-hidden flex flex-col h-[560px] border border-slate-700/40">
                {/* WhatsApp Chat Header */}
                <div className="bg-[#075E54] dark:bg-[#1f2c34] text-white p-3 flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm text-white">
                      L
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-xs leading-none">Lelam.co Auctions</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                      </div>
                      <p className="text-[10px] text-emerald-200 dark:text-slate-400 mt-0.5">
                        Official Business Account
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chat Scroll Area */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3 flex flex-col justify-end text-xs">
                  {/* Encrypted badge */}
                  <div className="bg-amber-100/80 dark:bg-slate-800 text-[10px] text-amber-900 dark:text-amber-200 px-3 py-1.5 rounded-lg text-center mx-auto max-w-[90%] shadow-xs">
                    🔒 Messages and calls are end-to-end encrypted.
                  </div>

                  {/* Outbound Bubble */}
                  <div className="bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-3.5 rounded-2xl rounded-tr-sm shadow-sm text-xs leading-relaxed whitespace-pre-wrap font-sans break-words border border-[#c1f5b8]/50 dark:border-[#005c4b] ml-4">
                    {isGeneratingPreview ? (
                      <div className="flex items-center gap-2 text-slate-500 py-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating copy...</span>
                      </div>
                    ) : (
                      previewContent || 'Select a style or write a message to see preview.'
                    )}

                    <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-slate-500 dark:text-slate-300">
                      <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-[#34B7F1] font-bold">✓✓</span>
                    </div>
                  </div>
                </div>

                {/* Bottom WhatsApp bar */}
                <div className="bg-[#f0f2f5] dark:bg-[#1f2c34] p-2 flex items-center gap-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-3 py-1.5 text-[11px] text-slate-400">
                    Type a message...
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#00a884] text-white flex items-center justify-center">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-3 text-center">
              Target Phone: <strong className="text-slate-700 dark:text-slate-200 font-mono">{directPhone ? `+91 ${directPhone}` : 'None'}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── TAB 2: Audience Broadcast ── */}
      {activeTab === 'broadcast' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Audience Notification Broadcast
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Send notifications to verified subscribers who have opt-in marketing enabled
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Category Filter
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="all">All Auction Categories</option>
                <option value="scrap">Metal, Steel & Industrial Scrap</option>
                <option value="property">Bank Real Estate & Commercial Properties</option>
                <option value="machinery">Machinery & Plant Equipment</option>
                <option value="vehicle">Commercial & Impounded Vehicles</option>
                <option value="timber">Forestry & Timber Lots</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Geographic Filter
              </label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="all">Pan-India (All Regions)</option>
                <option value="maharashtra">Maharashtra</option>
                <option value="gujarat">Gujarat</option>
                <option value="delhi">Delhi NCR</option>
                <option value="tamilnadu">Tamil Nadu</option>
                <option value="kerala">Kerala</option>
                <option value="karnataka">Karnataka</option>
              </select>
            </div>
          </div>

          {/* Copy Mode Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Broadcast Copy Source
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => setBroadcastMode('template')}
                className={clsx(
                  'p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer flex items-center gap-2',
                  broadcastMode === 'template'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                )}
              >
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>AI Campaign Hook (42 Styles)</span>
              </button>

              <button
                type="button"
                onClick={() => setBroadcastMode('custom')}
                className={clsx(
                  'p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer flex items-center gap-2',
                  broadcastMode === 'custom'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                )}
              >
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <span>Custom Broadcast Copy</span>
              </button>
            </div>

            {broadcastMode === 'template' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Campaign Template
                </label>
                <select
                  value={broadcastStyleId}
                  onChange={(e) => setBroadcastStyleId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                >
                  {availableStyles.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.group}] {s.style}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Broadcast Message Body
                </label>
                <textarea
                  rows={4}
                  value={broadcastCustomMessage}
                  onChange={(e) => setBroadcastCustomMessage(e.target.value)}
                  placeholder="Enter broadcast message to send to all eligible subscribers..."
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
            )}
          </div>

          {/* Dry Run Outcome Banner */}
          {dryRunResult && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold">
                    Eligible Audience: {dryRunResult.eligibleCount || 0} Verified Users
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Estimated broadcast cost: <strong>~₹{((dryRunResult.eligibleCount || 0) * 0.85).toFixed(2)}</strong> (Remaining monthly budget: ₹{budget.remainingBudget.toFixed(2)})
                  </p>
                </div>
              </div>

              {((dryRunResult.eligibleCount || 0) * 0.85) > budget.remainingBudget ? (
                <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-950/60 px-2.5 py-1 rounded-lg">
                  Exceeds ₹{budget.budgetCap} Cap
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-lg">
                  Within Budget
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleDryRun}
              disabled={isDryRunning}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isDryRunning && 'animate-spin')} />
              <span>Simulate Dry Run (Safe)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBroadcastConfirm(true)}
              disabled={isBroadcasting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isBroadcasting ? 'Broadcasting...' : 'Launch Live Broadcast'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 3: Audit Logs Table ── */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                WhatsApp Interaction & Audit Trail
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live ledger of outbound templates, direct notifications, and 2-way bot chats
              </p>
            </div>

            <button
              onClick={loadLogs}
              disabled={isLoadingLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={clsx('w-3 h-3', isLoadingLogs && 'animate-spin')} />
              <span>Refresh Logs</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search phone number, message text, or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as any)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="all">All Directions</option>
              <option value="outbound">Outbound (Sent)</option>
              <option value="inbound">Inbound (Received)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Recipient / Phone</th>
                  <th className="px-4 py-3">User Profile</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Content Preview</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">WAM ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No WhatsApp messages match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isOut = log.direction === 'outbound';
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLogForDetail(log)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              <ArrowUpRight className="w-3 h-3" /> OUT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <ArrowDownLeft className="w-3 h-3" /> IN
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white whitespace-nowrap">
                          +{log.phone}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.profiles?.first_name ? (
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {log.profiles.first_name} {log.profiles.last_name || ''}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Unlinked Client</span>
                          )}
                        </td>

                        <td className="px-4 py-3 uppercase tracking-wider text-[10px] font-bold text-slate-500 whitespace-nowrap">
                          {log.type}
                        </td>

                        <td className="px-4 py-3 max-w-[260px] truncate text-slate-600 dark:text-slate-300" title={log.content}>
                          {log.content}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                              log.status === 'read' && 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
                              log.status === 'delivered' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
                              log.status === 'sent' && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                              log.status === 'failed' && 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            )}
                          >
                            {log.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-[10px] text-slate-400 whitespace-nowrap" title={log.whatsapp_message_id || ''}>
                          {log.whatsapp_message_id ? `${log.whatsapp_message_id.substring(0, 10)}...` : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Log Detail Modal ── */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                WhatsApp Message Log Details
              </h3>
              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-400 block">Phone</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">+{selectedLogForDetail.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Status</span>
                  <span className="font-bold text-emerald-600 uppercase">{selectedLogForDetail.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Direction</span>
                  <span className="font-bold uppercase">{selectedLogForDetail.direction}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Time</span>
                  <span>{new Date(selectedLogForDetail.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 font-semibold">Message Content</span>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 font-sans">
                  {selectedLogForDetail.content}
                </div>
              </div>

              {selectedLogForDetail.error_message && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl">
                  <span className="font-bold block">Delivery Error:</span>
                  <span>{selectedLogForDetail.error_message}</span>
                </div>
              )}

              {selectedLogForDetail.whatsapp_message_id && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Meta WAM ID</span>
                  <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded block truncate">
                    {selectedLogForDetail.whatsapp_message_id}
                  </code>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Broadcast Safety Confirmation Dialog ── */}
      {showBroadcastConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm WhatsApp Broadcast
                </h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to dispatch this campaign to verified subscribers?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Selected Template:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{broadcastStyleId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category Filter:</span>
                <span className="font-bold capitalize">{categoryFilter}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Region:</span>
                <span className="font-bold capitalize">{stateFilter}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBroadcastConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLaunchBroadcast}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm"
              >
                Yes, Launch Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
