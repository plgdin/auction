import { useState, useMemo, useEffect } from 'react';
import { 
  Save, Download, Trash2, Plus,
  RefreshCw, Layers, Database, Calendar, Search
} from 'lucide-react';
import { marketPriceService } from '../../services/marketPriceService';
import type { PriceHistoryLog } from '../../services/marketPriceService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'react-hot-toast';

export function MarketPriceManagement() {
  const [commodityData, setCommodityData] = useState(() => marketPriceService.getCommodityPrices());
  const [historyLogs, setHistoryLogs] = useState<PriceHistoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  
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

  // Initialize data and run one-time migration if needed
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Check if we need to migrate local storage data to Supabase
        const isAlreadyMigrated = localStorage.getItem('lelam_supabase_migrated') === 'true';
        
        if (!isAlreadyMigrated) {
          setIsMigrating(true);
          console.log('Starting one-time migration to Supabase...');
          // Fetch existing to see if it's empty
          const { data } = await import('../../lib/supabase').then(m => m.supabase).then(s => s.from('market_indices').select('id').limit(1));
          
          if (!data || data.length === 0) {
            // It's empty, so we migrate all current local data!
            const localData = marketPriceService._getLocalCommodityPrices();
            const localHistory = marketPriceService._getLocalPriceHistoryLogs();
            
            // Insert all commodities
            if (localData.length > 0) {
              const { supabase } = await import('../../lib/supabase');
              for (const c of localData) {
                await supabase.from('market_indices').insert({
                  id: c.id,
                  name: c.name,
                  category: c.category,
                  unit: c.unit,
                  default_price: c.defaultPrice,
                  default_multiplier: c.defaultMultiplier,
                  current_price: c.currentPrice,
                  current_multiplier: c.currentMultiplier,
                  keywords: c.keywords || [],
                  is_custom: c.isCustom || false,
                  is_pricing_disabled: c.isPricingDisabled || false,
                  last_updated: c.lastUpdated || new Date().toISOString()
                });
              }
            }
            
            // Insert history
            if (localHistory.length > 0) {
              const { supabase } = await import('../../lib/supabase');
              for (const h of localHistory) {
                await supabase.from('market_price_history').insert({
                  id: h.id,
                  timestamp: h.timestamp,
                  commodity_id: h.commodityId,
                  commodity_name: h.commodityName,
                  price: h.price,
                  multiplier: h.multiplier,
                  updated_by: h.updatedBy
                });
              }
            }
            toast.success('Successfully migrated local pricing data to Supabase!');
          }
          localStorage.setItem('lelam_supabase_migrated', 'true');
        }

        // Now fetch live data
        const prices = await marketPriceService.fetchCommodityPrices(true);
        const logs = await marketPriceService.fetchPriceHistoryLogs();
        
        if (mounted) {
          setCommodityData(prices);
          setHistoryLogs(logs);
        }
      } catch (err) {
        console.error('Error loading market prices:', err);
        toast.error('Failed to load market prices from database.');
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsMigrating(false);
        }
      }
    };
    
    loadData();
    return () => { mounted = false; };
  }, []);

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
  const handleSave = async (id: string) => {
    const config = commodityData.find(c => c.id === id);
    if (!config) return;

    const price = editedPrices[id] !== undefined ? editedPrices[id] : config.currentPrice;
    const multiplier = editedMultipliers[id] !== undefined ? editedMultipliers[id] : config.currentMultiplier;

    if (price <= 0) {
      toast.error('Price must be greater than zero.');
      return;
    }

    try {
      await marketPriceService.updateCommodityPrice(id, price, multiplier, 'Admin System');
      
      // Refresh states
      const updatedPrices = await marketPriceService.fetchCommodityPrices(true);
      const updatedLogs = await marketPriceService.fetchPriceHistoryLogs();
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to update price.');
    }
  };

  // Create custom commodity
  const handleCreateCommodity = async (e: React.FormEvent) => {
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
      await marketPriceService.addCustomCommodity({
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
      const updatedPrices = await marketPriceService.fetchCommodityPrices(true);
      const updatedLogs = await marketPriceService.fetchPriceHistoryLogs();
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
  const handleDeleteCustom = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This will remove it from pricing matching indexes and historical logs.`)) {
      try {
        await marketPriceService.deleteCustomCommodity(id);
        
        // Refresh data
        const updatedPrices = await marketPriceService.fetchCommodityPrices(true);
        const updatedLogs = await marketPriceService.fetchPriceHistoryLogs();
        setCommodityData(updatedPrices);
        setHistoryLogs(updatedLogs);

        if (selectedGraphCommId === id) {
          setSelectedGraphCommId('steel_iron_ferrous');
        }

        toast.success(`Deleted custom commodity "${name}" successfully.`);
      } catch (err: any) {
        toast.error('Failed to delete commodity.');
      }
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
  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all historical price log records? This will delete the data needed for ML training.')) {
      try {
        await marketPriceService.clearHistoryLogs();
        setHistoryLogs([]);
        toast.success('Historical price log database cleared.');
      } catch (err: any) {
        toast.error('Failed to clear history.');
      }
    }
  };

  // Reset to default configuration
  const handleResetDefaults = async () => {
    if (window.confirm('Reset all prices and expected multipliers to defaults? This will wipe custom commodities and history in Supabase.')) {
      try {
        // Clear Supabase tables
        const { supabase } = await import('../../lib/supabase');
        await supabase.from('market_price_history').delete().neq('id', 'dummy');
        await supabase.from('market_indices').delete().neq('id', 'dummy');
        
        // Re-seed defaults
        const defaults = marketPriceService._getLocalCommodityPrices().filter(c => !c.isCustom);
        for (const c of defaults) {
          await supabase.from('market_indices').insert({
            id: c.id,
            name: c.name,
            category: c.category,
            unit: c.unit,
            default_price: c.defaultPrice,
            default_multiplier: c.defaultMultiplier,
            current_price: c.defaultPrice,
            current_multiplier: c.defaultMultiplier,
            keywords: c.keywords || [],
            is_custom: false,
            is_pricing_disabled: false,
            last_updated: new Date().toISOString()
          });
        }
        
        localStorage.removeItem('lelam_current_market_prices');
        localStorage.removeItem('lelam_market_price_history');
        localStorage.removeItem('lelam_custom_commodities');
        
        const prices = await marketPriceService.fetchCommodityPrices(true);
        const logs = await marketPriceService.fetchPriceHistoryLogs();
        setCommodityData(prices);
        setHistoryLogs(logs);
        setEditedPrices({});
        setEditedMultipliers({});
        setSelectedGraphCommId('steel_iron_ferrous');
        toast.success('Reset system to default commodity values.');
      } catch (err: any) {
        toast.error('Failed to reset defaults.');
      }
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
        <h3 className="text-slate-800 font-bold">Connecting to Database...</h3>
        <p className="text-slate-500 text-sm mt-2">{isMigrating ? 'Migrating your local settings to the cloud...' : 'Loading market indices'}</p>
      </div>
    );
  }

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
          <div className="px-6 py-4.5 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Today's Market Indices</h3>
              <p className="text-[11px] text-slate-450 mt-0.5">Edit today's price & expected bid multipliers below. Changes log to the ML history database.</p>
            </div>
            
            <button 
              onClick={handleResetDefaults}
              className="text-[10px] text-slate-550 hover:text-red-500 font-bold border border-slate-200 hover:border-red-200 rounded-lg px-2.5 py-1.5 bg-white shadow-3xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Reset & Clear
            </button>
          </div>

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
                          <button
                            onClick={() => setSelectedGraphCommId(item.id)}
                            className="text-left font-bold text-slate-900 hover:text-primary transition-colors flex flex-col cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              {item.name}
                              {item.isCustom && (
                                <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase rounded bg-sky-50 text-sky-600 border border-sky-200">
                                  Custom
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-450 font-mono mt-0.5">{item.id}</span>
                          </button>
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
                            onClick={async () => {
                              try {
                                const nextState = !item.isPricingDisabled;
                                await marketPriceService.setCommodityPricingDisabled(item.id, nextState);
                                setCommodityData(await marketPriceService.fetchCommodityPrices(true));
                                toast.success(`${item.name} pricing is now ${nextState ? 'Disabled' : 'Enabled'}`);
                              } catch (err) {
                                toast.error('Failed to update status.');
                              }
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
            <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Price Logger Audits</h4>
            <span className="text-[10px] text-slate-400 font-semibold">Page {historyPage} of {totalHistoryPages}</span>
          </div>

          {paginatedLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-bold text-xs">
              No entries logged in database.
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
          )}

          {totalHistoryPages > 1 && (
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

      </div>

    </div>
  );
}
