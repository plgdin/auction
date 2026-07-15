import { useEffect, useState, useRef } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Trash2, 
  Download, 
  ExternalLink, 
  Clipboard, 
  Database,
  FileCheck,
  AlertCircle,
  Play,
  Square,
  Terminal,
  Cpu,
  CornerDownLeft,
  Server
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { embeddingService } from '../../services/embeddingService';
import { supabase } from '../../lib/supabase';
import type { AuditLog } from '../../types/database.types';
import toast from 'react-hot-toast';
import { storageService } from '../../services/storageService';
import { MstcEditModal } from './MstcEditModal';
import { Edit, Columns, Table } from 'lucide-react';
import { InlineCatalogEditor } from './InlineCatalogEditor';
import { Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';

interface ScraperStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export function ScraperDashboard() {
  const [sourceTab, setSourceTab] = useState<'mstc' | 'baanknet'>('mstc');
  const [stats, setStats] = useState<ScraperStats>({ total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });
  const [baanknetStats, setBaanknetStats] = useState({ total: 0, upcoming: 0, live: 0, closed: 0 });
  const [auctions, setAuctions] = useState<any[]>([]);
  const [baanknetAuctions, setBaanknetAuctions] = useState<any[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [baanknetLogs, setBaanknetLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewTab, setReviewTab] = useState<'needs-review' | 'accepted' | 'all-catalogs'>('needs-review');
  const [searchType, setSearchType] = useState<'all' | 'ref'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'auctions' | 'logs' | 'console'>('auctions');
  const [selectedEditAuction, setSelectedEditAuction] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'table'>('split');
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);

  const searchMenu = {
    items: [
      {
        key: 'all',
        label: 'Search All Fields',
      },
      {
        key: 'ref',
        label: sourceTab === 'baanknet' ? 'Search ID Fields Only' : 'Search Reference No Only',
      }
    ],
    onClick: ({ key }: { key: string }) => {
      setSearchType(key as 'all' | 'ref');
    }
  };

  // Real-time local API states
  const [scraperRunning, setScraperRunning] = useState(false);
  const [workerRunning, setWorkerRunning] = useState(false);
  const [clearDbRunning, setClearDbRunning] = useState(false);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [baanknetRunning, setBaanknetRunning] = useState(false);
  const [liveScraperLogs, setLiveScraperLogs] = useState<string[]>([]);
  const [liveWorkerLogs, setLiveWorkerLogs] = useState<string[]>([]);
  const [liveClearDbLogs, setLiveClearDbLogs] = useState<string[]>([]);
  const [liveBackfillLogs, setLiveBackfillLogs] = useState<string[]>([]);
  const [liveBaanknetLogs, setLiveBaanknetLogs] = useState<string[]>([]);
  const [isLocalApiAvailable, setIsLocalApiAvailable] = useState(false);
  const [isServerless, setIsServerless] = useState(false);
  const [generateVectorsRunning, setGenerateVectorsRunning] = useState(false);

  const scraperTerminalRef = useRef<HTMLDivElement>(null);
  const workerTerminalRef = useRef<HTMLDivElement>(null);
  const clearDbTerminalRef = useRef<HTMLDivElement>(null);
  const backfillTerminalRef = useRef<HTMLDivElement>(null);
  const baanknetTerminalRef = useRef<HTMLDivElement>(null);

  const loadDashboardData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [statsData, auctionsData, logsData, bnStats, bnAuctions, bnLogs] = await Promise.all([
        adminService.getScraperAnalytics(),
        adminService.getScraperAuctions(3000),
        adminService.getScraperLogs(100),
        adminService.getBaanknetScraperAnalytics(),
        adminService.getBaanknetScraperAuctions(3000),
        adminService.getBaanknetScraperLogs(100)
      ]);

      setStats(statsData);
      setAuctions(auctionsData);
      setLogs(logsData);
      setBaanknetStats(bnStats);
      setBaanknetAuctions(bnAuctions);
      setBaanknetLogs(bnLogs);
    } catch (err: any) {
      console.error('Failed to load scraper dashboard data:', err);
      toast.error('Failed to reload database metrics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const getAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  // Poll Vite dev server API for process status & logs
  useEffect(() => {
    let intervalId: any;
    
    const fetchLocalStatus = async () => {
      try {
        const token = await getAuthToken();
        const res = await fetch('/api/scraper/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error('Not OK');
        const data = await res.json();
        setScraperRunning(data.scraperRunning);
        setWorkerRunning(data.workerRunning);
        setClearDbRunning(data.clearDbRunning);
        setBackfillRunning(data.backfillRunning);
        setBaanknetRunning(data.baanknetRunning);
        setLiveScraperLogs(data.scraperLogs || []);
        setLiveWorkerLogs(data.workerLogs || []);
        setLiveClearDbLogs(data.clearDbLogs || []);
        setLiveBackfillLogs(data.backfillLogs || []);
        setLiveBaanknetLogs(data.baanknetLogs || []);
        setIsLocalApiAvailable(true);
        setIsServerless(!!data.isServerless);
      } catch (err) {
        setIsLocalApiAvailable(false);
        setIsServerless(false);
      }
    };

    fetchLocalStatus();
    intervalId = setInterval(fetchLocalStatus, 1500);

    return () => clearInterval(intervalId);
  }, []);

  // Auto-scroll terminals to bottom on new logs
  useEffect(() => {
    if (scraperTerminalRef.current) {
      scraperTerminalRef.current.scrollTop = scraperTerminalRef.current.scrollHeight;
    }
  }, [liveScraperLogs]);

  useEffect(() => {
    if (workerTerminalRef.current) {
      workerTerminalRef.current.scrollTop = workerTerminalRef.current.scrollHeight;
    }
  }, [liveWorkerLogs]);

  useEffect(() => {
    if (clearDbTerminalRef.current) {
      clearDbTerminalRef.current.scrollTop = clearDbTerminalRef.current.scrollHeight;
    }
  }, [liveClearDbLogs]);

  useEffect(() => {
    if (backfillTerminalRef.current) {
      backfillTerminalRef.current.scrollTop = backfillTerminalRef.current.scrollHeight;
    }
  }, [liveBackfillLogs]);

  useEffect(() => {
    if (baanknetTerminalRef.current) {
      baanknetTerminalRef.current.scrollTop = baanknetTerminalRef.current.scrollHeight;
    }
  }, [liveBaanknetLogs]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const startScraper = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Scraper process spawned!');
        setScraperRunning(true);
      } else {
        toast.error(data.message || 'Failed to start scraper.');
      }
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const stopScraper = async () => {
    try {
      const token = await getAuthToken();
      await fetch('/api/scraper/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast.success('Scraper stop signal sent.');
      setScraperRunning(false);
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const startBaanknetScraper = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/scraper/baanknet/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('BaankNet scraper process spawned!');
        setBaanknetRunning(true);
      } else {
        toast.error(data.message || 'Failed to start BaankNet scraper.');
      }
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const stopBaanknetScraper = async () => {
    try {
      const token = await getAuthToken();
      await fetch('/api/scraper/baanknet/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast.success('BaankNet scraper stop signal sent.');
      setBaanknetRunning(false);
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const sendEnterKey = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/scraper/input', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Sent Continue command to scraper!');
      } else {
        toast.error(data.message || 'Failed to send input.');
      }
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const startWorker = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/scraper/worker/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Asset worker process spawned!');
        setWorkerRunning(true);
      } else {
        toast.error(data.message || 'Failed to start worker.');
      }
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const stopWorker = async () => {
    try {
      const token = await getAuthToken();
      await fetch('/api/scraper/worker/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast.success('Worker stop signal sent.');
      setWorkerRunning(false);
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const startClearDb = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/scraper/clear-db/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Database and Storage Clear task started!');
        setClearDbRunning(true);
      } else {
        toast.error(data.message || 'Failed to start Clear DB task.');
      }
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const stopClearDb = async () => {
    try {
      const token = await getAuthToken();
      await fetch('/api/scraper/clear-db/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast.success('Clear DB task stop signal sent.');
      setClearDbRunning(false);
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const startBackfill = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/scraper/backfill/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Batch backfill task started!');
        setBackfillRunning(true);
      } else {
        toast.error(data.message || 'Failed to start Backfill task.');
      }
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };

  const stopBackfill = async () => {
    try {
      const token = await getAuthToken();
      await fetch('/api/scraper/backfill/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast.success('Backfill task stop signal sent.');
      setBackfillRunning(false);
    } catch (err) {
      toast.error('Could not connect to local API plugin.');
    }
  };



  const handleResetAllFailed = async () => {
    if (!window.confirm("Are you sure you want to reset all failed auctions? They will be put back into 'pending' status for retry.")) {
      return;
    }
    try {
      const success = await adminService.resetFailedAuctions();
      if (success) {
        toast.success("Successfully reset all failed auctions!");
        loadDashboardData(true);
      } else {
        toast.error("Failed to reset failed auctions.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    }
  };

  const handleUnlockAllProcessing = async () => {
    if (!window.confirm("Are you sure you want to release locks on all processing auctions? They will be put back into 'pending' status for retry.")) {
      return;
    }
    try {
      const success = await adminService.unlockProcessingAuctions();
      if (success) {
        toast.success("Successfully released locks on all processing auctions!");
        loadDashboardData(true);
      } else {
        toast.error("Failed to release locks.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    }
  };

  const handleResetSingleFailed = async (id: string) => {
    try {
      const success = await adminService.resetSingleFailedAuction(id);
      if (success) {
        toast.success("Auction queued for retry!");
        loadDashboardData(true);
      } else {
        toast.error("Failed to reset this auction.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    }
  };

  const handleViewPrivateAsset = async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    try {
      const storagePath = storageService.extractStoragePath(url);
      const signedUrl = await storageService.getSignedUrlForBucket('auction_documents', storagePath, 60);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        toast.error('Failed to generate secure preview URL.');
      }
    } catch (err) {
      console.error('Error opening asset:', err);
      toast.error('An error occurred.');
    }
  };

  const handleGenerateVectors = async () => {
    if (generateVectorsRunning) return;
    setGenerateVectorsRunning(true);
    let processedCount = 0;
    const toastId = toast.loading('Initializing embedding model...');
    
    try {
      // Warm up model
      await embeddingService.prewarmModel();
      
      while (true) {
        // Fetch up to 50 items without embeddings
        toast.loading(`Processing batch... (${processedCount} total so far)`, { id: toastId });
        const { data, error } = await supabase
          .from('mstc_auctions')
          .select('id, category_name, raw_materials_text')
          .is('embedding', null)
          .limit(50);
          
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        // Generate embeddings and update
        for (const item of data) {
          try {
            // Concatenate category and raw text for the embedding
            const textToEmbed = `${item.category_name || ''} ${item.raw_materials_text || ''}`.trim();
            if (textToEmbed.length < 5) continue; // Skip empty
            
            const vector = await embeddingService.generateEmbedding(textToEmbed);
            const embeddingStr = `[${vector.join(',')}]`;
            
            const { data: updateData, error: updateError } = await supabase
              .from('mstc_auctions')
              .update({ embedding: embeddingStr as any })
              .eq('id', item.id)
              .select();
              
            if (updateError) throw updateError;
            if (!updateData || updateData.length === 0) {
              throw new Error("Update was blocked by database Row Level Security (RLS) policies.");
            }
            
            processedCount++;
          } catch (e) {
            console.warn(`Failed to generate embedding for ${item.id}`, e);
          }
        }
      }
      
      toast.success(`Finished generating ${processedCount} embeddings!`, { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed during vector generation: ${error.message}`, { id: toastId });
    } finally {
      setGenerateVectorsRunning(false);
    }
  };

  const filteredAuctions = auctions.filter(auc => {
    let matchesSearch = false;
    if (searchType === 'ref') {
      matchesSearch = auc.mstc_auction_number.toLowerCase().includes(searchTerm.toLowerCase());
    } else {
      matchesSearch = 
        auc.mstc_auction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        auc.seller_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        auc.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (auc.location && auc.location.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    let isFlagged = false;
    if (auc.raw_materials_text) {
      try {
        const parsed = JSON.parse(auc.raw_materials_text);
        if (parsed && parsed.needsReview) {
          isFlagged = true;
        }
      } catch (e) {}
    }

    const matchesTab = 
      reviewTab === 'all-catalogs' ? true :
      reviewTab === 'needs-review' ? isFlagged : !isFlagged;

    return matchesSearch && matchesTab;
  });

  const filteredBaanknetAuctions = baanknetAuctions.filter(auc => {
    let matchesSearch = false;
    if (searchType === 'ref') {
      matchesSearch = (auc.baanknet_auction_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (auc.bank_property_id || '').toLowerCase().includes(searchTerm.toLowerCase());
    } else {
      matchesSearch = 
        (auc.baanknet_auction_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (auc.bank_property_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (auc.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (auc.bank_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (auc.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (auc.full_address || '').toLowerCase().includes(searchTerm.toLowerCase());
    }
    return matchesSearch;
  });

  useEffect(() => {
    if (activeSubTab === 'auctions') {
      if (sourceTab === 'mstc') {
        if (filteredAuctions.length > 0) {
          const currentSelectedExists = filteredAuctions.some(auc => auc.id === selectedAuctionId);
          if (!selectedAuctionId || !currentSelectedExists) {
            setSelectedAuctionId(filteredAuctions[0].id);
          }
        } else {
          setSelectedAuctionId(null);
        }
      } else {
        if (filteredBaanknetAuctions.length > 0) {
          const currentSelectedExists = filteredBaanknetAuctions.some(auc => auc.id === selectedAuctionId);
          if (!selectedAuctionId || !currentSelectedExists) {
            setSelectedAuctionId(filteredBaanknetAuctions[0].id);
          }
        } else {
          setSelectedAuctionId(null);
        }
      }
    } else {
      setSelectedAuctionId(null);
    }
  }, [filteredAuctions, filteredBaanknetAuctions, selectedAuctionId, activeSubTab, sourceTab]);

  const getLogBadge = (action: string) => {
    switch (action) {
      case 'mstc_auction_downloaded':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Download className="w-3 h-3 mr-1" /> Downloaded
          </span>
        );
      case 'mstc_auction_deleted':
      case 'baanknet_auction_deleted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <Trash2 className="w-3 h-3 mr-1" /> Deleted (Expired)
          </span>
        );
      case 'mstc_auction_failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" /> Failed
          </span>
        );
      case 'baanknet_auction_scraped':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Database className="w-3 h-3 mr-1" /> Scraped Property
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {action}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1.5 text-emerald-500" /> Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 mr-1.5 text-amber-500" /> Pending
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <RefreshCw className="w-3 h-3 mr-1.5 text-blue-500 animate-spin" /> Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 mr-1.5 text-rose-500" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const renderBaanknetDetail = (item: any) => {
    return (
      <div className="flex-1 flex flex-col h-full bg-white divide-y divide-slate-100 overflow-hidden">
        <div className="p-6 bg-slate-900 text-white shrink-0 text-left">
          <span className="bg-primary/20 text-primary-200 border border-primary/30 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
            {item.property_type || 'Bank Auction'}
          </span>
          <h2 className="text-lg font-bold mt-2 leading-snug">{item.title}</h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">Auction ID: {item.baanknet_auction_id}</p>
        </div>

        <div className="p-6 space-y-5 flex-1 overflow-y-auto text-left">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reserve Price</span>
              <p className="text-xl font-extrabold text-slate-950 mt-1">
                {item.reserve_price_text || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Name</span>
              <p className="text-base font-bold text-slate-950 mt-1">{item.bank_name}</p>
            </div>
          </div>

          <div className="space-y-3.5 text-sm">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">State & Location</span>
              <p className="text-slate-800 font-semibold mt-0.5">{item.location || 'India'}</p>
            </div>
            {item.city && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">City / District</span>
                <p className="text-slate-800 font-semibold mt-0.5">{item.city} {item.pincode ? `(${item.pincode})` : ''}</p>
              </div>
            )}
            {item.full_address && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Address</span>
                <p className="text-slate-700 font-medium bg-slate-50 p-3.5 rounded-xl border border-slate-150 mt-1 leading-relaxed whitespace-pre-wrap">
                  {item.full_address}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider">Bidding Starts</span>
              <p className="text-slate-850 font-bold mt-1">
                {new Date(item.auction_start_date).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider">Bidding Ends</span>
              <p className="text-slate-850 font-bold mt-1">
                {new Date(item.auction_end_date).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 font-medium font-mono">
            Property ID: {item.bank_property_id || 'N/A'}
          </span>
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Go to Original Portal <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-50/50 rounded-2xl border border-slate-100">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="text-slate-500 font-semibold">Loading Ingestion System Metrics...</p>
        </div>
      </div>
    );
  }

  const reviewCount = auctions.filter(auc => {
    if (auc.raw_materials_text) {
      try {
        const parsed = JSON.parse(auc.raw_materials_text);
        return parsed && !!parsed.needsReview;
      } catch (e) {}
    }
    return false;
  }).length;

  const acceptedCount = auctions.filter(auc => {
    if (auc.raw_materials_text) {
      try {
        const parsed = JSON.parse(auc.raw_materials_text);
        return parsed && !parsed.needsReview;
      } catch (e) {}
    }
    return true;
  }).length;

  return (
    <div className="space-y-6">
      
      {/* Source Selector Tabs */}
      <div className="flex gap-2.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 w-full max-w-md shrink-0">
        <button
          onClick={() => {
            setSourceTab('mstc');
            setSelectedAuctionId(null);
          }}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            sourceTab === 'mstc'
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          🏛 MSTC Gov Scrap
        </button>
        <button
          onClick={() => {
            setSourceTab('baanknet');
            setSelectedAuctionId(null);
          }}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            sourceTab === 'baanknet'
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          🏢 BaankNet Bank Properties
        </button>
      </div>

      {/* Control Actions & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Navigation Sub-tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('auctions')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeSubTab === 'auctions' 
                ? 'bg-slate-900 text-white' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {sourceTab === 'mstc' 
              ? `Scraped Catalogs (${filteredAuctions.length})`
              : `Scraped Properties (${filteredBaanknetAuctions.length})`
            }
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeSubTab === 'logs' 
                ? 'bg-slate-900 text-white' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {sourceTab === 'mstc'
              ? `Worker & Deletion Logs (${logs.length})`
              : `Ingestion & Cleanup Logs (${baanknetLogs.length})`
            }
          </button>
          <button
            onClick={() => setActiveSubTab('console')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${
              activeSubTab === 'console' 
                ? 'bg-slate-900 text-white' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Terminal className="w-4 h-4 mr-1.5" /> Live Control Console
          </button>
        </div>

        {/* Right Action Side */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {sourceTab === 'mstc' && (
            <button
              onClick={handleGenerateVectors}
              disabled={generateVectorsRunning}
              className="flex items-center px-4 py-2 text-xs font-bold bg-primary border border-primary text-white rounded-lg hover:bg-primary-700 hover:border-primary-700 transition-all shadow-xs animate-none"
            >
              <Cpu className={`w-3.5 h-3.5 mr-2 ${generateVectorsRunning ? 'animate-pulse text-slate-300' : 'text-white'}`} />
              {generateVectorsRunning ? 'Generating...' : 'Generate Vectors'}
            </button>
          )}
          <span className="text-xs text-slate-400 font-medium hidden sm:inline ml-2">
            Status: {sourceTab === 'mstc' ? 'Worker Listening (15s Poll)' : 'Idle'}
          </span>
          <button
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            className="flex items-center px-4 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Board
          </button>
          {activeSubTab === 'auctions' && (
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              <button
                onClick={() => setViewMode('split')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'split' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-950'
                }`}
                title="Split Review Mode"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'table' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-950'
                }`}
                title="Table Grid Mode"
              >
                <Table className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* KPI Cards Section */}
      {activeSubTab === 'console' && (
        sourceTab === 'mstc' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Total Scraped */}
            <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Scraped</span>
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  <Database className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                <p className="text-xs text-slate-400 mt-1">Auctions discovered</p>
              </div>
            </div>

            {/* Downloaded */}
            <div className="bg-gradient-to-br from-white to-emerald-50/20 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Downloaded</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <FileCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-700">{stats.completed}</p>
                <p className="text-xs text-slate-400 mt-1">PDFs stored securely</p>
              </div>
            </div>

            {/* Processing */}
            <div className="bg-gradient-to-br from-white to-blue-50/20 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Processing</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              </div>
              <div className="flex flex-wrap justify-between items-end gap-2">
                <div className="min-w-[100px]">
                  <p className="text-2xl font-black text-blue-700">{stats.processing}</p>
                  <p className="text-xs text-slate-400 mt-1">Active worker lock</p>
                </div>
                {stats.processing > 0 && (
                  <button
                    onClick={handleUnlockAllProcessing}
                    className="px-2.5 py-1 text-xs font-bold bg-primary hover:bg-primary-700 text-white rounded-lg transition-all shadow-xs shrink-0"
                  >
                    Release Locks
                  </button>
                )}
              </div>
            </div>

            {/* Pending */}
            <div className="bg-gradient-to-br from-white to-amber-50/20 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pending</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-700">{stats.pending}</p>
                <p className="text-xs text-slate-400 mt-1">Awaiting queue slot</p>
              </div>
            </div>

            {/* Failed */}
            <div className="bg-gradient-to-br from-white to-rose-50/20 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Failed</span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="flex flex-wrap justify-between items-end gap-2">
                <div className="min-w-[100px]">
                  <p className="text-2xl font-black text-rose-700">{stats.failed}</p>
                  <p className="text-xs text-slate-400 mt-1">Exceeded max retries</p>
                </div>
                {stats.failed > 0 && (
                  <button
                    onClick={handleResetAllFailed}
                    className="px-2.5 py-1 text-xs font-bold bg-primary hover:bg-primary-700 text-white rounded-lg transition-all shadow-xs shrink-0"
                  >
                    Reset All
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Scraped */}
            <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Scraped</span>
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  <Database className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{baanknetStats.total}</p>
                <p className="text-xs text-slate-400 mt-1">Bank properties discovered</p>
              </div>
            </div>

            {/* Upcoming */}
            <div className="bg-gradient-to-br from-white to-blue-50/20 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Upcoming</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-blue-700">{baanknetStats.upcoming}</p>
                <p className="text-xs text-slate-400 mt-1">Scheduled auctions</p>
              </div>
            </div>

            {/* Live */}
            <div className="bg-gradient-to-br from-white to-emerald-50/20 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Live</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-700">{baanknetStats.live}</p>
                <p className="text-xs text-slate-400 mt-1">Active bidding sessions</p>
              </div>
            </div>

            {/* Closed */}
            <div className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Closed / Ended</span>
                <div className="p-2 bg-gray-150 text-gray-650 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-gray-700">{baanknetStats.closed}</p>
                <p className="text-xs text-slate-400 mt-1">Ended properties</p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Main Tab Contents */}
      {activeSubTab === 'auctions' && (
        <div className="space-y-6">
          
          {/* Review Status Tabs */}
          <div className="flex border-b border-slate-200 gap-6">
            <button
              onClick={() => {
                setReviewTab('needs-review');
                setSelectedAuctionId(null);
              }}
              className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                reviewTab === 'needs-review'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-655'
              }`}
            >
              Needs Review
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                reviewTab === 'needs-review'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {reviewCount}
              </span>
            </button>
            <button
              onClick={() => {
                setReviewTab('accepted');
                setSelectedAuctionId(null);
              }}
              className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                reviewTab === 'accepted'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-655'
              }`}
            >
              Accepted / Resolved
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                reviewTab === 'accepted'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {acceptedCount}
              </span>
            </button>
            <button
              onClick={() => {
                setReviewTab('all-catalogs');
                setSelectedAuctionId(null);
              }}
              className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                reviewTab === 'all-catalogs'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-655'
              }`}
            >
              All Catalogs
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                reviewTab === 'all-catalogs'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {auctions.length}
              </span>
            </button>
          </div>

          {/* Table Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50/50">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  sourceTab === 'baanknet'
                    ? (searchType === 'ref' ? "Enter Auction ID or Bank Property ID..." : "Search by Bank, Title, State, Address, ID...")
                    : (searchType === 'ref' ? "Enter Reference No (e.g. MSTC/PTN/...)" : "Search by Auction No, Seller Name, Category, Location...")
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/25 focus:border-primary text-sm placeholder:text-slate-400 bg-white shadow-xs"
              />
            </div>

            {/* Search Type Selector Dropdown */}
            <div className="w-full sm:w-60">
              <Dropdown menu={searchMenu} trigger={['click']}>
                <button 
                  type="button"
                  className="w-full flex justify-between items-center px-4 py-2.5 border border-slate-200 rounded-xl shadow-xs bg-white text-sm text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all text-left cursor-pointer font-semibold"
                >
                  <span className="truncate">
                    {searchType === 'ref' 
                      ? (sourceTab === 'baanknet' ? 'Search ID Fields Only' : 'Search Reference No Only') 
                      : 'Search All Fields'}
                  </span>
                  <DownOutlined className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                </button>
              </Dropdown>
            </div>

          </div>

          {(sourceTab === 'mstc' ? filteredAuctions : filteredBaanknetAuctions).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
              <div className="max-w-md mx-auto space-y-3">
                <p className="text-slate-800 font-bold text-lg">No Matching Records Found</p>
                <p className="text-slate-400 text-sm">
                  Try adjusting your search terms or filter constraints. If you haven't run the scraper, execute <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">npx tsx {sourceTab === 'baanknet' ? 'scraper/baanknetScraper.ts' : 'scraper/scraper.ts'}</code> locally.
                </p>
              </div>
            </div>
          ) : viewMode === 'split' ? (
            <div className="flex flex-col lg:flex-row gap-6">
              
              {/* Left Column: List of items */}
              <div className="w-full lg:w-96 shrink-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[750px]">
                <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex items-center justify-between shrink-0">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    {sourceTab === 'mstc' ? 'Catalogs' : 'Bank Properties'} ({sourceTab === 'mstc' ? filteredAuctions.length : filteredBaanknetAuctions.length})
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-150 min-h-0">
                  {sourceTab === 'mstc' ? (
                    filteredAuctions.map((auc) => {
                      let isFlagged = false;
                      if (auc.raw_materials_text) {
                        try {
                          const parsed = JSON.parse(auc.raw_materials_text);
                          if (parsed && parsed.needsReview) isFlagged = true;
                        } catch (e) {}
                      }
                      const isSelected = selectedAuctionId === auc.id;
                      return (
                        <div
                          key={auc.id}
                          onClick={() => setSelectedAuctionId(auc.id)}
                          className={`p-4 cursor-pointer transition-all border-l-4 text-left flex flex-col gap-1.5 ${
                            isSelected 
                              ? 'bg-primary/5 border-primary shadow-xs' 
                              : 'border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900">{auc.mstc_auction_number}</span>
                            {isFlagged && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Review
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-semibold text-slate-800 leading-snug truncate">
                            {auc.category_name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between mt-1">
                            <span className="truncate max-w-[150px]">{auc.seller_name}</span>
                            <span>{new Date(auc.closing_date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            {getStatusBadge(auc.asset_status)}
                            <span className="text-[9px] text-slate-400 font-semibold">{auc.location || 'India'}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    filteredBaanknetAuctions.map((auc) => {
                      const isSelected = selectedAuctionId === auc.id;
                      return (
                        <div
                          key={auc.id}
                          onClick={() => setSelectedAuctionId(auc.id)}
                          className={`p-4 cursor-pointer transition-all border-l-4 text-left flex flex-col gap-1.5 ${
                            isSelected 
                              ? 'bg-primary/5 border-primary shadow-xs' 
                              : 'border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900">{auc.bank_name}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200 capitalize">
                              {auc.auction_status}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-850 leading-snug line-clamp-2">
                            {auc.title}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between mt-1">
                            <span className="font-semibold text-slate-700">{auc.reserve_price_text}</span>
                            <span>{new Date(auc.auction_end_date).toLocaleDateString()}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 font-semibold text-right">
                            {auc.location || 'India'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Detailed Editor / Preview */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[750px]">
                {sourceTab === 'mstc' ? (
                  selectedAuctionId && auctions.find(a => a.id === selectedAuctionId) ? (
                    <InlineCatalogEditor
                      auction={auctions.find(a => a.id === selectedAuctionId)}
                      onSaveSuccess={() => {
                        loadDashboardData(true);
                      }}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/20">
                      <FileCheck className="w-12 h-12 text-slate-300 mb-3" />
                      <p className="font-bold text-slate-650 text-sm">Select a catalog to view and edit</p>
                      <p className="text-xs text-slate-400 mt-1">Click any item on the left list to review and correct lot details.</p>
                    </div>
                  )
                ) : (
                  selectedAuctionId && baanknetAuctions.find(a => a.id === selectedAuctionId) ? (
                    renderBaanknetDetail(baanknetAuctions.find(a => a.id === selectedAuctionId))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/20">
                      <FileCheck className="w-12 h-12 text-slate-300 mb-3" />
                      <p className="font-bold text-slate-650 text-sm">Select a property listing</p>
                      <p className="text-xs text-slate-400 mt-1">Click any bank property on the left list to review complete parameters.</p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                {sourceTab === 'mstc' ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-extrabold text-slate-500">
                        <th className="px-6 py-4">Auction Ref</th>
                        <th className="px-6 py-4">Category & Seller</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4">Closing Date</th>
                        <th className="px-6 py-4">Ingestion Status</th>
                        <th className="px-6 py-4 text-center">Assets</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredAuctions.map((auc) => {
                        let isFlagged = false;
                        let reviewReason = '';
                        if (auc.raw_materials_text) {
                          try {
                            const parsed = JSON.parse(auc.raw_materials_text);
                            if (parsed && parsed.needsReview) {
                              isFlagged = true;
                              reviewReason = parsed.reviewReason || '';
                            }
                          } catch (e) {}
                        }
                        return (
                          <tr key={auc.id} className="hover:bg-slate-50/50 transition-colors">
                            
                            {/* Auction Number */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{auc.mstc_auction_number}</span>
                                <button 
                                  onClick={() => handleCopy(auc.mstc_auction_number)}
                                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-colors"
                                  title="Copy Auction Number"
                                >
                                  <Clipboard className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* Category & Seller */}
                            <td className="px-6 py-4">
                              <div className="max-w-xs md:max-w-sm truncate">
                                <p className="font-semibold text-slate-800 leading-tight truncate">{auc.category_name}</p>
                                <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{auc.seller_name}</p>
                              </div>
                            </td>

                            {/* Location */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-slate-600 font-medium">{auc.location || 'India'}</span>
                            </td>

                            {/* Closing Date */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-slate-600 font-medium">
                                {new Date(auc.closing_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                {new Date(auc.closing_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(auc.asset_status)}
                                  {isFlagged && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200" title={reviewReason}>
                                      Review
                                    </span>
                                  )}
                                </div>
                                {auc.asset_status === 'failed' && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] text-rose-500 max-w-[140px] truncate" title={auc.error_log}>
                                      {auc.error_log}
                                    </p>
                                    <button
                                      onClick={() => handleResetSingleFailed(auc.id)}
                                      className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-855 rounded transition-all cursor-pointer"
                                    >
                                      Retry
                                    </button>
                                  </div>
                                )}
                                {auc.asset_status === 'pending' && auc.retry_count > 0 && (
                                  <p className="text-[10px] text-amber-500 mt-1">
                                    Retried {auc.retry_count} times
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Public Assets & Edit Action */}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-2">
                                {/* source pdf (external link) */}
                                <a 
                                  href={auc.source_pdf_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors inline-block"
                                  title="Open MSTC Original URL"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>

                                {/* downloaded pdf (internal supabase storage link) */}
                                {auc.sanitized_document_path ? (
                                  <button 
                                    onClick={(e) => handleViewPrivateAsset(e, auc.sanitized_document_path)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded-lg transition-colors inline-block cursor-pointer"
                                    title="Open Downloaded Cloud Storage Document"
                                  >
                                    <FileCheck className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span 
                                    className="p-1.5 bg-slate-50 text-slate-300 border border-slate-100 rounded-lg cursor-not-allowed inline-block"
                                    title="Cloud File Awaiting Sync"
                                  >
                                    <FileCheck className="w-3.5 h-3.5" />
                                  </span>
                                )}

                                {/* Edit button */}
                                {auc.asset_status === 'completed' && (
                                  <button
                                    onClick={() => setSelectedEditAuction(auc)}
                                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg transition-colors inline-block cursor-pointer"
                                    title="Edit Catalog Details & Descriptions"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-extrabold text-slate-500">
                        <th className="px-6 py-4">Bank Name</th>
                        <th className="px-6 py-4">Property Title</th>
                        <th className="px-6 py-4">Reserve Price</th>
                        <th className="px-6 py-4">Bidding Dates</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredBaanknetAuctions.map((auc) => {
                        return (
                          <tr key={auc.id} className="hover:bg-slate-50/50 transition-colors">
                            
                            {/* Bank Name */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{auc.bank_name}</span>
                                <button 
                                  onClick={() => handleCopy(auc.bank_name)}
                                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-colors"
                                  title="Copy Bank Name"
                                >
                                  <Clipboard className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* Property Title & Type */}
                            <td className="px-6 py-4">
                              <div className="max-w-xs md:max-w-sm">
                                <p className="font-semibold text-slate-800 leading-tight line-clamp-2">{auc.title}</p>
                                <p className="text-xs text-primary font-bold mt-1 capitalize">{auc.property_type}</p>
                              </div>
                            </td>

                            {/* Reserve Price */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-slate-900 font-extrabold">{auc.reserve_price_text || 'N/A'}</span>
                            </td>

                            {/* Bidding Dates */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-slate-600 font-semibold text-xs">
                                Start: {new Date(auc.auction_start_date).toLocaleDateString()}
                              </div>
                              <div className="text-slate-650 font-semibold text-xs mt-1">
                                End: {new Date(auc.auction_end_date).toLocaleDateString()}
                              </div>
                            </td>

                            {/* Location */}
                            <td className="px-6 py-4">
                              <span className="text-slate-600 font-medium text-xs block">{auc.location || 'India'}</span>
                              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">{auc.city}</span>
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 capitalize">
                                {auc.auction_status}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {auc.source_url && (
                                <a 
                                  href={auc.source_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors inline-block"
                                  title="Open Original BaankNet URL"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
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
        </div>
      )}

      {activeSubTab === 'logs' && (
        /* Worker & Deletion Logs Tab */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center">
              <Activity className="w-4 h-4 mr-2 text-primary" /> Active Scraping & Ingestion Log events
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {sourceTab === 'mstc' 
                ? 'Tracks PDF downloads, network download failures, and automatic storage cleanup events when auctions close.'
                : 'Tracks bank property database updates, newly discovered listings, and automatic database purges of ended properties.'
              }
            </p>
          </div>

          {((sourceTab === 'mstc' ? logs : baanknetLogs).length) === 0 ? (
            <div className="p-16 text-center text-slate-500">
              No recent activity or deletion events recorded. Start the scraper to see events populate.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-extrabold text-slate-500">
                    <th className="px-6 py-4">Event Type</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(sourceTab === 'mstc' ? logs : baanknetLogs).map((log) => {
                    const detailsObj = log.details ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details) : {};
                    const aucNum = detailsObj.mstc_auction_number || detailsObj.baanknet_auction_id || 'Unknown Auction';
                    
                    let logMessage = '';
                    if (log.action === 'mstc_auction_downloaded') {
                      logMessage = `Successfully downloaded and parsed catalog PDF for ${aucNum}. Cloud storage link updated.`;
                    } else if (log.action === 'mstc_auction_deleted') {
                      logMessage = `Purged expired auction ${aucNum} (Closing date: ${new Date(detailsObj.closing_date).toLocaleDateString()}). Removed PDF from storage bucket.`;
                    } else if (log.action === 'mstc_auction_failed') {
                      logMessage = `Download job failed for ${aucNum} (Attempt ${detailsObj.retry_count}). Error: ${detailsObj.error || 'Unknown network error'}`;
                    } else if (log.action === 'baanknet_auction_deleted') {
                      logMessage = `Purged expired BaankNet auction ID ${aucNum} (End date: ${new Date(detailsObj.auction_end_date).toLocaleDateString()}).`;
                    } else if (log.action === 'baanknet_auction_scraped') {
                      logMessage = `Successfully scraped and imported ${detailsObj.total_scraped} bank property listings.`;
                    } else {
                      logMessage = log.entity_type ? `${log.entity_type} event logged` : 'System action recorded';
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Event type badge */}
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {getLogBadge(log.action)}
                        </td>

                        {/* Event details */}
                        <td className="px-6 py-4">
                          <p className="text-slate-700 font-semibold">{logMessage}</p>
                          {detailsObj.sanitized_document_path && (
                            <button 
                              onClick={(e) => handleViewPrivateAsset(e, detailsObj.sanitized_document_path)}
                              className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer text-left bg-transparent border-0"
                            >
                              View Saved Asset <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'console' && (
        /* Live Control Console Tab */
        <div className="space-y-6">
          
          {/* Connection Alert */}
          {!isLocalApiAvailable && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-5 rounded-2xl flex items-start gap-3.5 shadow-xs">
              <AlertCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-sm md:text-base">Local Script Control Offline</p>
                <p className="text-xs md:text-sm text-rose-700 mt-1 leading-relaxed">
                  Realtime terminal outputs and daemon management endpoints are only accessible while running the development environment.
                  Ensure you launched the site using <code className="bg-rose-100 px-1 py-0.5 rounded text-xs font-mono font-bold">npm run dev</code> on your local workstation.
                </p>
              </div>
            </div>
          )}

          {/* Vercel Serverless Mode Alert */}
          {isLocalApiAvailable && isServerless && (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-5 rounded-2xl flex items-start gap-3.5 shadow-xs">
              <Server className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="font-extrabold text-sm md:text-base">Serverless Mode Active (Vercel)</p>
                <p className="text-xs md:text-sm text-indigo-700 mt-1 leading-relaxed">
                  The dashboard is communicating with Vercel Serverless Functions. You can execute the <strong className="font-bold text-indigo-900">Asset Worker</strong>, <strong className="font-bold text-indigo-900">Cleaner</strong>, and <strong className="font-bold text-indigo-900">Backfiller</strong> tasks serverlessly on demand.
                  Note: The <strong className="font-bold text-indigo-900">MSTC Portal Scraper</strong> is disabled here as it requires manual CAPTCHA solving via a browser GUI, which is only possible running locally with <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-indigo-900">npm run dev</code>.
                </p>
              </div>
            </div>
          )}

          {/* Console Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {sourceTab === 'baanknet' ? (
              <>
                {/* BaankNet Panel */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                  
                  {/* Header */}
                  <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-slate-600" />
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight">BaankNet Portal Scraper</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Automated Angular SPA property crawler daemon</p>
                      </div>
                    </div>
                    
                    {/* Status indicator */}
                    {baanknetRunning ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping" /> Scraper Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" /> Scraper Stopped
                      </span>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2">
                    <button
                      onClick={startBaanknetScraper}
                      disabled={!isLocalApiAvailable || baanknetRunning}
                      className="flex items-center px-4 py-2 text-xs font-bold bg-primary hover:bg-primary-700 text-white rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5 fill-white" /> Start Scraper
                    </button>
                    <button
                      onClick={stopBaanknetScraper}
                      disabled={!isLocalApiAvailable || !baanknetRunning}
                      className="flex items-center px-4 py-2 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-rose-600 hover:text-rose-700 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 mr-1.5 fill-rose-600 text-rose-600" /> Stop Scraper
                    </button>
                  </div>

                  {/* Console Viewer */}
                  <div 
                    ref={baanknetTerminalRef}
                    className="bg-slate-950 p-4 font-mono text-xs text-slate-300 h-96 overflow-y-auto space-y-1 select-text scroll-smooth"
                  >
                    {liveBaanknetLogs.length === 0 ? (
                      <p className="text-slate-500 italic">No output logs. Click "Start Scraper" to initiate the process.</p>
                    ) : (
                      liveBaanknetLogs.map((line, idx) => (
                        <p key={idx} className="leading-relaxed whitespace-pre-wrap">
                          <span className="text-slate-500 select-none mr-2">&gt;&gt;</span>
                          {line}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                {/* Info Panel */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800 p-6 text-white shadow-xl flex flex-col justify-between min-h-[480px]">
                  <div>
                    <div className="flex items-center gap-3.5 mb-6">
                      <div className="p-2.5 bg-white/10 rounded-xl">
                        <Terminal className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base leading-tight">Crawler Intelligence Dashboard</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Stealth execution details & database ingestion pipeline</p>
                      </div>
                    </div>

                    <div className="space-y-4 text-xs leading-relaxed text-slate-350">
                      <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                        <h4 className="font-bold text-white mb-1.5">Anti-Bot Evasion Tactics</h4>
                        <p>
                          Uses Puppeteer Stealth plugin integration. Generates human-like viewport dimensions, overrides webgl configurations, randomized user agents, and injects passive screen scrolls. Bypasses typical Cloudflare & AWS WAF trigger checks on Bank eAuctions pages.
                        </p>
                      </div>

                      <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                        <h4 className="font-bold text-white mb-1.5">Angular SPA Synchronization</h4>
                        <p>
                          BaankNet compiles listings as an Angular application client-side. The crawler intercepts active REST endpoints and handles browser scrolling delays to load listings before scraping card nodes.
                        </p>
                      </div>

                      <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                        <h4 className="font-bold text-white mb-1.5">Automated Purge & Cleanups</h4>
                        <p>
                          The scraper queries active rows in the <code className="bg-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">baanknet_auctions</code> table and deletes references whose <code className="bg-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">auction_end_date</code> has already passed, keeping the search index clean.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 text-[11px] text-slate-500 font-medium flex items-center justify-between mt-6">
                    <span>Database: Postgres (Supabase RLS Active)</span>
                    <span>Version 1.0.0</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Scraper Panel */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                  
                  {/* Header */}
                  <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-slate-600" />
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight">MSTC Portal Scraper</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Discovers active items & deletes expired listings</p>
                      </div>
                    </div>
                    
                    {/* Status indicator */}
                    {scraperRunning ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping" /> Scraper Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" /> Scraper Stopped
                      </span>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2">
                    <button
                      onClick={startScraper}
                      disabled={!isLocalApiAvailable || scraperRunning}
                      className="flex items-center px-4 py-2 text-xs font-bold bg-primary hover:bg-primary-700 text-white rounded-lg transition-all disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5 fill-white" /> Start Scraper
                    </button>
                    <button
                      onClick={stopScraper}
                      disabled={!isLocalApiAvailable || !scraperRunning}
                      className="flex items-center px-4 py-2 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-rose-600 hover:text-rose-700 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5 mr-1.5 fill-rose-600 text-rose-600" /> Stop Scraper
                    </button>
                    {scraperRunning && (
                      <button
                        onClick={sendEnterKey}
                        className="flex items-center px-4 py-2 text-xs font-bold bg-primary hover:bg-primary-700 text-white rounded-lg transition-all shadow-sm animate-pulse"
                        title="Solve CAPTCHA, submit filters on the browser window, then click this button to continue."
                      >
                        <CornerDownLeft className="w-3.5 h-3.5 mr-1.5" /> Solve CAPTCHA & Continue
                      </button>
                    )}
                  </div>

                  {/* Console Viewer */}
                  <div 
                    ref={scraperTerminalRef}
                    className="bg-slate-950 p-4 font-mono text-xs text-slate-300 h-96 overflow-y-auto space-y-1 select-text scroll-smooth"
                  >
                    {liveScraperLogs.length === 0 ? (
                      <p className="text-slate-500 italic">No output logs. Click "Start Scraper" to initiate the process.</p>
                    ) : (
                      liveScraperLogs.map((line, idx) => (
                        <p key={idx} className="leading-relaxed whitespace-pre-wrap">
                          <span className="text-slate-500 select-none mr-2">&gt;&gt;</span>
                          {line}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                {/* Asset Worker Panel */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                  
                  {/* Header */}
                  <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-slate-600" />
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight">Asset & PDF Processing Worker</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Downloads catalogs, uploads to Cloud, parses text</p>
                      </div>
                    </div>
                    
                    {/* Status indicator */}
                    {workerRunning ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping" /> Worker Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" /> Worker Stopped
                      </span>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="p-4 border-b border-slate-100 flex gap-2">
                    <button
                      onClick={startWorker}
                      disabled={!isLocalApiAvailable || workerRunning}
                      className="flex items-center px-4 py-2 text-xs font-bold bg-primary hover:bg-primary-700 text-white rounded-lg transition-all disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5 fill-white" /> Start Worker
                    </button>
                    <button
                      onClick={stopWorker}
                      disabled={!isLocalApiAvailable || !workerRunning}
                      className="flex items-center px-4 py-2 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-rose-600 hover:text-rose-700 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5 mr-1.5 fill-rose-600 text-rose-600" /> Stop Worker
                    </button>
                  </div>

                  {/* Console Viewer */}
                  <div 
                    ref={workerTerminalRef}
                    className="bg-slate-950 p-4 font-mono text-xs text-slate-300 h-96 overflow-y-auto space-y-1 select-text scroll-smooth"
                  >
                    {liveWorkerLogs.length === 0 ? (
                      <p className="text-slate-500 italic">No output logs. Click "Start Worker" to initiate the process.</p>
                    ) : (
                      liveWorkerLogs.map((line, idx) => (
                        <p key={idx} className="leading-relaxed whitespace-pre-wrap">
                          <span className="text-slate-500 select-none mr-2">&gt;&gt;</span>
                          {line}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Database Clear Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-500" />
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">Database & Storage Cleaner</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Wipes database tables & paginates storage deletions</p>
                  </div>
                </div>
                
                {/* Status indicator */}
                {clearDbRunning ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5 animate-ping" /> Cleaner Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" /> Cleaner Stopped
                  </span>
                )}
              </div>

              {/* Controls */}
              <div className="p-4 border-b border-slate-100 flex gap-2">
                <button
                  onClick={() => {
                    if (window.confirm("WARNING: Are you sure you want to completely clear the database tables and wipe all files in the Supabase storage buckets? This cannot be undone!")) {
                      startClearDb();
                    }
                  }}
                  disabled={!isLocalApiAvailable || clearDbRunning}
                  className="flex items-center px-4 py-2 text-xs font-bold bg-primary hover:bg-primary-700 text-white rounded-lg transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5 fill-white" /> Clear DB & Storage
                </button>
                <button
                  onClick={stopClearDb}
                  disabled={!isLocalApiAvailable || !clearDbRunning}
                  className="flex items-center px-4 py-2 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-700 rounded-lg transition-all disabled:opacity-50"
                >
                  <Square className="w-3.5 h-3.5 mr-1.5 fill-slate-500 text-slate-500" /> Stop Cleaner
                </button>
              </div>

              {/* Console Viewer */}
              <div 
                ref={clearDbTerminalRef}
                className="bg-slate-950 p-4 font-mono text-xs text-slate-300 h-96 overflow-y-auto space-y-1 select-text scroll-smooth"
              >
                {liveClearDbLogs.length === 0 ? (
                  <p className="text-slate-500 italic">No output logs. Click "Clear DB & Storage" to wipe resources.</p>
                ) : (
                  liveClearDbLogs.map((line, idx) => (
                    <p key={idx} className="leading-relaxed whitespace-pre-wrap">
                      <span className="text-slate-500 select-none mr-2">&gt;&gt;</span>
                      {line}
                    </p>
                  ))
                )}
              </div>

            </div>

            {/* Batch Backfill Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-500" />
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">Batch PDF & Image Backfiller</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Reprocesses PDFs, extracts metadata & preview page images</p>
                  </div>
                </div>
                
                {/* Status indicator */}
                {backfillRunning ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5 animate-ping" /> Backfiller Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" /> Backfiller Stopped
                  </span>
                )}
              </div>

              {/* Controls */}
              <div className="p-4 border-b border-slate-100 flex gap-2">
                <button
                  onClick={startBackfill}
                  disabled={!isLocalApiAvailable || backfillRunning}
                  className="flex items-center px-4 py-2 text-xs font-bold bg-primary hover:bg-primary-700 text-white rounded-lg transition-all disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5 fill-white" /> Start Backfiller
                </button>
                <button
                  onClick={stopBackfill}
                  disabled={!isLocalApiAvailable || !backfillRunning}
                  className="flex items-center px-4 py-2 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-rose-600 hover:text-rose-700 rounded-lg transition-all disabled:opacity-50"
                >
                  <Square className="w-3.5 h-3.5 mr-1.5 fill-rose-600 text-rose-600" /> Stop Backfiller
                </button>
              </div>

              {/* Console Viewer */}
              <div 
                ref={backfillTerminalRef}
                className="bg-slate-950 p-4 font-mono text-xs text-slate-300 h-96 overflow-y-auto space-y-1 select-text scroll-smooth"
              >
                {liveBackfillLogs.length === 0 ? (
                  <p className="text-slate-500 italic">No output logs. Click "Start Backfiller" to process database records.</p>
                ) : (
                  liveBackfillLogs.map((line, idx) => (
                    <p key={idx} className="leading-relaxed whitespace-pre-wrap">
                      <span className="text-slate-500 select-none mr-2">&gt;&gt;</span>
                      {line}
                    </p>
                  ))
                )}
              </div>

            </div>

          </div>

        </div>
      )}

      {selectedEditAuction && (
        <MstcEditModal
          auction={selectedEditAuction}
          onClose={() => setSelectedEditAuction(null)}
          onSaveSuccess={() => loadDashboardData(true)}
        />
      )}

    </div>
  );
}
