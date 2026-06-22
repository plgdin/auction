import { useState, useMemo, useEffect } from 'react';
import { 
  Save, Download, Trash2, Plus,
  RefreshCw, Layers, Database, Calendar, Search,
  ChevronDown, ChevronUp, ExternalLink, Activity
} from 'lucide-react';
import { marketPriceService } from '../../services/marketPriceService';
import type { PriceHistoryLog } from '../../services/marketPriceService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'react-hot-toast';

export function MarketPriceManagement() {
  const [commodityData, setCommodityData] = useState<any[]>(() => marketPriceService.getCommodityPrices());
  const [historyLogs, setHistoryLogs] = useState<PriceHistoryLog[]>(() => marketPriceService.getPriceHistoryLogs());
  const [scraperAuditLogs, setScraperAuditLogs] = useState<any[]>([]);
  const [activeLogTab, setActiveLogTab] = useState<'Manual' | 'Scraper'>('Scraper');
  
  // Hierarchical Breakdown States
  const [viewMode, setViewMode] = useState<'Flat' | 'Hierarchy'>('Flat');
  const [categoriesData, setCategoriesData] = useState<Record<string, any>>({});
  const [subcategoriesData, setSubcategoriesData] = useState<Record<string, any>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedSubcategories, setExpandedSubcategories] = useState<Record<string, boolean>>({});
  
  // Scraper Automation States
  const [scraperLogs, setScraperLogs] = useState<string[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isAutomated, setIsAutomated] = useState(false);

  // Poll for scraper logs
  useEffect(() => {
    // One-time cleanup to remove random custom commodities and simplify the flat list
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lelam_custom_commodities');
    }
    
    let interval: any;
    interval = setInterval(async () => {
      try {
        const res = await fetch('/api/scraper/status');
        if (res.ok) {
          const data = await res.json();
          setScraperLogs(data.scraperLogs || []);
          setIsScraping(data.scraperRunning);
          setIsAutomated(data.automateRunning);
        }
      } catch (e) {
         // Silently fail if API not available
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Fetch Live Data
  useEffect(() => {
    if (!isScraping) {
       fetch('/api/scraper/data').then(res => res.json()).then(data => {
         const summary = data.summary || {};
         const registered = marketPriceService.getCommodityPrices();
         
         if (Object.keys(summary).length > 0) {
            const updated = registered.map((c) => {
              let scrapedAvgMT: number | null = null;
              
              // 1. Try matching by ID or Name (case-insensitive)
              const matchKeys = [c.id.toLowerCase(), c.name.toLowerCase(), c.id.replace(/_/g, ' ')];
              for (const mk of matchKeys) {
                if (summary[mk]) {
                  scrapedAvgMT = parseFloat(summary[mk].averagePriceMT);
                  break;
                }
              }
              
              // 2. If no direct match, check if any summary key contains/matches keywords
              if (scrapedAvgMT === null && c.keywords) {
                for (const kw of c.keywords) {
                  const kwLower = kw.toLowerCase();
                  const matchedSummaryKey = Object.keys(summary).find(sk => 
                    sk.toLowerCase() === kwLower ||
                    sk.toLowerCase().includes(kwLower) ||
                    kwLower.includes(sk.toLowerCase())
                  );
                  if (matchedSummaryKey) {
                    scrapedAvgMT = parseFloat(summary[matchedSummaryKey].averagePriceMT);
                    break;
                  }
                }
              }
              
              if (scrapedAvgMT !== null) {
                let convertedPrice = scrapedAvgMT;
                if (c.unit.toLowerCase() === 'kg' || c.unit.toLowerCase() === 'kgs') {
                  convertedPrice = scrapedAvgMT / 1000;
                } else if (c.unit.toLowerCase() === 'gram' || c.unit.toLowerCase() === 'grams') {
                  convertedPrice = scrapedAvgMT / 1000000;
                }
                
                return {
                  ...c,
                  currentPrice: parseFloat(convertedPrice.toFixed(2)),
                  lastUpdated: data.timestamp || new Date().toISOString()
                };
              }
              
              return c;
            });
            setCommodityData(updated);
         } else {
            setCommodityData(registered);
         }
         setCategoriesData(data.categories || {});
         setSubcategoriesData(data.subcategories || {});
       }).catch(e => console.log('No scraper data yet.'));

       fetch('/api/scraper/audit').then(res => res.json()).then(data => {
         setScraperAuditLogs(data);
       }).catch(e => console.log('No audit logs yet.'));
    }
  }, [isScraping]);

  const handleStartScraping = async () => {
    setIsScraping(true);
    toast.success('Initiating Live Market & Salasar Scraper...', { icon: '🚀' });
    try {
      await fetch('/api/scraper/start', { method: 'POST' });
    } catch (e) {
      toast.error('Failed to start scraper.');
      setIsScraping(false);
    }
  };

  const handleToggleAutomate = async () => {
    const newState = !isAutomated;
    setIsAutomated(newState);
    toast.success(newState ? 'Daily background scraping enabled!' : 'Automated scraping disabled.');
    try {
      await fetch('/api/scraper/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automate: newState })
      });
    } catch (e) {}
  };
  
  // Selected commodity ID for the graph
  const [selectedGraphCommId, setSelectedGraphCommId] = useState<string>('steel_iron_ferrous');
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | 'Metals' | 'Agriculture' | 'Energy' | 'Vehicles' | 'Electronics' | 'Property' | 'Others'>('All');
  
  // Pagination for history logs
  const [historyPage, setHistoryPage] = useState(1);
  const logsPerPage = 8;

  // Track edits before saving
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [editedMultipliers, setEditedMultipliers] = useState<Record<string, number>>({});

  // Add Commodity Form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'Metals' | 'Agriculture' | 'Energy' | 'Vehicles' | 'Electronics' | 'Property' | 'Others'>('Others');
  const [newUnit, setNewUnit] = useState('kg');
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [newMultiplier, setNewMultiplier] = useState<number | ''>('');
  const [newKeywords, setNewKeywords] = useState('');

  const categories = ['All', 'Metals', 'Agriculture', 'Energy', 'Vehicles', 'Electronics', 'Property', 'Others'];

  // Handle local change in price input
  const handlePriceChange = (id: string, val: string) => {
    const num = parseFloat(val);
    setEditedPrices(prev => ({
      ...prev,
      [id]: isNaN(num) ? 0 : num
    }));
  };

  // Handle local change in multiplier input
  const handleMultiplierChange = (id: string, val: string) => {
    let num = parseFloat(val);
    if (num < 0) num = 0;
    if (num > 1) num = 1;
    setEditedMultipliers(prev => ({
      ...prev,
      [id]: isNaN(num) ? 0.75 : num
    }));
  };

  // Save changes for a single commodity
  const handleSave = (id: string) => {
    const config = commodityData.find(c => c.id === id);
    if (!config) return;

    const price = editedPrices[id] !== undefined ? editedPrices[id] : config.currentPrice;
    const multiplier = editedMultipliers[id] !== undefined ? editedMultipliers[id] : config.currentMultiplier;

    if (price <= 0) {
      toast.error('Price must be greater than zero.');
      return;
    }

    marketPriceService.updateCommodityPrice(id, price, multiplier, 'Admin System');
    
    // Refresh states
    const updatedPrices = marketPriceService.getCommodityPrices();
    const updatedLogs = marketPriceService.getPriceHistoryLogs();
    setCommodityData(updatedPrices);
    setHistoryLogs(updatedLogs);

    // Clear local edits for this row
    setEditedPrices(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEditedMultipliers(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    toast.success(`Updated market price for ${config.name} successfully! New entry added to ML training log.`);
  };

  // Create custom commodity
  const handleCreateCommodity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Commodity name is required.');
      return;
    }
    if (!newUnit.trim()) {
      toast.error('Unit is required.');
      return;
    }
    const priceVal = typeof newPrice === 'string' ? parseFloat(newPrice) : newPrice;
    if (isNaN(priceVal) || priceVal <= 0) {
      toast.error('Initial price must be greater than zero.');
      return;
    }
    const multVal = typeof newMultiplier === 'string' ? parseFloat(newMultiplier) : newMultiplier;
    if (isNaN(multVal) || multVal <= 0 || multVal > 1) {
      toast.error('Expected bid multiplier must be between 0.01 and 1.0.');
      return;
    }

    const keywordsList = newKeywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywordsList.length === 0) {
      keywordsList.push(newName.trim().toLowerCase());
    }

    try {
      marketPriceService.addCustomCommodity({
        name: newName,
        category: newCategory,
        unit: newUnit,
        defaultPrice: priceVal,
        defaultMultiplier: multVal,
        keywords: keywordsList
      });

      // Reset form
      setNewName('');
      setNewCategory('Others');
      setNewUnit('kg');
      setNewPrice('');
      setNewMultiplier('');
      setNewKeywords('');

      // Refresh data
      const updatedPrices = marketPriceService.getCommodityPrices();
      const updatedLogs = marketPriceService.getPriceHistoryLogs();
      setCommodityData(updatedPrices);
      setHistoryLogs(updatedLogs);
      
      const newId = newName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
      setSelectedGraphCommId(newId);

      toast.success(`Custom commodity "${newName}" added and registered across Lelam!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add custom commodity.');
    }
  };

  // Delete custom commodity
  const handleDeleteCustom = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This will remove it from pricing matching indexes and historical logs.`)) {
      marketPriceService.deleteCustomCommodity(id);
      
      // Refresh data
      const updatedPrices = marketPriceService.getCommodityPrices();
      const updatedLogs = marketPriceService.getPriceHistoryLogs();
      setCommodityData(updatedPrices);
      setHistoryLogs(updatedLogs);

      if (selectedGraphCommId === id) {
        setSelectedGraphCommId('steel_iron_ferrous');
      }

      toast.success(`Deleted custom commodity "${name}" successfully.`);
    }
  };

  // Export JSON Dataset
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(historyLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lelam_ml_training_prices_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Successfully exported ML Training Dataset (JSON)');
  };

  // Export CSV Dataset
  const handleExportCSV = () => {
    if (historyLogs.length === 0) {
      toast.error('No logs available to export.');
      return;
    }

    const headers = ['id', 'timestamp', 'commodityId', 'commodityName', 'price', 'multiplier', 'updatedBy'];
    const rows = historyLogs.map(log => [
      log.id,
      log.timestamp,
      log.commodityId,
      `"${log.commodityName.replace(/"/g, '""')}"`,
      log.price,
      log.multiplier,
      log.updatedBy
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `lelam_ml_training_prices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Successfully exported ML Training Dataset (CSV)');
  };

  // Clear all historical log records
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all historical price log records? This will delete the data needed for ML training.')) {
      marketPriceService.clearHistoryLogs();
      setHistoryLogs([]);
      toast.success('Historical price log database cleared.');
    }
  };

  // Reset to default configuration
  const handleResetDefaults = () => {
    if (window.confirm('Reset all prices and expected multipliers to defaults? This will wipe custom commodities and history.')) {
      localStorage.removeItem('lelam_current_market_prices');
      localStorage.removeItem('lelam_market_price_history');
      localStorage.removeItem('lelam_custom_commodities');
      
      const defaults = marketPriceService.getCommodityPrices();
      const logs = marketPriceService.getPriceHistoryLogs();
      setCommodityData(defaults);
      setHistoryLogs(logs);
      setEditedPrices({});
      setEditedMultipliers({});
      setSelectedGraphCommId('steel_iron_ferrous');
      toast.success('Reset system to default commodity values.');
    }
  };

  // Filtered commodities
  const filteredCommodities = useMemo(() => {
    return commodityData.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [commodityData, searchTerm, activeCategory]);

  // History log pagination & filtering
  const totalHistoryPages = Math.ceil(historyLogs.length / logsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const startIndex = (historyPage - 1) * logsPerPage;
    return historyLogs.slice(startIndex, startIndex + logsPerPage);
  }, [historyLogs, historyPage]);

  // Graph Data for the selected commodity
  const graphData = useMemo(() => {
    const logs = historyLogs
      .filter(log => log.commodityId === selectedGraphCommId)
      // Sort oldest first for chart progression
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return logs.map(log => ({
      date: new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      price: log.price,
      multiplier: log.multiplier
    }));
  }, [historyLogs, selectedGraphCommId]);

  const selectedCommConfig = useMemo(() => {
    return commodityData.find(c => c.id === selectedGraphCommId) || commodityData[0];
  }, [selectedGraphCommId, commodityData]);

  // Calculate ROI preview from multiplier
  const getRoiPreview = (multiplier: number) => {
    if (multiplier <= 0) return '0%';
    const roi = ((1 - multiplier) / multiplier) * 100;
    return `${roi.toFixed(1)}%`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* Left 2 Columns: Commodity Prices Setup */}
      <div className="xl:col-span-2 space-y-6">
        
        {/* Controls and filters */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2 border border-slate-250 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm font-semibold"
              placeholder="Search commodity or SKU ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 shrink-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Commodity Grid Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4.5 border-b border-slate-150 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Today's Market Indices</h3>
                <p className="text-[11px] text-slate-450 mt-0.5">Edit today's price & expected bid multipliers below. Changes log to the ML history database.</p>
              </div>
              
              <div className="flex bg-slate-200/50 p-0.5 rounded-lg shrink-0 border border-slate-250">
                <button
                  type="button"
                  onClick={() => setViewMode('Flat')}
                  className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === 'Flat' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Flat List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('Hierarchy')}
                  className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === 'Hierarchy' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Hierarchical Breakdown
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={handleToggleAutomate}
                className={`text-white font-bold rounded-lg px-3 py-1.5 shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider ${isAutomated ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-500 hover:bg-slate-400'}`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {isAutomated ? 'Automate Daily [ON]' : 'Automate Daily [OFF]'}
              </button>
              <button 
                type="button"
                onClick={handleStartScraping}
                disabled={isScraping}
                className="text-white font-bold bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg px-3 py-1.5 shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider"
              >
                {isScraping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                {isScraping ? 'Scraping...' : 'Start Scraping & Automate'}
              </button>
              <button 
                type="button"
                onClick={handleResetDefaults}
                className="text-[10px] text-slate-550 hover:text-red-500 font-bold border border-slate-200 hover:border-red-200 rounded-lg px-2.5 py-1.5 bg-white shadow-3xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Reset & Clear
              </button>
            </div>
          </div>

          {viewMode === 'Flat' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-150 text-slate-500 font-mono">
                    <th className="py-3 px-4.5 font-bold">Commodity Name</th>
                    <th className="py-3 px-4 font-bold text-center w-24">Unit</th>
                    <th className="py-3 px-4 font-bold text-right w-36">Today's Price (INR)</th>
                    <th className="py-3 px-4 font-bold text-center w-48">Expected Bid Multiplier (ROI)</th>
                    <th className="py-3 px-4 font-bold text-center w-32">Pricing Status</th>
                    <th className="py-3 px-4 font-bold text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredCommodities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                        No matching commodities found. Try adjusting filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCommodities.map((item) => {
                      const priceVal = editedPrices[item.id] !== undefined ? editedPrices[item.id] : item.currentPrice;
                      const multVal = editedMultipliers[item.id] !== undefined ? editedMultipliers[item.id] : item.currentMultiplier;
                      const isEdited = editedPrices[item.id] !== undefined || editedMultipliers[item.id] !== undefined;

                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-slate-50/40 transition-colors ${
                            selectedGraphCommId === item.id ? 'bg-primary-50/10' : ''
                          }`}
                        >
                          <td className="py-3 px-4.5">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => setSelectedGraphCommId(item.id)}
                                className="text-left font-bold text-slate-900 hover:text-primary transition-colors flex flex-col cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-900">
                                  {item.name}
                                  {item.isCustom && (
                                    <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase rounded bg-sky-50 text-sky-600 border border-sky-200">
                                      Custom
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-450 font-mono mt-0.5">{item.id}</span>
                              </button>
                              {item.keywords && item.keywords.length > 0 && (
                                <div className="text-[10px] text-slate-450 font-semibold bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded-md inline-block w-fit">
                                  Keywords: <span className="text-slate-650 font-mono font-bold">{item.keywords.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          
                          <td className="py-3 px-4 text-center font-mono text-slate-500 font-semibold bg-slate-50/20">
                            {item.unit}
                          </td>
                          
                          <td className="py-3 px-4 text-right">
                            <div className="relative rounded-lg shadow-3xs inline-block w-32">
                              <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400 font-bold">₹</span>
                              <input
                                type="number"
                                disabled={item.isPricingDisabled}
                                className={`w-full pl-5 pr-2 py-1 text-right border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none ${
                                  item.isPricingDisabled
                                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                    : editedPrices[item.id] !== undefined 
                                      ? 'border-amber-300 bg-amber-50/20 text-amber-900' 
                                      : 'border-slate-200 bg-white text-slate-800'
                                }`}
                                value={priceVal === 0 ? '' : priceVal}
                                onChange={(e) => handlePriceChange(item.id, e.target.value)}
                              />
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                max="1.0"
                                disabled={item.isPricingDisabled}
                                className={`w-18 px-2 py-1 text-center border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none ${
                                  item.isPricingDisabled
                                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                    : editedMultipliers[item.id] !== undefined 
                                      ? 'border-amber-300 bg-amber-50/20 text-amber-900' 
                                      : 'border-slate-200 bg-white text-slate-800'
                                }`}
                                value={multVal}
                                onChange={(e) => handleMultiplierChange(item.id, e.target.value)}
                              />
                              
                              <span className={`text-[10px] font-mono font-black px-2 py-1 rounded inline-block w-20 text-center ${
                                item.isPricingDisabled
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200'
                                  : multVal <= 0.7 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                    : multVal <= 0.8 
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                              }`}>
                                {item.isPricingDisabled ? 'Disabled' : `${getRoiPreview(multVal)} ROI`}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => {
                                const nextState = !item.isPricingDisabled;
                                marketPriceService.setCommodityPricingDisabled(item.id, nextState);
                                setCommodityData(marketPriceService.getCommodityPrices());
                                toast.success(`${item.name} pricing is now ${nextState ? 'Disabled' : 'Enabled'}`);
                              }}
                              className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-200 border cursor-pointer ${
                                item.isPricingDisabled
                                  ? 'bg-rose-50 text-rose-650 border-rose-200 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-650 border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              {item.isPricingDisabled ? 'Disabled' : 'Enabled'}
                            </button>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSave(item.id)}
                                disabled={!isEdited || item.isPricingDisabled}
                                className={`p-1.5 rounded-lg border flex items-center justify-center shadow-3xs transition-all ${
                                  isEdited && !item.isPricingDisabled
                                    ? 'bg-amber-500 border-amber-600 hover:bg-amber-600 text-white cursor-pointer active:scale-95'
                                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                                title="Save & log daily entry"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              {item.isCustom && (
                                <button
                                  onClick={() => handleDeleteCustom(item.id, item.name)}
                                  className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-750 transition-all cursor-pointer shadow-3xs"
                                  title="Delete custom commodity"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 space-y-4 bg-slate-50/30">
              {Object.keys(categoriesData).length === 0 ? (
                <div className="py-16 text-center text-slate-450 font-bold border border-dashed border-slate-200 rounded-3xl bg-white shadow-3xs flex flex-col items-center justify-center gap-3">
                  <Activity className="w-8 h-8 text-slate-350 animate-pulse" />
                  <div>
                    <p className="text-slate-650 font-extrabold text-xs uppercase tracking-wider">No Hierarchical Breakdown Data Available</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Please start the scraper to crawl categories and compute averages.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 border border-slate-200 rounded-2xl shadow-3xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Live Hierarchical Pricing Directory</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] text-slate-400 uppercase font-bold font-mono">Total Categories</span>
                        <span className="font-mono font-black text-slate-900 mt-0.5">{Object.keys(categoriesData).length}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] text-slate-400 uppercase font-bold font-mono">Total Subcategories</span>
                        <span className="font-mono font-black text-slate-900 mt-0.5">{Object.keys(subcategoriesData).length}</span>
                      </div>
                    </div>
                  </div>

                  {Object.keys(categoriesData).map((catName) => {
                    const catObj = categoriesData[catName];
                    const isCatExpanded = !!expandedCategories[catName];
                    
                    let categoryBorder = 'border-l-indigo-500';
                    let categoryText = 'text-indigo-650';
                    let categoryBg = 'bg-indigo-50/20';
                    
                    const lowerCat = catName.toLowerCase();
                    if (lowerCat.includes('metal')) {
                      categoryBorder = 'border-l-blue-600';
                      categoryText = 'text-blue-700';
                      categoryBg = 'bg-blue-50/30';
                    } else if (lowerCat.includes('electronic')) {
                      categoryBorder = 'border-l-sky-500';
                      categoryText = 'text-sky-750';
                      categoryBg = 'bg-sky-50/30';
                    } else if (lowerCat.includes('vehicle')) {
                      categoryBorder = 'border-l-emerald-500';
                      categoryText = 'text-emerald-700';
                      categoryBg = 'bg-emerald-50/30';
                    } else if (lowerCat.includes('energy')) {
                      categoryBorder = 'border-l-amber-500';
                      categoryText = 'text-amber-700';
                      categoryBg = 'bg-amber-50/30';
                    } else if (lowerCat.includes('agri')) {
                      categoryBorder = 'border-l-green-600';
                      categoryText = 'text-green-750';
                      categoryBg = 'bg-green-50/30';
                    } else {
                      categoryBorder = 'border-l-slate-500';
                      categoryText = 'text-slate-700';
                      categoryBg = 'bg-slate-50/30';
                    }

                    return (
                      <div key={catName} className="bg-white border border-slate-200 rounded-2xl shadow-3xs overflow-hidden">
                        <div 
                          onClick={() => setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }))}
                          className={`px-5 py-4 flex items-center justify-between gap-4 cursor-pointer transition-colors border-l-4 ${categoryBorder} hover:bg-slate-50/85`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${categoryBg} ${categoryText}`}>
                              <Layers className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">{catName}</h4>
                              <p className="text-[9px] text-slate-450 mt-0.5 font-semibold uppercase">{catObj.subcategories.length} Subcategories available</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-5">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-450 uppercase font-bold font-mono">Average Price</span>
                              <div className="font-mono font-black text-slate-900 text-xs mt-0.5">
                                ₹{parseFloat(catObj.averagePriceMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] text-slate-450 font-normal">/ MT</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-mono font-bold text-slate-450 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                {catObj.sourcesAveraged} rates
                              </span>
                              {isCatExpanded ? <ChevronUp className="w-4 h-4 text-slate-450" /> : <ChevronDown className="w-4 h-4 text-slate-450" />}
                            </div>
                          </div>
                        </div>

                        {isCatExpanded && (
                          <div className="border-t border-slate-150 bg-slate-50/30 divide-y divide-slate-150">
                            {catObj.subcategories.map((subName: string) => {
                              const subObj = subcategoriesData[subName];
                              if (!subObj) return null;
                              
                              const isSubExpanded = !!expandedSubcategories[subName];
                              
                              return (
                                <div key={subName} className="overflow-hidden">
                                  <div 
                                    onClick={() => setExpandedSubcategories(prev => ({ ...prev, [subName]: !prev[subName] }))}
                                    className="px-6 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/60 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                      <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider">{subName}</span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <span className="font-mono font-black text-slate-900 text-[11px]">
                                          ₹{parseFloat(subObj.averagePriceMT).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] text-slate-450 font-normal">/ MT</span>
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono font-semibold text-slate-450 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shadow-3xs">
                                          {subObj.sourcesAveraged} items
                                        </span>
                                        {isSubExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-450" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-450" />}
                                      </div>
                                    </div>
                                  </div>

                                  {isSubExpanded && (() => {
                                    const groups: Record<string, {
                                      originalName: string;
                                      sources: string[];
                                      cities: string[];
                                      priceMTs: number[];
                                      url?: string;
                                    }> = {};

                                    subObj.entries.forEach((entry: any) => {
                                      const name = entry.originalName.trim();
                                      const key = name.toLowerCase();
                                      if (!groups[key]) {
                                        groups[key] = {
                                          originalName: name,
                                          sources: [],
                                          cities: [],
                                          priceMTs: [],
                                          url: entry.url
                                        };
                                      }
                                      const g = groups[key];
                                      if (!g.sources.includes(entry.source)) {
                                        g.sources.push(entry.source);
                                      }
                                      if (entry.city && entry.city !== 'N/A' && !g.cities.includes(entry.city)) {
                                        g.cities.push(entry.city);
                                      }
                                      if (entry.priceMT > 0) {
                                        g.priceMTs.push(entry.priceMT);
                                      }
                                    });

                                    const groupedList = Object.values(groups).map(g => {
                                      const avgPriceMT = g.priceMTs.length > 0
                                        ? g.priceMTs.reduce((sum, p) => sum + p, 0) / g.priceMTs.length
                                        : 0;
                                      return {
                                        originalName: g.originalName,
                                        sources: g.sources,
                                        cities: g.cities,
                                        priceMT: avgPriceMT,
                                        url: g.url
                                      };
                                    });

                                    return (
                                      <div className="px-6 pb-4 bg-white border-t border-slate-100 overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-[10px] mt-3">
                                          <thead>
                                            <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-mono text-[9px]">
                                              <th className="py-2 px-3 font-bold uppercase tracking-wider">Commodity Name</th>
                                              <th className="py-2 px-3 font-bold uppercase tracking-wider text-center w-36">Source Sites</th>
                                              <th className="py-2 px-3 font-bold uppercase tracking-wider text-right w-44">All-Over MT Price (INR)</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                            {groupedList.map((entry: any, index: number) => {
                                              return (
                                                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                                  <td className="py-2 px-3 font-semibold text-slate-900 flex items-center gap-1.5 uppercase">
                                                    <span>{entry.originalName}</span>
                                                    {entry.url && (
                                                      <a 
                                                        href={entry.url} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="p-0.5 text-slate-400 hover:text-primary transition-colors cursor-pointer shrink-0"
                                                        title="Open source website"
                                                      >
                                                        <ExternalLink className="w-3 h-3" />
                                                      </a>
                                                    )}
                                                  </td>
                                                  <td className="py-2 px-3 text-center">
                                                    <div className="flex flex-wrap gap-1 justify-center max-w-[150px] mx-auto">
                                                      {entry.sources.map((src: string) => {
                                                        let srcBadge = 'bg-slate-50 text-slate-650 border-slate-200';
                                                        if (src === 'IndiaMart') {
                                                          srcBadge = 'bg-teal-50 text-teal-700 border-teal-200';
                                                        } else if (src === 'RecycleInMe') {
                                                          srcBadge = 'bg-orange-50 text-orange-700 border-orange-200';
                                                        } else if (src === 'ScrapRates') {
                                                          srcBadge = 'bg-rose-50 text-rose-700 border-rose-200';
                                                        } else if (src.includes('Salasar')) {
                                                          srcBadge = 'bg-purple-50 text-purple-700 border-purple-200';
                                                        }
                                                        return (
                                                          <span key={src} className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border inline-block ${srcBadge}`}>
                                                            {src}
                                                          </span>
                                                        );
                                                      })}
                                                    </div>
                                                  </td>
                                                  <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                                                    ₹{entry.priceMT > 0 ? Math.round(entry.priceMT).toLocaleString('en-IN') : 'N/A'}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        
      </div>

      {/* Right Column: Charts & Export panel */}
      <div className="space-y-6">
        
        {/* Create Custom Commodity Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4.5 h-4.5 text-primary" /> Register Commodity / SKU
            </h4>
            <p className="text-[11px] text-slate-450 mt-0.5">Add frequently discovered catalog items. Matches keywords in auction listings automatically.</p>
          </div>

          <form onSubmit={handleCreateCommodity} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono mb-1">Commodity Name</label>
              <input
                type="text"
                className="w-full px-3 py-1.5 border border-slate-250 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none"
                placeholder="e.g. Copper Winding Scrap, Plastic Drums"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1">Category</label>
                <select
                  className="w-full px-2.5 py-1.5 border border-slate-250 rounded-xl text-xs font-bold focus:ring-1 focus:ring-primary focus:outline-none bg-white cursor-pointer"
                  value={newCategory}
                  onChange={(e: any) => setNewCategory(e.target.value)}
                >
                  <option value="Metals">Metals</option>
                  <option value="Agriculture">Agriculture</option>
                  <option value="Energy">Energy</option>
                  <option value="Vehicles">Vehicles</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Property">Property</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1">Unit</label>
                <input
                  type="text"
                  className="w-full px-3 py-1.5 border border-slate-250 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="e.g. kg, Ton, Unit, Liter"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1">Base Price (INR)</label>
                <input
                  type="number"
                  className="w-full px-3 py-1.5 border border-slate-250 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="e.g. 185"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1">Expected Bid Mult</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.0"
                  className="w-full px-3 py-1.5 border border-slate-250 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="e.g. 0.75"
                  value={newMultiplier}
                  onChange={(e) => setNewMultiplier(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1">Matching Keywords (comma separated)</label>
              <textarea
                rows={2}
                className="w-full px-3 py-1.5 border border-slate-250 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                placeholder="e.g. copper winding, winding wire, transformer coil"
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-sm cursor-pointer transition-all active:scale-98"
            >
              <Plus className="w-4 h-4" /> Add Commodity to Index
            </button>
          </form>
        </div>

        {/* ML History Chart Card */}
        <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md flex flex-col justify-between gap-4">
          <div className="flex justify-between items-start border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400 flex items-center gap-1.5">
                <Database className="w-3 h-3 text-sky-400 animate-pulse" /> ML Forecasting Dataset
              </span>
              <h4 className="font-extrabold text-white text-sm mt-0.5 truncate max-w-[180px]">
                {selectedCommConfig ? selectedCommConfig.name : 'Choose Commodity'}
              </h4>
            </div>
            <select
              value={selectedGraphCommId}
              onChange={(e) => setSelectedGraphCommId(e.target.value)}
              className="bg-slate-950 border border-slate-850 text-[10px] rounded-lg px-2 py-1 focus:outline-none font-bold text-slate-300 cursor-pointer max-w-[140px]"
            >
              {commodityData.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="h-[180px] w-full">
            {graphData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs bg-slate-950/40 border border-dashed border-slate-850 rounded-xl">
                No logs available for this commodity
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminChartVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 9 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                    tick={{ fill: '#64748b', fontSize: 9 }}
                  />
                  <Tooltip
                    formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Price']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 'bold',
                    }}
                  />
                  <Area type="monotone" dataKey="price" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#adminChartVal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-450 border-t border-slate-800/80 pt-3">
            <span>Price Unit: <b className="text-white font-mono font-bold">{selectedCommConfig ? selectedCommConfig.unit : 'N/A'}</b></span>
            <span>Logs Count: <b className="text-white font-mono font-bold">{graphData.length} entries</b></span>
          </div>
        </div>

        {/* Dataset Export Tools */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">ML Export Engine</h4>
            <p className="text-[11px] text-slate-450 mt-0.5">Download the recorded price logs to train regression models offline.</p>
          </div>

          <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-150 flex flex-col gap-3 text-xs">
            <div className="flex justify-between items-center text-[11px] border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-semibold flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Total Logs Count:</span>
              <span className="font-mono font-black text-slate-900 bg-slate-200 px-2.5 py-0.5 rounded-full">{historyLogs.length}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={handleExportJSON}
                disabled={historyLogs.length === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold rounded-xl transition-all cursor-pointer shadow-3xs"
              >
                <Download className="w-3.5 h-3.5" /> Export JSON
              </button>
              <button
                onClick={handleExportCSV}
                disabled={historyLogs.length === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold rounded-xl transition-all cursor-pointer shadow-3xs"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
          </div>

          <button
            onClick={handleClearHistory}
            disabled={historyLogs.length === 0}
            className="w-full py-2.5 border border-dashed border-red-200 hover:border-red-300 hover:bg-red-50/50 disabled:opacity-40 text-red-650 disabled:hover:bg-transparent disabled:hover:border-red-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Wipe Training Database
          </button>
        </div>

        {/* Audit Log list */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
          <div className="border-b border-slate-150 pb-2 flex justify-between items-center">
            <h4 className="font-extrabold text-[11px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
               <button type="button" onClick={() => setActiveLogTab('Manual')} className={`px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeLogTab === 'Manual' ? 'bg-primary text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>MANUAL AUDITS</button>
               <button type="button" onClick={() => setActiveLogTab('Scraper')} className={`px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeLogTab === 'Scraper' ? 'bg-primary text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>SCRAPER AUDITS</button>
            </h4>
            <span className="text-[10px] text-slate-400 font-semibold">
              {activeLogTab === 'Manual' ? `Page ${historyPage} of ${totalHistoryPages}` : `${scraperAuditLogs.length} updates`}
            </span>
          </div>

          {activeLogTab === 'Manual' ? (
            paginatedLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-bold text-xs">
                No manual entries logged in database.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {paginatedLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-150 rounded-2xl flex justify-between items-start gap-2.5 text-[11px] transition-colors">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 leading-tight">{log.commodityName}</div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <Calendar className="w-3 h-3" /> {new Date(log.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                    <div className="text-right space-y-1 shrink-0">
                      <div className="font-bold text-slate-950 font-mono">₹{log.price.toLocaleString('en-IN')}</div>
                      <div className="text-[9px] font-bold text-emerald-650 bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded font-mono inline-block">
                        Mult: {log.multiplier} ({getRoiPreview(log.multiplier)})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            scraperAuditLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-bold text-xs">
                No scraper updates logged yet.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {scraperAuditLogs.slice().reverse().map((log, idx) => (
                  <div key={idx} className="p-3 bg-slate-50/80 border border-slate-150 rounded-2xl flex justify-between items-start gap-2.5 text-[11px]">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 leading-tight">{log.component}</div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <Calendar className="w-3 h-3" /> {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right space-y-1 shrink-0">
                      <div className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] ${log.type === 'ADDED' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'} border inline-block`}>
                         {log.type}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        {log.type === 'ADDED' ? `₹${log.newPriceMT}` : `₹${log.oldPriceMT} -> ₹${log.newPriceMT}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeLogTab === 'Manual' && totalHistoryPages > 1 && (
            <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-[10px] font-bold">
              <button
                onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                disabled={historyPage === 1}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Prev
              </button>
              <span className="text-slate-450">Page {historyPage} / {totalHistoryPages}</span>
              <button
                onClick={() => setHistoryPage(prev => Math.min(totalHistoryPages, prev + 1))}
                disabled={historyPage === totalHistoryPages}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Live Scraper Logs */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-md flex flex-col gap-3 max-h-[300px]">
          <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
            <h4 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
               Live Automation Logs
            </h4>
            <div className="flex gap-2">
              {isAutomated && <span className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full font-mono">24H CRON ACTIVE</span>}
              {isScraping && <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-mono animate-pulse">RUNNING</span>}
            </div>
          </div>
          <div className="overflow-y-auto pr-1 flex flex-col gap-2 font-mono text-[10px]">
            {scraperLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-4">No recent scraper executions.</div>
            ) : (
              scraperLogs.slice().reverse().map((log, idx) => {
                let colorClass = "text-slate-300";
                if (log.includes('[ADDED]')) colorClass = "text-green-400 font-bold";
                if (log.includes('[UPDATED]')) colorClass = "text-amber-400 font-bold";
                if (log.includes('[VERIFIED]')) colorClass = "text-slate-400";
                if (log.includes('Scraping finished!')) colorClass = "text-sky-400 font-bold";
                
                return (
                  <div key={idx} className={`bg-slate-800/50 p-2 rounded border border-slate-700/50 ${colorClass}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
