// @ts-nocheck
import { useEffect, useState, useRef, Fragment } from 'react';
import { 
  Download, 
  FileText, 
  BarChart3, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  PieChart as PieIcon,
  Gavel,
  Lock,
  Unlock,
  DollarSign,
  Activity,
  Clock,
  MapPin,
  Globe,
  Building2,
  Navigation,
  Landmark,
  Building,
  ShieldCheck,
  Coins,
  ExternalLink,
  Filter
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { adminService } from '../../services/adminService';
import { supabase } from '../../lib/supabase';
import clsx from 'clsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const BANK_COLORS = ['#d97706', '#0284c7', '#059669', '#7c3aed', '#dc2626', '#f59e0b', '#0d9488', '#ea580c', '#6366f1', '#64748b'];

const getCategoryColor = (name: string) => {
  if (name === 'Others') return '#94a3b8';
  const palette = [
    '#4f46e5', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#14b8a6', // Teal
    '#f43f5e', // Rose
    '#84cc16', // Lime
    '#3b82f6', // Blue
    '#a855f7', // Violet
    '#f97316', // Orange
    '#2563eb', // Royal Blue
    '#db2777', // Deep Pink
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
};

const getParentCategory = (name: string): string => {
  if (!name) return 'Uncategorized';
  if (name.includes('|')) {
    return name.split('|')[0].trim();
  }
  
  const normalized = name.toLowerCase().trim();
  
  // Map custom/unclaimed goods to Miscellaneous parent category
  if (
    normalized.includes('custom goods') || 
    normalized.includes('unclaimed cargo') || 
    normalized.includes('cfs containers') || 
    normalized.includes('customs')
  ) {
    return 'Miscellaneous';
  }

  // Check standard parent category matches (case-insensitive)
  const knownParents = [
    'agricultural produce', 'aquatic produce', 'ash', 'chemicals', 'coal', 
    'container', 'diamond', 'electrical items', 'electronics items', 
    'forest produce', 'immovable property', 'liquor license contracts', 
    'metal', 'mine block', 'minerals', 'miscellaneous', 'petroleum products', 
    'plant/machineries', 'transport vehicles', 'vessels'
  ];

  const parentMatch = knownParents.find(p => normalized === p);
  if (parentMatch) {
    return name.trim();
  }

  // Standard keyword fallbacks
  if (normalized.includes('vehicle') || normalized.includes('car') || normalized.includes('truck') || normalized.includes('bus')) {
    return 'Transport Vehicles';
  }
  if (normalized.includes('scrap') || normalized.includes('steel') || normalized.includes('iron') || normalized.includes('copper') || normalized.includes('aluminum')) {
    return 'Metal';
  }
  if (normalized.includes('machinery') || normalized.includes('machine') || normalized.includes('spares')) {
    return 'Plant/Machineries';
  }
  if (normalized.includes('battery') || normalized.includes('cable') || normalized.includes('transformer') || normalized.includes('generator')) {
    return 'Electrical Items';
  }
  if (normalized.includes('computer') || normalized.includes('laptop') || normalized.includes('mobile')) {
    return 'Electronics Items';
  }

  return name.trim();
};

const groupStatsByParent = (rawStats: { 
  currentTotals: {name: string, count: number}[], 
  historicalTotals: {name: string, count: number}[], 
  daily: any[] 
}) => {
  return { 
    currentTotals: rawStats.currentTotals, 
    historicalTotals: rawStats.historicalTotals, 
    daily: rawStats.daily, 
    rawSubcategories: {}, 
    dailyRaw: rawStats.daily 
  };
};

// Custom Tooltip component to avoid giant popup listing all active categories
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload]
      .filter(item => item.value !== undefined && item.value > 0)
      .sort((a, b) => b.value - a.value);

    const displayLimit = 5;
    const itemsToDisplay = sortedPayload.slice(0, displayLimit);
    const hiddenCount = sortedPayload.length - displayLimit;

    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-100 max-w-sm">
        <p className="text-xs font-bold text-slate-400 mb-2">{label}</p>
        <div className="space-y-1.5">
          {itemsToDisplay.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color || item.stroke }} />
                <span className="text-slate-600 truncate">{item.name}</span>
              </div>
              <span className="text-slate-900 font-bold shrink-0">{item.value}</span>
            </div>
          ))}
        </div>
        {hiddenCount > 0 && (
          <p className="text-[10px] text-slate-400 mt-2 font-semibold pt-1.5 border-t border-slate-100">
            + {hiddenCount} other categories
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Scrollable Custom Legend to prevent overlapping layout tabs/text under the chart
const RenderCustomLegend = (props: any) => {
  const { payload } = props;
  if (!payload || payload.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4 max-h-16 overflow-y-auto px-4 py-2 border border-slate-100 rounded-xl bg-slate-50/50 custom-scrollbar">
      {payload.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white px-2 py-1 rounded-md border border-slate-200/60 shadow-3xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="truncate max-w-[120px]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ReportsAnalytics() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'overview' | 'location' | 'baanknet'>('overview');

  // BaankNet stats state
  const [baanknetStats, setBaanknetStats] = useState<any>(null);
  const [isLoadingBaanknet, setIsLoadingBaanknet] = useState(true);
  const [baanknetSearchQuery, setBaanknetSearchQuery] = useState('');
  const [baanknetBankFilter, setBaanknetBankFilter] = useState('all');
  const [baanknetPropertyFilter, setBaanknetPropertyFilter] = useState('all');
  const [baanknetStateFilter, setBaanknetStateFilter] = useState('all');
  const [baanknetCategorySearch, setBaanknetCategorySearch] = useState('');
  const [baanknetParentFilter, setBaanknetParentFilter] = useState<'all' | 'Real Estate' | 'Vehicles' | 'Industrial'>('all');
  const [expandedBaanknetCategory, setExpandedBaanknetCategory] = useState<string | null>(null);
  const [overviewSourceFilter, setOverviewSourceFilter] = useState<'all' | 'mstc' | 'baanknet'>('all');
  const [baanknetChartType, setBaanknetChartType] = useState<'bar' | 'pie'>('bar');
  const [globalCounts, setGlobalCounts] = useState<{
    activeMstc: number;
    activeGem: number;
    activeBaanknet: number;
    totalBaanknet: number;
  }>({ activeMstc: 0, activeGem: 0, activeBaanknet: 0, totalBaanknet: 0 });

  // Location stats state
  const [locationStats, setLocationStats] = useState<{
    locations: { location: string; state?: string; district?: string; count: number; percentage: number; topCategory: string; categories: { name: string; count: number }[] }[];
    historicalTotals: { location: string; state?: string; district?: string; count: number; percentage: number; topCategory: string; }[];
    totalAuctions: number;
    topRegion: string;
    dailyTrends: any[];
  }>({ locations: [], historicalTotals: [], totalAuctions: 0, topRegion: 'N/A', dailyTrends: [] });
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [selectedRegionName, setSelectedRegionName] = useState<string | null>(null);
  const [locationCategoryFilter, setLocationCategoryFilter] = useState<string>('all');

  // Live reports data state
  const [liveReportData, setLiveReportData] = useState<{
    growth: any[];
  }>({
    growth: []
  });

  // Category stats state
  const [categoryStats, setCategoryStats] = useState<{
    currentTotals: {name: string, count: number}[],
    historicalTotals: {name: string, count: number}[],
    daily: any[],
    rawSubcategories: Record<string, {name: string, count: number}[]>,
    dailyRaw: any[]
  }>({ currentTotals: [], historicalTotals: [], daily: [], rawSubcategories: {}, dailyRaw: [] });
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Financial stats state
  const [financialData, setFinancialData] = useState<any>({
    emdTransactions: [],
    walletTransactions: [],
    bids: [],
    summary: {
      totalUsers: 0,
      activeListings: 0,
      totalBids: 0,
      emdHeld: 0,
      emdVolume: 0,
      walletFlow: 0
    },
    emdTimeline: [],
    walletTimeline: [],
    bidsTimeline: []
  });
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(true);

  // Filter states
  const [totalsTab, setTotalsTab] = useState<'current' | 'history'>('current');
  const [locationTotalsTab, setLocationTotalsTab] = useState<'current' | 'history'>('current');
  const [locationTotalsSearchQuery, setLocationTotalsSearchQuery] = useState('');
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const toggleCategoryExpand = (name: string) => {
    setExpandedCategories(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | 'all' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [chartType, setChartType] = useState<'line' | 'pie'>('line');
  const [locChartType, setLocChartType] = useState<'bar' | 'pie'>('bar');
  const [selectedChartCategories, setSelectedChartCategories] = useState<string[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadAllReportsData() {
      setIsLoadingLocations(true);
      setIsLoadingCategories(true);
      setIsLoadingFinancial(true);
      setIsLoadingBaanknet(true);

      try {
        const [locData, catData, globalData, finData, profilesRes, baanknetData] = await Promise.all([
          adminService.getLocationAnalytics(),
          adminService.getCategoryAnalytics(),
          adminService.getGlobalAnalytics(),
          adminService.getFinancialAnalytics(),
          supabase.from('profiles').select('created_at, role'),
          adminService.getBaanknetDetailedAnalytics()
        ]);

        if (locData) setLocationStats(locData);
        if (catData) setCategoryStats(groupStatsByParent(catData));
        if (baanknetData) setBaanknetStats(baanknetData);

        if (globalData) {
          setGlobalCounts({
            activeMstc: globalData.activeMstc || 0,
            activeGem: globalData.activeGem || 0,
            activeBaanknet: globalData.activeBaanknet || 0,
            totalBaanknet: globalData.totalBaanknet || 0
          });
        }

        if (globalData && finData) {
          setFinancialData({
            emdTransactions: finData.emdTransactions || [],
            walletTransactions: finData.walletTransactions || [],
            bids: finData.bids || [],
            summary: {
              totalUsers: globalData.totalUsers || 0,
              activeListings: globalData.activeListings || 0,
              emdHeld: finData.realEmdHeld || 0,
              emdVolume: finData.realEmdVolume || 0
            }
          });
        }

        // Process user growth metrics
        const profiles = profilesRes.data;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const growthMap: Record<string, { buyers: number, sellers: number }> = {};

        if (profiles && profiles.length > 0) {
          profiles.forEach((p: any) => {
            if (p.created_at) {
              const date = new Date(p.created_at);
              const monthStr = months[date.getMonth()];
              if (!growthMap[monthStr]) growthMap[monthStr] = { buyers: 0, sellers: 0 };
              if (p.role === 'seller') {
                growthMap[monthStr].sellers += 1;
              } else {
                growthMap[monthStr].buyers += 1;
              }
            }
          });
        }

        const currentMonth = new Date().getMonth();
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
          const mIdx = (currentMonth - i + 12) % 12;
          const mName = months[mIdx];
          const val = growthMap[mName] || { buyers: 0, sellers: 0 };
          last6Months.push({
            month: mName,
            buyers: val.buyers,
            sellers: val.sellers
          });
        }
        setLiveReportData({ growth: last6Months });
      } catch (err) {
        console.error('Failed loading reports data', err);
      } finally {
        setIsLoadingLocations(false);
        setIsLoadingCategories(false);
        setIsLoadingFinancial(false);
        setIsLoadingBaanknet(false);
      }
    }

    loadAllReportsData();
  }, []);

  useEffect(() => {
    if (categoryStats.historicalTotals.length > 0 && selectedChartCategories.length === 0) {
      setSelectedChartCategories(categoryStats.historicalTotals.slice(0, 8).map(t => t.name));
    }
  }, [categoryStats]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
    };
    if (dateDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dateDropdownOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    if (categoryDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [categoryDropdownOpen]);



  const handlePdfExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      window.print();
    }, 150);
  };

  // Date filtering logic
  const getLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const filterDateStr = (() => {
    const d = new Date();
    if (dateFilter === '7d') d.setDate(d.getDate() - 7);
    else if (dateFilter === '30d') d.setDate(d.getDate() - 30);
    return getLocalDateString(d);
  })();

  const filteredDaily = categoryStats.daily.filter(d => {
    if (dateFilter === 'all') return true;
    if (dateFilter === 'custom') {
      if (customStartDate && d.date < customStartDate) return false;
      if (customEndDate && d.date > customEndDate) return false;
      return true;
    }
    return d.date >= filterDateStr;
  });

  const filteredDailyRaw = categoryStats.dailyRaw.filter(d => {
    if (dateFilter === 'all') return true;
    if (dateFilter === 'custom') {
      if (customStartDate && d.date < customStartDate) return false;
      if (customEndDate && d.date > customEndDate) return false;
      return true;
    }
    return d.date >= filterDateStr;
  });

  const filteredTotalsMap: Record<string, number> = {};
  filteredDaily.forEach(day => {
    Object.keys(day).forEach(key => {
      if (key !== 'date') {
        filteredTotalsMap[key] = (filteredTotalsMap[key] || 0) + day[key];
      }
    });
  });

  const filteredTotals = categoryStats.historicalTotals.map(cat => ({
    name: cat.name,
    count: filteredTotalsMap[cat.name] || 0
  })).sort((a, b) => b.count - a.count);

  const getDisplayTotals = () => {
    if (dateFilter !== 'all') {
      return filteredTotals;
    }
    if (totalsTab === 'current') return categoryStats.currentTotals;
    return categoryStats.historicalTotals;
  };
  
  const displayTotals = getDisplayTotals();
  const totalItems = displayTotals.reduce((sum, c) => sum + c.count, 0);

  const getDisplayLocationTotals = () => {
    if (dateFilter !== 'all') {
      // Create filtered version similarly to categories if needed, for now just use historical as a fallback for non-all dates or we can filter it
      return locationStats.locations; 
    }
    if (locationTotalsTab === 'current') return locationStats.locations;
    return locationStats.historicalTotals;
  };

  const displayLocationTotals = getDisplayLocationTotals();
  const totalLocationItems = displayLocationTotals.reduce((sum, l) => sum + l.count, 0);

  // Search filtered totals
  const filteredDisplayTotals = displayTotals.filter(cat =>
    cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const filteredDisplayLocationTotals = displayLocationTotals.filter(loc =>
    (loc.state || loc.location).toLowerCase().includes(locationTotalsSearchQuery.toLowerCase()) || 
    (loc.district || '').toLowerCase().includes(locationTotalsSearchQuery.toLowerCase())
  );

  // Pie chart data structure
  const pieData = (() => {
    const selectedData = displayTotals
      .filter(cat => selectedChartCategories.includes(cat.name) && cat.count > 0);
    
    // Sort selected data descending by count
    selectedData.sort((a, b) => b.count - a.count);

    if (selectedData.length <= 10) {
      return selectedData.map(cat => ({
        name: cat.name,
        value: cat.count
      }));
    }

    const top8 = selectedData.slice(0, 9);
    const rest = selectedData.slice(9);
    const othersCount = rest.reduce((sum, c) => sum + c.count, 0);

    const result = top8.map(cat => ({
      name: cat.name,
      value: cat.count
    }));

    if (othersCount > 0) {
      result.push({
        name: 'Others',
        value: othersCount
      });
    }

    return result;
  })();

  // Build subcategory map for the selected date filter
  const filteredSubcategoriesMap: Record<string, number> = {};
  filteredDailyRaw.forEach(day => {
    Object.keys(day).forEach(key => {
      if (key !== 'date') {
        filteredSubcategoriesMap[key] = (filteredSubcategoriesMap[key] || 0) + day[key];
      }
    });
  });

  const filteredSubcategoryMap: Record<string, {name: string, count: number}[]> = {};
  Object.entries(filteredSubcategoriesMap).forEach(([fullName, count]) => {
    const parent = getParentCategory(fullName);
    const subName = fullName.includes('|') ? fullName.split('|')[1].trim() : fullName.trim();
    if (!filteredSubcategoryMap[parent]) filteredSubcategoryMap[parent] = [];
    filteredSubcategoryMap[parent].push({ name: subName, count });
  });
  Object.values(filteredSubcategoryMap).forEach(subs => subs.sort((a, b) => b.count - a.count));

  // Get filtered EMD transactions based on date filter
  const getFilteredEmdTransactions = () => {
    return financialData.emdTransactions.filter((tx: any) => {
      if (dateFilter === 'all') return true;
      const txDate = tx.created_at ? tx.created_at.split('T')[0] : '';
      if (dateFilter === 'custom') {
        if (customStartDate && txDate < customStartDate) return false;
        if (customEndDate && txDate > customEndDate) return false;
        return true;
      }
      return txDate >= filterDateStr;
    });
  };

  const filteredEmdTx = getFilteredEmdTransactions();

  // Calculate average pre-bid EMD and average EMD percentage for each category
  const categoryAverages = (() => {
    const parentAverages: Record<string, { preBidSum: number, preBidCount: number, emdPctSum: number, emdPctCount: number }> = {};
    
    filteredEmdTx.forEach((tx: any) => {
      // If viewing Current Inventory, only count currently held / active auctions
      if (totalsTab === 'current' && tx.status !== 'held') {
        return;
      }

      const parent = tx.category_name || 'Uncategorized';
      if (!parentAverages[parent]) {
        parentAverages[parent] = { preBidSum: 0, preBidCount: 0, emdPctSum: 0, emdPctCount: 0 };
      }
      
      const stats = parentAverages[parent];
      if (tx.amount > 0) {
        stats.preBidSum += tx.amount;
        stats.preBidCount += 1;
      }
      if (tx.emd_pct !== undefined && tx.emd_pct > 0) {
        stats.emdPctSum += tx.emd_pct;
        stats.emdPctCount += 1;
      }
    });

    const result: Record<string, { avgPreBid: number, avgEmdPct: number }> = {};
    const allParents = Array.from(new Set([
      ...categoryStats.currentTotals.map(c => c.name),
      ...categoryStats.historicalTotals.map(c => c.name)
    ]));

    allParents.forEach(parent => {
      const stats = parentAverages[parent];
      result[parent] = {
        avgPreBid: stats && stats.preBidCount > 0 ? Math.round(stats.preBidSum / stats.preBidCount) : 0,
        avgEmdPct: stats && stats.emdPctCount > 0 ? parseFloat((stats.emdPctSum / stats.emdPctCount).toFixed(2)) : 0
      };
    });
    return result;
  })();

  // Helper to trigger CSV download
  const triggerCsvDownload = (csvContent: string, filename: string) => {
    // Add UTF-8 Byte Order Mark (\uFEFF) so Excel opens UTF-8 symbols & text perfectly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Escape and quote a CSV cell value
  const csvCell = (val: string | number) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadCategoryCSV = () => {
    const mstcList = (overviewSourceFilter === 'baanknet') ? [] : displayTotals.map(c => ({
      name: c.name,
      count: c.count,
      source: 'MSTC Scrap',
      avgVal: categoryAverages[c.name]?.avgPreBid || 0,
      emdPct: categoryAverages[c.name]?.avgEmdPct || 0
    }));

    const baanknetList = (overviewSourceFilter === 'mstc' || !baanknetStats?.categoryDistribution) ? [] : 
      baanknetStats.categoryDistribution.map((c: any) => ({
        name: c.name,
        count: c.count,
        source: 'BaankNet',
        avgVal: c.avgReserve || 0,
        emdPct: 10
      }));

    const combined = [...mstcList, ...baanknetList].sort((a, b) => b.count - a.count);
    const totalCount = combined.reduce((sum, c) => sum + c.count, 0);

    const lines: string[] = [
      'Category Name,Source,Item Count,Share of Total (%)'
    ];

    combined.forEach(cat => {
      const catPct = totalCount > 0 ? ((cat.count / totalCount) * 100).toFixed(2) : '0.00';
      lines.push([
        csvCell(cat.name),
        csvCell(cat.source),
        cat.count,
        `${catPct}%`
      ].join(','));
    });

    const filterLabel = `${overviewSourceFilter}_${dateFilter === 'all' ? totalsTab : dateFilter}`;
    triggerCsvDownload(lines.join('\n'), `category_inventory_${filterLabel}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const displayLocationDataset = locationTotalsTab === 'current' ? locationStats.locations : locationStats.historicalTotals;

  const downloadLocationCSV = () => {
    const headers = ['State', 'District / Regional HQ', 'Total Auctions', 'Share of Total (%)', 'Primary Category'];
    const rows = displayLocationDataset.map(loc =>
      [
        csvCell(loc.state || loc.location),
        csvCell(loc.district || loc.location),
        loc.count,
        `${loc.percentage}%`,
        csvCell(loc.topCategory)
      ].join(',')
    );
    triggerCsvDownload([headers.join(','), ...rows].join('\n'), `auctions_by_location_${locationTotalsTab}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadEmdCSV = () => {
    const headers = ['Transaction Reference', 'User ID', 'Amount (₹)', 'Status', 'Payment Method', 'Date'];
    const rows = financialData.emdTransactions.map((tx: any) =>
      [csvCell(tx.transaction_reference || 'N/A'), csvCell(tx.user_id || ''), tx.amount, csvCell(tx.status || ''), csvCell(tx.payment_method || 'NetBanking'), csvCell(new Date(tx.created_at).toLocaleString())].join(',')
    );
    triggerCsvDownload([headers.join(','), ...rows].join('\n'), `emd_ledger_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadWalletCSV = () => {
    const headers = ['Transaction ID', 'User Name', 'Amount (₹)', 'Type', 'Status', 'Reference ID', 'Description', 'Date'];
    const rows = financialData.walletTransactions.map((tx: any) => {
      const userName = tx.profiles ? `${tx.profiles.first_name || ''} ${tx.profiles.last_name || ''}`.trim() : tx.user_id || 'N/A';
      return [
        csvCell(tx.id || 'N/A'),
        csvCell(userName),
        tx.amount,
        csvCell(tx.transaction_type || 'N/A'),
        csvCell(tx.status || 'completed'),
        csvCell(tx.reference_id || 'N/A'),
        csvCell(tx.description || 'N/A'),
        csvCell(new Date(tx.created_at).toLocaleString())
      ].join(',');
    });
    triggerCsvDownload([headers.join(','), ...rows].join('\n'), `wallet_ledger_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadBidsCSV = () => {
    const headers = ['Bid ID', 'Bidder Name', 'Auction Title', 'Amount (₹)', 'Status', 'Date'];
    const rows = financialData.bids.map((tx: any) => {
      const userName = tx.profiles ? `${tx.profiles.first_name || ''} ${tx.profiles.last_name || ''}`.trim() : tx.bidder_id || 'N/A';
      const auctionTitle = tx.auctions?.title || 'N/A';
      return [
        csvCell(tx.id || 'N/A'),
        csvCell(userName),
        csvCell(auctionTitle),
        tx.amount,
        csvCell(tx.status || 'active'),
        csvCell(new Date(tx.created_at).toLocaleString())
      ].join(',');
    });
    triggerCsvDownload([headers.join(','), ...rows].join('\n'), `bids_ledger_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadBaanknetCategoriesCSV = () => {
    if (!baanknetStats || !baanknetStats.categoryDistribution) return;
    const headers = [
      'Category Name',
      'Parent Domain',
      'Property Classes Included',
      'Auctions Count',
      'Share of BaankNet (%)',
      'Total Estimated Reserve (₹)',
      'Average Reserve Price (₹)',
      'Live Auctions',
      'Upcoming Auctions',
      'Leading Offering Bank',
      'Top Participating Banks',
      'Primary State'
    ];
    const rows = baanknetStats.categoryDistribution.map((c: any) =>
      [
        csvCell(c.name),
        csvCell(c.parent),
        csvCell(c.propertyTypesText || ''),
        c.count,
        `${c.percentage}%`,
        Math.round(c.totalReserve || 0),
        Math.round(c.avgReserve || 0),
        c.liveCount || 0,
        c.upcomingCount || 0,
        csvCell(c.topBank || 'N/A'),
        csvCell(c.topBanksText || ''),
        csvCell(c.topState || 'Pan-India')
      ].join(',')
    );
    triggerCsvDownload([headers.join(','), ...rows].join('\n'), `baanknet_categories_breakdown_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadBaanknetCSV = () => {
    if (!baanknetStats || !baanknetStats.bankDistribution) return;
    const headers = [
      'Bank / Financial Institution',
      'Auctions Count',
      'Share of Total (%)',
      'Total Reserve Price (₹)',
      'Average Reserve Price (₹)',
      'All Categories Handled',
      'Top Asset Class',
      'Primary Operating State'
    ];
    const rows = baanknetStats.bankDistribution.map((b: any) =>
      [
        csvCell(b.bank),
        b.count,
        `${b.percentage}%`,
        Math.round(b.totalReserve || 0),
        Math.round(b.avgReserve || 0),
        csvCell(b.categoriesText || 'Bank Foreclosure'),
        csvCell(b.topPropertyType || 'N/A'),
        csvCell(b.topState || 'Pan-India')
      ].join(',')
    );
    triggerCsvDownload([headers.join(','), ...rows].join('\n'), `baanknet_bank_distribution_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadBaanknetListingsCSV = () => {
    if (!baanknetStats || !baanknetStats.sampleAuctions) return;
    const headers = ['Bank Name', 'Title', 'Category', 'Property Type', 'State', 'City', 'Reserve Price (₹)', 'Status', 'Start Date', 'End Date', 'Source URL'];
    const rows = baanknetStats.sampleAuctions.map((a: any) =>
      [
        csvCell(a.bank_name || 'N/A'),
        csvCell(a.title || 'N/A'),
        csvCell(a.category_name || 'Bank Foreclosure'),
        csvCell(a.property_type || 'N/A'),
        csvCell(a.state || 'N/A'),
        csvCell(a.city || 'N/A'),
        a.reserve_price_value || 0,
        csvCell(a.auction_status || 'upcoming'),
        csvCell(a.auction_start_date ? new Date(a.auction_start_date).toLocaleDateString() : 'N/A'),
        csvCell(a.auction_end_date ? new Date(a.auction_end_date).toLocaleDateString() : 'N/A'),
        csvCell(a.source_url || '')
      ].join(',')
    );
    triggerCsvDownload([headers.join(','), ...rows].join('\n'), `baanknet_auctions_catalog_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportCSV = () => {
    const filterLabel = dateFilter === 'all' ? totalsTab : dateFilter;
    const lines: string[] = [];

    // ── Section 1: Platform Summary Metrics ──
    lines.push('PLATFORM SUMMARY METRICS');
    lines.push('Metric,Value');
    lines.push(`Total Registered Users,${financialData.summary.totalUsers || 0}`);
    lines.push(`Total Active Listings (All Sources),${financialData.summary.activeListings || 0}`);
    lines.push(`"  • MSTC Active Scrap Listings",${globalCounts.activeMstc || 0}`);
    lines.push(`"  • BaankNet Active Bank Properties",${globalCounts.activeBaanknet || 0}`);
    lines.push(`"  • GeM Procurement Listings & Bids",${globalCounts.activeGem || 0}`);
    lines.push(`Pre-Bid EMD Currently Held (₹),${Math.round(financialData.summary.emdHeld || 0)}`);
    lines.push(`Total Pre-Bid EMD Volume (₹),${Math.round(financialData.summary.emdVolume || 0)}`);
    if (baanknetStats?.summary) {
      lines.push(`BaankNet Bank Reserve Portfolio Value (₹),${Math.round(baanknetStats.summary.totalReserveValue || 0)}`);
      lines.push(`BaankNet Participating Banks,${baanknetStats.summary.participatingBanksCount || 0}`);
      lines.push(`BaankNet Categories Count,${baanknetStats.summary.categoriesCount || 0}`);
      lines.push(`BaankNet Property Types Count,${baanknetStats.summary.propertyTypesCount || 0}`);
      lines.push(`BaankNet States Covered,${baanknetStats.summary.statesCount || 0}`);
    }
    lines.push('');
    lines.push('');

    // ── Section 2: MSTC Category Inventory Breakdown ──
    const totalItems = displayTotals.reduce((sum, c) => sum + c.count, 0);

    lines.push('MSTC INDUSTRIAL SCRAP CATEGORY INVENTORY');
    lines.push('Category Name,Item Count,Share of Total');

    displayTotals.forEach(cat => {
      const catPct = totalItems > 0 ? ((cat.count / totalItems) * 100).toFixed(2) : '0.00';

      lines.push([
        csvCell(cat.name), 
        cat.count, 
        `${catPct}%`
      ].join(','));
    });
    lines.push([csvCell('TOTAL MSTC CATEGORIES SUMMARY'), totalItems, '100.00%'].join(','));
    lines.push('');
    lines.push('');

    // ── Section 3: Location & Region Breakdown ──
    lines.push('MSTC LOCATION & REGION BREAKDOWN');
    lines.push('State,District / Regional HQ,Auctions Count,Share of Total,Primary Category');

    locationStats.locations.forEach(loc => {
      lines.push([
        csvCell(loc.state || loc.location),
        csvCell(loc.district || loc.location),
        loc.count,
        `${loc.percentage}%`,
        csvCell(loc.topCategory || 'N/A')
      ].join(','));
    });
    lines.push([csvCell('TOTAL REGIONS SUMMARY'), `${locationStats.locations.length} Regions Tracked`, locationStats.totalAuctions, '100.00%', 'All Categories'].join(','));
    lines.push('');
    lines.push('');

    // ── Section 4: BaankNet Category Inventory Breakdown ──
    if (baanknetStats && baanknetStats.categoryDistribution) {
      lines.push('BAANKNET CATEGORY INVENTORY BREAKDOWN (PSB ALLIANCE)');
      lines.push('Category Name,Parent Domain,Auctions Count,Share of Total (%),Total Reserve Price (₹),Avg Reserve Price (₹),Live Auctions,Upcoming Auctions,Leading Offering Bank,Property Types Included,Primary State');
      baanknetStats.categoryDistribution.forEach((c: any) => {
        lines.push([
          csvCell(c.name),
          csvCell(c.parent),
          c.count,
          `${c.percentage}%`,
          Math.round(c.totalReserve || 0),
          Math.round(c.avgReserve || 0),
          c.liveCount || 0,
          c.upcomingCount || 0,
          csvCell(c.topBank || 'N/A'),
          csvCell(c.propertyTypesText || ''),
          csvCell(c.topState || 'Pan-India')
        ].join(','));
      });
      lines.push('');
      lines.push('');
    }

    // ── Section 5: BaankNet Property Asset Classification ──
    if (baanknetStats && baanknetStats.propertyTypeDistribution) {
      lines.push('BAANKNET PROPERTY ASSET CLASSIFICATION');
      lines.push('Property Class,Parent Domain,Auctions Count,Share of Total (%),Total Reserve Price (₹),Avg Reserve Price (₹),Top Offering Bank,Primary State');
      baanknetStats.propertyTypeDistribution.forEach((p: any) => {
        lines.push([
          csvCell(p.type),
          csvCell(p.parentCategory),
          p.count,
          `${p.percentage}%`,
          Math.round(p.totalReserve || 0),
          Math.round(p.avgReserve || 0),
          csvCell(p.topBank || 'N/A'),
          csvCell(p.topState || 'Pan-India')
        ].join(','));
      });
      lines.push('');
      lines.push('');
    }

    // ── Section 6: BaankNet Bank Asset Auctions (PSB Alliance) ──
    if (baanknetStats && baanknetStats.bankDistribution) {
      lines.push('BAANKNET BANK ASSET AUCTIONS (PSB ALLIANCE)');
      lines.push('Bank Name,Auctions Count,Share of Total (%),Total Reserve Price (₹),Avg Reserve Price (₹),All Categories Handled,Top Asset Class,Primary Operating State');
      baanknetStats.bankDistribution.forEach((b: any) => {
        lines.push([
          csvCell(b.bank),
          b.count,
          `${b.percentage}%`,
          Math.round(b.totalReserve || 0),
          Math.round(b.avgReserve || 0),
          csvCell(b.categoriesText || 'Bank Foreclosure'),
          csvCell(b.topPropertyType || 'N/A'),
          csvCell(b.topState || 'Pan-India')
        ].join(','));
      });
      lines.push('');
      lines.push('');
    }

    // ── Section 7: BaankNet Geographic State Breakdown ──
    if (baanknetStats && baanknetStats.stateDistribution) {
      lines.push('BAANKNET GEOGRAPHIC STATE BREAKDOWN');
      lines.push('State / Union Territory,Auctions Count,Share of Total (%),Total Reserve Price (₹),Leading Bank,Top Category');
      baanknetStats.stateDistribution.forEach((s: any) => {
        lines.push([
          csvCell(s.state),
          s.count,
          `${s.percentage}%`,
          Math.round(s.totalReserve || 0),
          csvCell(s.topBank || 'N/A'),
          csvCell(s.topCategory || 'Bank Property')
        ].join(','));
      });
      lines.push('');
      lines.push('');
    }

    // ── Section 8: BaankNet Valuation Brackets ──
    if (baanknetStats && baanknetStats.priceBracketDistribution) {
      lines.push('BAANKNET VALUATION BRACKETS');
      lines.push('Valuation Tier,Auctions Count,Share of Total (%)');
      baanknetStats.priceBracketDistribution.forEach((t: any) => {
        lines.push([
          csvCell(t.tier),
          t.count,
          `${t.percentage}%`
        ].join(','));
      });
      lines.push('');
    }

    triggerCsvDownload(lines.join('\n'), `platform_analytics_report_${filterLabel}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2 text-primary" /> Reports & Analytics
          </h2>
          <p className="text-slate-500 text-sm mt-1">Platform performance metrics and data exports.</p>
        </div>
        <div className="flex gap-3 print:hidden">
          <button 
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-lg flex items-center transition-colors cursor-pointer select-none"
          >
            <Download className="w-4 h-4 mr-2" /> CSV Export
          </button>
          <button 
            type="button"
            onClick={handlePdfExport}
            disabled={isExporting}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold text-sm rounded-lg flex items-center transition-colors disabled:opacity-50 cursor-pointer select-none"
          >
            {isExporting ? 'Generating...' : <><FileText className="w-4 h-4 mr-2" /> PDF Report</>}
          </button>
        </div>
      </div>

      {exportMessage && (
        <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm font-bold border border-green-200 flex items-center print:hidden">
          <CheckCircle2 className="w-5 h-5 mr-2" /> {exportMessage}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6 print:hidden overflow-x-auto">
        {(['overview', 'location', 'baanknet'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer capitalize whitespace-nowrap flex items-center gap-2",
              activeTab === tab
                ? tab === 'baanknet'
                  ? "border-amber-500 text-amber-600"
                  : "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            {tab === 'location' && <MapPin className="w-4 h-4" />}
            {tab === 'baanknet' && <Landmark className="w-4 h-4 text-amber-500" />}
            {tab === 'location' ? 'Location Analytics' : tab === 'baanknet' ? 'BaankNet Bank Analytics' : 'Overview'}
            {tab === 'baanknet' && (
              <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                PSB Alliance
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoadingCategories || isLoadingFinancial || isLoadingBaanknet ? (
        <div className="flex justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {activeTab === 'overview' && (
            <>
              {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 print:grid-cols-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Users</h3>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{(financialData.summary.totalUsers || 0).toLocaleString()}</p>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Buyers & sellers registered</p>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Gavel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Listings</h3>
                  <p className="text-2xl font-extrabold text-slate-900 leading-none mt-0.5">{(financialData.summary.activeListings || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-bold">
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100" title="MSTC Scrap Auctions">
                  MSTC: {globalCounts.activeMstc}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1" title="BaankNet PSB Bank Assets">
                  <Landmark className="w-3 h-3 text-amber-600" />
                  Bank: {globalCounts.activeBaanknet}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100" title="GeM Procurement">
                  GeM: {globalCounts.activeGem}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pre-Bid EMD Held</h3>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">₹{(financialData.summary.emdHeld || 0).toLocaleString()}</p>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Secured bidder deposits</p>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('baanknet')}
              className="bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-white p-5 rounded-2xl shadow-sm border border-amber-200 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Landmark className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-amber-800 text-xs font-bold uppercase tracking-wider truncate">BaankNet Reserve</h3>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-500 text-white">PSB</span>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-0.5 truncate">
                  ₹{baanknetStats?.summary?.totalReserveValue ? (baanknetStats.summary.totalReserveValue >= 10000000 ? (baanknetStats.summary.totalReserveValue / 10000000).toFixed(1) + ' Cr' : (baanknetStats.summary.totalReserveValue / 100000).toFixed(1) + ' L') : '0'}
                </p>
                <p className="text-[11px] text-amber-700/80 font-bold flex items-center gap-1 mt-0.5">
                  <span>{(baanknetStats?.summary?.total || 0).toLocaleString()} Bank Assets</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </p>
              </div>
            </div>
          </div>

          {/* Category Analysis Panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-primary" /> Category Analysis
                </h2>
                {/* Chart Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl print:hidden">
                  <button
                    type="button"
                    onClick={() => setChartType('line')}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                      chartType === 'line' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <TrendingUp className="w-4 h-4" /> Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('pie')}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                      chartType === 'pie' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <PieIcon className="w-4 h-4" /> Share
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 print:hidden">
                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary/50 transition-all"
                    />
                    <span className="text-slate-400 text-xs font-semibold">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                )}

                {/* Date Dropdown Select */}
                <div className="relative" ref={dateDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-100 transition-all cursor-pointer select-none"
                  >
                    Date Filter: {
                      dateFilter === '7d' ? 'Last 7 Days' : 
                      dateFilter === '30d' ? 'Last 30 Days' : 
                      dateFilter === 'custom' ? 'Custom Range' : 'All-Time'
                    }
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {dateDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-fade-in">
                      <button
                        type="button"
                        onClick={() => { setDateFilter('7d'); setDateDropdownOpen(false); }}
                        className={clsx(
                          "w-full text-left px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                          dateFilter === '7d' ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        Last 7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDateFilter('30d'); setDateDropdownOpen(false); }}
                        className={clsx(
                          "w-full text-left px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                          dateFilter === '30d' ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        Last 30 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDateFilter('all'); setDateDropdownOpen(false); }}
                        className={clsx(
                          "w-full text-left px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                          dateFilter === 'all' ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        All-Time History
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDateFilter('custom'); setDateDropdownOpen(false); }}
                        className={clsx(
                          "w-full text-left px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                          dateFilter === 'custom' ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        Custom Range
                      </button>
                    </div>
                  )}
                </div>

                {/* Multi-Select Category Dropdown */}
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-100 transition-all cursor-pointer select-none"
                  >
                    Select Categories ({selectedChartCategories.length})
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {categoryDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 animate-fade-in custom-scrollbar">
                      <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-100 px-2">
                        <button
                          type="button"
                          onClick={() => setSelectedChartCategories(displayTotals.map(c => c.name))}
                          className="text-xs font-bold text-primary hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedChartCategories([])}
                          className="text-xs font-bold text-slate-400 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="space-y-1">
                        {displayTotals.map(cat => (
                          <label key={cat.name} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer select-none text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedChartCategories.includes(cat.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChartCategories([...selectedChartCategories, cat.name]);
                                } else {
                                  setSelectedChartCategories(selectedChartCategories.filter(name => name !== cat.name));
                                }
                              }}
                              className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                            />
                            <span className="truncate">{cat.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main analysis view */}
            {chartType === 'line' ? (
              <div className="h-96 print:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredDaily}>
                    <defs>
                      {displayTotals.map(cat => (
                        <linearGradient key={cat.name} id={`color_${cat.name.replace(/\s+/g, '_')}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={getCategoryColor(cat.name)} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={getCategoryColor(cat.name)} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    {displayTotals
                      .filter(cat => selectedChartCategories.includes(cat.name))
                      .map(cat => (
                        <Area
                          key={cat.name}
                          type="monotone"
                          dataKey={cat.name}
                          stroke={getCategoryColor(cat.name)}
                          fillOpacity={1}
                          fill={`url(#color_${cat.name.replace(/\s+/g, '_')})`}
                          name={cat.name}
                          strokeWidth={2}
                          stackId="1"
                        />
                      ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-96 flex flex-col md:flex-row items-center justify-center gap-8">
                {pieData.length === 0 ? (
                  <p className="text-slate-500 text-sm font-semibold">Select categories to display visual data.</p>
                ) : (
                  <>
                    <div className="w-full md:w-1/2 h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name)} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, 'Items Count']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 max-h-80 overflow-y-auto grid grid-cols-2 gap-4 p-2 custom-scrollbar">
                      {pieData.map((entry, index) => {
                        const pct = totalItems > 0 ? ((entry.value / totalItems) * 100).toFixed(1) : '0.0';
                        return (
                          <div key={entry.name} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(entry.name) }} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate" title={entry.name}>{entry.name}</p>
                              <p className="text-[10px] text-slate-500 font-bold mt-0.5">{entry.value} ({pct}%)</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Location Analysis Panel on Overview Tab */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-primary" /> Location Analysis
                </h2>
                {/* Chart Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl print:hidden">
                  <button
                    type="button"
                    onClick={() => setLocChartType('bar')}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                      locChartType === 'bar' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <BarChart3 className="w-4 h-4" /> Volume
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocChartType('pie')}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                      locChartType === 'pie' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <PieIcon className="w-4 h-4" /> Share
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 print:hidden">
                <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  {locationStats.locations.length} Regions Indexed
                </span>
                <button
                  type="button"
                  onClick={downloadLocationCSV}
                  className="p-2 text-slate-500 hover:text-primary hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-2xs cursor-pointer"
                  title="Export Location CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main chart view */}
            {locChartType === 'bar' ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={locationStats.locations.slice(0, 12)} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="location" 
                      tick={{fontSize: 11, fill: '#64748b'}} 
                      interval={0} 
                      angle={-20} 
                      textAnchor="end" 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} />
                    <Bar dataKey="count" name="Auctions Count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex flex-col md:flex-row items-center justify-center gap-8">
                {locationStats.locations.length === 0 ? (
                  <p className="text-slate-500 text-sm font-semibold">No location data available.</p>
                ) : (
                  <>
                    <div className="w-full md:w-1/2 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={locationStats.locations.slice(0, 8).map(l => ({ name: l.location, value: l.count }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={95}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {locationStats.locations.slice(0, 8).map((entry, index) => (
                              <Cell key={`cell-ov-loc-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar p-2">
                      {locationStats.locations.slice(0, 8).map((entry, index) => {
                        const total = locationStats.totalAuctions || 1;
                        const pct = ((entry.count / total) * 100).toFixed(1);
                        return (
                          <div key={entry.location} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate" title={entry.location}>{entry.location}</p>
                              <p className="text-[10px] text-slate-500 font-bold mt-0.5">{entry.count} ({pct}%)</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Platform Registration Growth Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-500" /> Platform Registration Growth
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liveReportData.growth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} />
                  <Legend />
                  <Bar dataKey="buyers" fill="#3b82f6" name="New Buyers" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sellers" fill="#8b5cf6" name="New Sellers" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Total Items by Region List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 flex flex-col mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                  <MapPin className="w-5 h-5 text-primary" /> Total Items by Region
                  <span className="px-2.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-bold select-none">
                    {totalLocationItems.toLocaleString()} Total Items
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={downloadLocationCSV}
                  className="p-2 text-slate-500 hover:text-primary hover:bg-slate-50 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-slate-200 shadow-2xs print:hidden"
                  title="Download CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-lg mb-4 print:hidden">
                <button
                  type="button"
                  onClick={() => { setLocationTotalsTab('current'); setExpandedLocation(null); }}
                  className={clsx(
                    "flex-1 text-sm font-semibold py-1.5 rounded-md transition-all cursor-pointer",
                    locationTotalsTab === 'current' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  Current Inventory
                </button>
                <button
                  type="button"
                  onClick={() => { setLocationTotalsTab('history'); setExpandedLocation(null); }}
                  className={clsx(
                    "flex-1 text-sm font-semibold py-1.5 rounded-md transition-all cursor-pointer",
                    locationTotalsTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  All-Time History
                </button>
              </div>

              {/* Search box inside region totals list */}
              <div className="relative mb-4 print:hidden">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search region..."
                  value={locationTotalsSearchQuery}
                  onChange={(e) => setLocationTotalsSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="overflow-y-auto pr-1 flex-1 max-h-[550px] print:max-h-none custom-scrollbar">
                {filteredDisplayLocationTotals.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">No regions found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold">
                          <th className="pb-2.5 font-bold">Region</th>
                          <th className="pb-2.5 font-bold">District</th>
                          <th className="pb-2.5 font-bold text-center">Share</th>
                          <th className="pb-2.5 font-bold text-right">Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                        {filteredDisplayLocationTotals.map((loc, idx) => {
                           const pct = totalLocationItems > 0 ? ((loc.count / totalLocationItems) * 100).toFixed(1) : '0.0';
                           const isExpanded = expandedLocation === `${loc.location}-${idx}`;
                             return (
                             <Fragment key={`${loc.location}-${idx}`}>
                               <tr 
                                 onClick={() => setExpandedLocation(isExpanded ? null : `${loc.location}-${idx}`)}
                                 className={clsx(
                                   "hover:bg-slate-50/50 transition-colors cursor-pointer",
                                   isExpanded && "bg-slate-50/80"
                                 )}
                               >
                                 <td className="py-2.5 flex items-center gap-2 min-w-0">
                                   <ChevronRight className={clsx("w-4 h-4 text-slate-400 transition-transform", isExpanded && "rotate-90 text-primary")} />
                                   <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                                   <span className="truncate font-semibold text-slate-700" title={loc.state || loc.location}>
                                     {loc.state || loc.location}
                                   </span>
                                 </td>
                                 <td className="py-2.5 text-left font-mono text-xs text-slate-500 truncate">
                                   {loc.district || loc.location}
                                 </td>
                                 <td className="py-2.5 text-center font-mono text-xs text-slate-500">
                                   {pct}%
                                 </td>
                                 <td className="py-2.5 text-right font-bold text-slate-900">
                                   {loc.count.toLocaleString()}
                                 </td>
                               </tr>
                               {isExpanded && loc.categories && loc.categories.length > 0 && (
                                 <tr className="bg-slate-50/50 border-t border-slate-100">
                                   <td colSpan={4} className="py-3 px-8">
                                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                       {loc.categories.map((cat, cIdx) => (
                                         <div key={cIdx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                                           <span className="text-xs font-semibold text-slate-600 truncate mr-2" title={cat.name}>{cat.name}</span>
                                           <span className="text-xs font-bold text-slate-900 font-mono bg-slate-100 px-1.5 py-0.5 rounded-md">{cat.count.toLocaleString()}</span>
                                         </div>
                                       ))}
                                     </div>
                                   </td>
                                 </tr>
                               )}
                             </Fragment>
                           );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

          {/* Total Items by Category List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-primary" /> Total Items by Category
                  <span className="px-2.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-bold select-none">
                    {overviewSourceFilter === 'baanknet'
                      ? `${(baanknetStats?.summary?.total || 0).toLocaleString()} BaankNet Items`
                      : overviewSourceFilter === 'mstc'
                      ? `${totalItems.toLocaleString()} MSTC Items`
                      : `${(totalItems + (baanknetStats?.summary?.total || 0)).toLocaleString()} Combined Items`}
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={downloadCategoryCSV}
                  className="p-2 text-slate-500 hover:text-primary hover:bg-slate-50 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-slate-200 shadow-2xs print:hidden"
                  title="Download CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-lg mb-4 print:hidden">
                <button
                  type="button"
                  onClick={() => setTotalsTab('current')}
                  className={clsx(
                    "flex-1 text-sm font-semibold py-1.5 rounded-md transition-all cursor-pointer",
                    totalsTab === 'current' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  Current Inventory
                </button>
                <button
                  type="button"
                  onClick={() => setTotalsTab('history')}
                  className={clsx(
                    "flex-1 text-sm font-semibold py-1.5 rounded-md transition-all cursor-pointer",
                    totalsTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  All-Time History
                </button>
              </div>

              {/* Source Switcher: All | MSTC Industrial | BaankNet Real Estate & Bank Assets */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl mb-4 print:hidden">
                <button
                  type="button"
                  onClick={() => setOverviewSourceFilter('all')}
                  className={clsx(
                    "flex-1 text-xs font-bold py-1.5 rounded-lg transition-all cursor-pointer select-none",
                    overviewSourceFilter === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  All Sources
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewSourceFilter('mstc')}
                  className={clsx(
                    "flex-1 text-xs font-bold py-1.5 rounded-lg transition-all cursor-pointer select-none",
                    overviewSourceFilter === 'mstc' ? "bg-primary text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  MSTC Scrap ({displayTotals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewSourceFilter('baanknet')}
                  className={clsx(
                    "flex-1 text-xs font-bold py-1.5 rounded-lg transition-all cursor-pointer select-none flex items-center justify-center gap-1",
                    overviewSourceFilter === 'baanknet' ? "bg-amber-600 text-white shadow-xs" : "text-amber-800 hover:text-amber-900"
                  )}
                >
                  <Landmark className="w-3 h-3" /> BaankNet ({baanknetStats?.categoryDistribution?.length || 0})
                </button>
              </div>

              {/* Search box inside category totals list */}
              <div className="relative mb-4 print:hidden">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search category..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="overflow-y-auto pr-1 flex-1 max-h-[550px] print:max-h-none custom-scrollbar">
                {(() => {
                  const mstcList = (overviewSourceFilter === 'baanknet') ? [] : filteredDisplayTotals.map(c => ({
                    ...c,
                    source: 'MSTC Scrap',
                    isBaanknet: false,
                    avgReserve: null
                  }));
                  const baanknetList = (overviewSourceFilter === 'mstc' || !baanknetStats?.categoryDistribution) ? [] : 
                    baanknetStats.categoryDistribution
                      .filter((c: any) => !categorySearchQuery || c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                      .map((c: any) => ({
                        name: c.name,
                        count: c.count,
                        source: 'BaankNet',
                        isBaanknet: true,
                        avgReserve: c.avgReserve,
                        totalReserve: c.totalReserve
                      }));

                  const combinedList = [...mstcList, ...baanknetList].sort((a, b) => b.count - a.count);

                  if (combinedList.length === 0) {
                    return <p className="text-slate-500 text-sm text-center py-4">No categories found.</p>;
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold">
                            <th className="pb-2.5 font-bold">Category</th>
                            <th className="pb-2.5 font-bold text-center">Source</th>
                            <th className="pb-2.5 font-bold text-center">Share of Total</th>
                            <th className="pb-2.5 font-bold text-right">Count</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                          {combinedList.map((cat) => {
                            const totalFilteredCount = combinedList.reduce((sum, c) => sum + c.count, 0);
                            const sharePct = totalFilteredCount > 0 ? ((cat.count / totalFilteredCount) * 100).toFixed(1) : '0.0';
                            return (
                              <tr key={`${cat.source}-${cat.name}`} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-2.5 flex items-center gap-1.5 min-w-0">
                                  <div 
                                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                                    style={{ backgroundColor: cat.isBaanknet ? '#d97706' : getCategoryColor(cat.name) }}
                                  />
                                  <span className="truncate font-semibold text-slate-700 max-w-[340px] sm:max-w-[450px]" title={cat.name}>
                                    {cat.name}
                                  </span>
                                </td>
                                <td className="py-2.5 text-center">
                                  <span className={clsx(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                    cat.isBaanknet ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-100 text-blue-800 border border-blue-200"
                                  )}>
                                    {cat.source}
                                  </span>
                                </td>
                                <td className="py-2.5 text-center font-mono text-xs text-slate-500 font-semibold">
                                  {sharePct}%
                                </td>
                                <td className="py-2.5 text-right font-bold text-slate-900 font-mono">
                                  {cat.count.toLocaleString()}
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
            </div>

            {/* Total Items by Location List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 flex flex-col mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                  <MapPin className="w-5 h-5 text-primary" /> Total Items by Location / Region
                  <span className="px-2.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-bold select-none">
                    {locationStats.locations.length} Regions Tracked
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={downloadLocationCSV}
                  className="p-2 text-slate-500 hover:text-primary hover:bg-slate-50 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-slate-200 shadow-2xs print:hidden"
                  title="Download Location CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto pr-1 flex-1 max-h-[450px] print:max-h-none custom-scrollbar">
                {locationStats.locations.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">No locations found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold">
                          <th className="pb-2.5 font-bold">State</th>
                          <th className="pb-2.5 font-bold">District / Regional HQ</th>
                          <th className="pb-2.5 font-bold text-center">Share</th>
                          <th className="pb-2.5 font-bold">Primary Category</th>
                          <th className="pb-2.5 font-bold text-right">Auctions Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                        {locationStats.locations.map((loc) => (
                          <tr key={loc.location} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 font-bold text-slate-900 flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                              {loc.state || loc.location}
                            </td>
                            <td className="py-2.5 font-semibold text-slate-600">
                              {loc.district || loc.location}
                            </td>
                            <td className="py-2.5 text-center font-mono text-xs text-slate-500">
                              {loc.percentage}%
                            </td>
                            <td className="py-2.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                {loc.topCategory}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-bold text-slate-900 font-mono">
                              {loc.count.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
        </>
      )}

      {activeTab === 'location' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header & Dataset Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" /> Location Analytics Scope
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Switch between active catalog inventory and all-time historical records.</p>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl print:hidden">
              <button
                type="button"
                onClick={() => { setLocationTotalsTab('current'); setSelectedRegionName(null); }}
                className={clsx(
                  "px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer select-none",
                  locationTotalsTab === 'current' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Current Inventory ({locationStats.locations.length} Regions)
              </button>
              <button
                type="button"
                onClick={() => { setLocationTotalsTab('history'); setSelectedRegionName(null); }}
                className={clsx(
                  "px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer select-none",
                  locationTotalsTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                All-Time History ({locationStats.historicalTotals.length} Regions)
              </button>
            </div>
          </div>

          {/* Location KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Regions Tracked</h3>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{displayLocationDataset.length}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Top Region</h3>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5 truncate max-w-[200px]" title={displayLocationDataset[0]?.state || displayLocationDataset[0]?.location || 'N/A'}>
                  {displayLocationDataset[0] ? (displayLocationDataset[0].state || displayLocationDataset[0].location) : 'N/A'}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Indexed Auctions</h3>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
                  {displayLocationDataset.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Regional Deep-Dive Inspector Panel */}
          {(() => {
            const currentSelected = displayLocationDataset.find(l => l.location === selectedRegionName) || displayLocationDataset[0];
            if (!currentSelected) return null;
            return (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg uppercase tracking-wider">
                        {locationTotalsTab === 'current' ? 'Current' : 'All-Time'} Region Inspector
                      </span>
                      <h3 className="text-xl font-extrabold text-slate-900">{currentSelected.state || currentSelected.location}</h3>
                    </div>
                    <p className="text-slate-500 text-xs mt-1">HQ / District: <span className="font-semibold text-slate-700">{currentSelected.district || currentSelected.location}</span></p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-500">Select Region:</label>
                    <select
                      value={currentSelected.location}
                      onChange={(e) => setSelectedRegionName(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-primary/50 transition-all cursor-pointer"
                    >
                      {displayLocationDataset.map(loc => (
                        <option key={loc.location} value={loc.location}>
                          {loc.state || loc.location} ({loc.district || loc.location}) - {loc.count} items
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase">Auctions Count</p>
                    <p className="text-xl font-black text-slate-900 mt-1">{currentSelected.count.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase">Share of Scope</p>
                    <p className="text-xl font-black text-primary mt-1">{currentSelected.percentage}%</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase">Primary Category</p>
                    <p className="text-sm font-bold text-slate-800 mt-1 truncate" title={currentSelected.topCategory}>{currentSelected.topCategory}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase">Categories Count</p>
                    <p className="text-xl font-black text-slate-900 mt-1">{currentSelected.categories?.length || 0}</p>
                  </div>
                </div>

                {/* Region Category Breakdown Bar Chart */}
                {currentSelected.categories && currentSelected.categories.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" /> Category Distribution in {currentSelected.state || currentSelected.location} ({locationTotalsTab === 'current' ? 'Current' : 'All-Time'})
                    </h4>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={currentSelected.categories.slice(0, 8)} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} interval={0} angle={-15} textAnchor="end" tickLine={false} axisLine={false} />
                          <YAxis tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{fill: '#f1f5f9'}} />
                          <Bar dataKey="count" name="Auctions" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Location Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart: Auctions by Location */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" /> Auctions Volume by Location ({locationTotalsTab === 'current' ? 'Current' : 'All-Time'})
                </span>
                <span className="text-xs text-slate-400 font-semibold">Top 10 Regions</span>
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayLocationDataset.slice(0, 10)} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="location" 
                      tick={{fontSize: 11, fill: '#64748b'}} 
                      interval={0} 
                      angle={-25} 
                      textAnchor="end" 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} />
                    <Bar dataKey="count" name="Auctions Count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart: Region Market Share */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-emerald-600" /> Regional Market Share ({locationTotalsTab === 'current' ? 'Current' : 'All-Time'})
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={displayLocationDataset.slice(0, 7).map(l => ({ name: l.location, value: l.count }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {displayLocationDataset.slice(0, 7).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Location Breakdown Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" /> Location & Region Breakdown ({locationTotalsTab === 'current' ? 'Current Inventory' : 'All-Time History'})
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">Origin breakdown of scrap auctions processed across India.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search region..."
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <select
                  value={locationCategoryFilter}
                  onChange={(e) => setLocationCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-primary/50 transition-all cursor-pointer"
                >
                  <option value="all">All Primary Categories</option>
                  {Array.from(new Set(displayLocationDataset.map(l => l.topCategory))).filter(Boolean).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={downloadLocationCSV}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl flex items-center gap-2 transition-colors cursor-pointer select-none"
                >
                  <Download className="w-4 h-4" /> CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-6 py-4 font-bold">State</th>
                    <th className="px-6 py-4 font-bold">District / Regional HQ</th>
                    <th className="px-6 py-4 font-bold text-center">Auctions Count</th>
                    <th className="px-6 py-4 font-bold text-center">Share of Total</th>
                    <th className="px-6 py-4 font-bold">Primary Category</th>
                    <th className="px-6 py-4 font-bold">Distribution Bar</th>
                    <th className="px-6 py-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                  {displayLocationDataset
                    .filter(loc => {
                      const matchesSearch = (loc.state || loc.location).toLowerCase().includes(locationSearchQuery.toLowerCase()) || (loc.district || '').toLowerCase().includes(locationSearchQuery.toLowerCase());
                      const matchesCategory = locationCategoryFilter === 'all' || loc.topCategory === locationCategoryFilter;
                      return matchesSearch && matchesCategory;
                    })
                    .map((loc) => (
                      <tr 
                        key={loc.location} 
                        onClick={() => setSelectedRegionName(loc.location)}
                        className={clsx(
                          "hover:bg-slate-50/70 transition-colors cursor-pointer",
                          selectedRegionName === loc.location && "bg-blue-50/50"
                        )}
                      >
                        <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary shrink-0" />
                          {loc.state || loc.location}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-600">
                          {loc.district || loc.location}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-primary font-mono">
                          {loc.count.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-slate-600">
                          {loc.percentage}%
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            {loc.topCategory}
                          </span>
                        </td>
                        <td className="px-6 py-4 min-w-[160px]">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${Math.max(loc.percentage, 2)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRegionName(loc.location);
                              window.scrollTo({ top: 400, behavior: 'smooth' });
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer select-none"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'baanknet' && (
        <div className="space-y-6 animate-fade-in">
          {/* BaankNet Hero Header Banner */}
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/5 to-slate-50 border border-amber-300/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/25">
                <Landmark className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-amber-500 text-white rounded-md shadow-2xs">
                    PSB Alliance Network
                  </span>
                  <span className="text-xs font-bold text-amber-900/70 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                    Bank Asset Auction Feeds & Foreclosures
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                  BaankNet Bank Asset Intelligence & Analytics
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                  Dedicated analytical breakdown of public sector bank property auctions, distressed commercial assets, reserve valuation profiles, and state-wise banking auction footprints.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 print:hidden">
              <button
                type="button"
                onClick={downloadBaanknetCategoriesCSV}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer select-none"
                title="Export detailed Category Inventory CSV"
              >
                <Download className="w-4 h-4 text-amber-600" /> Export Categories CSV
              </button>
              <button
                type="button"
                onClick={downloadBaanknetCSV}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer select-none"
                title="Export Bank Distribution CSV"
              >
                <Download className="w-4 h-4 text-amber-600" /> Export Banks CSV
              </button>
              <button
                type="button"
                onClick={downloadBaanknetListingsCSV}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer select-none"
                title="Export Bank Auctions Catalog CSV"
              >
                <Download className="w-4 h-4" /> Export Catalog CSV
              </button>
            </div>
          </div>

          {/* BaankNet KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 hover:shadow-md hover:border-amber-300 transition-all">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Listings</p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {(baanknetStats?.summary?.total || 0).toLocaleString()}
              </p>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">All indexed properties</p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 hover:shadow-md hover:border-emerald-300 transition-all">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Auctions
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {(baanknetStats?.summary?.live || 0).toLocaleString()}
              </p>
              <p className="text-[11px] font-semibold text-emerald-700/80 mt-1">Active bidding window</p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 hover:shadow-md hover:border-amber-300 transition-all">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Upcoming
              </p>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {(baanknetStats?.summary?.upcoming || 0).toLocaleString()}
              </p>
              <p className="text-[11px] font-semibold text-amber-700/80 mt-1">Scheduled for auction</p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 hover:shadow-md hover:border-amber-300 transition-all">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-600" /> Portfolio Reserve
              </p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                ₹{baanknetStats?.summary?.totalReserveValue ? (baanknetStats.summary.totalReserveValue >= 10000000 ? (baanknetStats.summary.totalReserveValue / 10000000).toFixed(1) + ' Cr' : (baanknetStats.summary.totalReserveValue / 100000).toFixed(1) + ' L') : '0'}
              </p>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">Total asset valuation</p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 hover:shadow-md hover:border-blue-300 transition-all">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-500" /> Public Banks
              </p>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {baanknetStats?.summary?.participatingBanksCount || 0}
              </p>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">PSB & Commercial</p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-purple-100 hover:shadow-md hover:border-purple-300 transition-all">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-500" /> States / UTs
              </p>
              <p className="text-2xl font-black text-purple-600 mt-1">
                {baanknetStats?.summary?.statesCount || 0}
              </p>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">Pan-India coverage</p>
            </div>
          </div>

          {/* Section 1: BaankNet Master Category Directory & Asset Classification */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-600" /> Category Inventory & Asset Classification
                  </h3>
                  <span className="px-2.5 py-0.5 text-xs font-black bg-amber-100 text-amber-900 rounded-full border border-amber-300">
                    {baanknetStats?.categoryDistribution?.length || 0} Categories
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  Complete breakdown of indexed banking assets across Real Estate, Vehicles, and Industrial Plant & Machinery.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                {/* Domain Pill Filter */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  {(['all', 'Real Estate', 'Vehicles', 'Industrial'] as const).map((domain) => (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => setBaanknetParentFilter(domain)}
                      className={clsx(
                        "px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer select-none",
                        baanknetParentFilter === domain ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {domain === 'all' ? 'All Domains' : domain}
                    </button>
                  ))}
                </div>

                {/* Category Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search category or asset..."
                    value={baanknetCategorySearch}
                    onChange={(e) => setBaanknetCategorySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all w-48 sm:w-56"
                  />
                </div>

                <button
                  type="button"
                  onClick={downloadBaanknetCategoriesCSV}
                  className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-slate-200 shadow-2xs cursor-pointer"
                  title="Download Category Breakdown CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Directory Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-4 py-3 font-bold">Category & Domain</th>
                    <th className="px-4 py-3 font-bold">Asset Classes Included</th>
                    <th className="px-4 py-3 font-bold text-center">Auctions</th>
                    <th className="px-4 py-3 font-bold text-center">Share</th>
                    <th className="px-4 py-3 font-bold text-right">Est. Reserve Value</th>
                    <th className="px-4 py-3 font-bold text-right">Avg Reserve</th>
                    <th className="px-4 py-3 font-bold">Leading Bank</th>
                    <th className="px-4 py-3 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {(!baanknetStats?.categoryDistribution || baanknetStats.categoryDistribution.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400 font-semibold">
                        No BaankNet category records found.
                      </td>
                    </tr>
                  ) : (
                    baanknetStats.categoryDistribution
                      .filter((c: any) => {
                        const matchesDomain = baanknetParentFilter === 'all' || c.parent === baanknetParentFilter;
                        const q = baanknetCategorySearch.toLowerCase();
                        const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.propertyTypesText || '').toLowerCase().includes(q) || (c.topBank || '').toLowerCase().includes(q);
                        return matchesDomain && matchesSearch;
                      })
                      .map((c: any) => {
                        const isExpanded = expandedBaanknetCategory === c.name;
                        return (
                          <Fragment key={c.name}>
                            <tr 
                              onClick={() => setExpandedBaanknetCategory(isExpanded ? null : c.name)}
                              className={clsx(
                                "hover:bg-amber-50/30 transition-colors cursor-pointer",
                                isExpanded && "bg-amber-50/50"
                              )}
                            >
                              <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                                <span className={clsx(
                                  "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0",
                                  c.parent === 'Real Estate' ? "bg-blue-100 text-blue-800 border border-blue-200" :
                                  c.parent === 'Vehicles' ? "bg-amber-100 text-amber-800 border border-amber-200" :
                                  "bg-purple-100 text-purple-800 border border-purple-200"
                                )}>
                                  {c.parent}
                                </span>
                                <span className="text-xs text-slate-800 truncate max-w-[200px]" title={c.name}>
                                  {c.name.includes('|') ? c.name.split('|')[1].trim() : c.name}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 max-w-[220px]">
                                <div className="flex flex-wrap gap-1">
                                  {(c.propertyTypes || []).slice(0, 2).map((pt: any) => (
                                    <span key={pt.name} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                      {pt.name} ({pt.count})
                                    </span>
                                  ))}
                                  {(c.propertyTypes || []).length > 2 && (
                                    <span className="text-[10px] text-slate-400 font-bold">
                                      +{(c.propertyTypes || []).length - 2} more
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-amber-700 font-mono text-sm">
                                {c.count.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-slate-600">
                                {c.percentage}%
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                {c.totalReserve > 0 ? `₹${(c.totalReserve >= 10000000 ? (c.totalReserve / 10000000).toFixed(2) + ' Cr' : (c.totalReserve / 100000).toFixed(1) + ' L')}` : 'In Catalog'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-600">
                                {c.avgReserve > 0 ? `₹${(c.avgReserve >= 10000000 ? (c.avgReserve / 10000000).toFixed(2) + ' Cr' : (c.avgReserve / 100000).toFixed(1) + ' L')}` : 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-slate-800 text-xs truncate max-w-[140px]" title={c.topBank}>
                                <div className="flex items-center gap-1.5">
                                  <Landmark className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span className="truncate">{c.topBank || 'N/A'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="inline-flex items-center gap-1 text-[11px] font-mono">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold" title="Live Auctions">
                                    {c.liveCount} Live
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold" title="Upcoming Auctions">
                                    {c.upcomingCount} Soon
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Detailed breakdown sub-row when expanded */}
                            {isExpanded && (
                              <tr className="bg-amber-50/40 border-y border-amber-200/60">
                                <td colSpan={8} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                    <div className="bg-white p-3 rounded-xl border border-amber-200/70">
                                      <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Building className="w-3.5 h-3.5 text-amber-600" /> Participating Banks ({c.banks?.length || 0})
                                      </p>
                                      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                                        {(c.banks || []).map((b: any) => (
                                          <div key={b.name} className="flex justify-between items-center text-slate-600">
                                            <span className="truncate font-medium">{b.name}</span>
                                            <span className="font-mono font-bold text-amber-700 ml-2">{b.count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="bg-white p-3 rounded-xl border border-amber-200/70">
                                      <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-blue-600" /> Property Asset Sub-Types ({c.propertyTypes?.length || 0})
                                      </p>
                                      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                                        {(c.propertyTypes || []).map((pt: any) => (
                                          <div key={pt.name} className="flex justify-between items-center text-slate-600">
                                            <span className="truncate font-medium">{pt.name}</span>
                                            <span className="font-mono font-bold text-blue-700 ml-2">{pt.count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="bg-white p-3 rounded-xl border border-amber-200/70">
                                      <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-purple-600" /> Regional Footprint ({c.states?.length || 0} States)
                                      </p>
                                      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                                        {(c.states || []).map((st: any) => (
                                          <div key={st.name} className="flex justify-between items-center text-slate-600">
                                            <span className="truncate font-medium">{st.name}</span>
                                            <span className="font-mono font-bold text-purple-700 ml-2">{st.count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Bank-wise Distribution Analysis */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-amber-600" /> Bank Distribution & Market Share
                </h3>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl print:hidden">
                  <button
                    type="button"
                    onClick={() => setBaanknetChartType('bar')}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                      baanknetChartType === 'bar' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <BarChart3 className="w-4 h-4 text-amber-600" /> Volume
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaanknetChartType('pie')}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                      baanknetChartType === 'pie' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <PieIcon className="w-4 h-4 text-amber-600" /> Share
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 print:hidden">
                <span className="px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-xl border border-amber-200">
                  {baanknetStats?.bankDistribution?.length || 0} Financial Institutions
                </span>
                <button
                  type="button"
                  onClick={downloadBaanknetCSV}
                  className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-slate-200 shadow-2xs cursor-pointer"
                  title="Export Bank Distribution CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bank Chart View */}
            {baanknetChartType === 'bar' ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(baanknetStats?.bankDistribution || []).slice(0, 10)} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="bank" 
                      tick={{fontSize: 11, fill: '#64748b'}} 
                      interval={0} 
                      angle={-20} 
                      textAnchor="end" 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: '#fef3c7'}} />
                    <Bar dataKey="count" name="Auctions" fill="#d97706" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex flex-col md:flex-row items-center justify-center gap-8">
                {(!baanknetStats?.bankDistribution || baanknetStats.bankDistribution.length === 0) ? (
                  <p className="text-slate-500 text-sm font-semibold">No bank data available.</p>
                ) : (
                  <>
                    <div className="w-full md:w-1/2 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(baanknetStats?.bankDistribution || []).slice(0, 8).map(b => ({ name: b.bank, value: b.count }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={95}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {(baanknetStats?.bankDistribution || []).slice(0, 8).map((entry, index) => (
                              <Cell key={`cell-bank-${index}`} fill={BANK_COLORS[index % BANK_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar p-2">
                      {(baanknetStats?.bankDistribution || []).slice(0, 8).map((entry, index) => (
                        <div key={entry.bank} className="flex items-center gap-2 p-2 bg-amber-50/50 border border-amber-100 rounded-xl">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: BANK_COLORS[index % BANK_COLORS.length] }} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate" title={entry.bank}>{entry.bank}</p>
                            <p className="text-[10px] text-amber-700 font-bold mt-0.5">{entry.count} ({entry.percentage}%)</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Bank Distribution Table */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
                <span>Participating Banks Inventory Table</span>
                <span className="text-xs font-semibold text-slate-400 font-mono">
                  {baanknetStats?.bankDistribution?.length || 0} Banks Ranked
                </span>
              </h4>
              <div className="overflow-x-auto max-h-72 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold bg-slate-50/50">
                      <th className="py-2.5 px-3 font-bold">Bank Name</th>
                      <th className="py-2.5 px-3 font-bold">All Categories Handled</th>
                      <th className="py-2.5 px-3 font-bold">Primary Asset Type</th>
                      <th className="py-2.5 px-3 font-bold text-center">Share</th>
                      <th className="py-2.5 px-3 font-bold text-right">Est. Reserve Value</th>
                      <th className="py-2.5 px-3 font-bold text-right">Auctions Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                    {(baanknetStats?.bankDistribution || []).map((b, idx) => (
                      <tr key={`${b.bank}-${idx}`} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-2.5 px-3 flex items-center gap-2 font-bold text-slate-900">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: BANK_COLORS[idx % BANK_COLORS.length] }} />
                          <span className="truncate max-w-[160px]" title={b.bank}>{b.bank}</span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[240px]">
                          <div className="flex flex-wrap gap-1">
                            {(b.categories || []).slice(0, 2).map((cat: any) => (
                              <span key={cat.name} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                                {cat.name.replace('Real Estate | ', '').replace('Vehicles | ', '').replace('Industrial | ', '')} ({cat.count})
                              </span>
                            ))}
                            {(b.categories || []).length > 2 && (
                              <span className="text-[10px] text-slate-400 font-bold">
                                +{(b.categories || []).length - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 font-semibold truncate max-w-[130px]" title={b.topPropertyType}>
                          {b.topPropertyType}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-xs text-amber-700 font-bold">
                          {b.percentage}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-700 font-bold">
                          {b.totalReserve > 0 ? `₹${(b.totalReserve >= 10000000 ? (b.totalReserve / 10000000).toFixed(2) + ' Cr' : (b.totalReserve / 100000).toFixed(1) + ' L')}` : 'In Document'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                          {b.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Property Type & Valuation Tiers (2 Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Property Classification Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-600" /> Property & Asset Types
                </h3>
                <p className="text-xs text-slate-500 mb-4">Breakdown by asset classification (residential foreclosures, commercial spaces, vehicles, land).</p>

                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(baanknetStats?.propertyTypeDistribution || []).slice(0, 6)} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="type" tick={{fontSize: 10, fill: '#64748b'}} interval={0} angle={-15} textAnchor="end" tickLine={false} axisLine={false} />
                      <YAxis tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: '#fef3c7'}} />
                      <Bar dataKey="count" name="Auctions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                {(baanknetStats?.propertyTypeDistribution || []).slice(0, 4).map((p) => (
                  <div key={p.type} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 truncate">{p.type}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                      <span className="text-slate-400 font-semibold">{p.percentage}%</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">{p.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Valuation Brackets Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-600" /> Reserve Price Valuation Brackets
                </h3>
                <p className="text-xs text-slate-500 mb-4">Asset reserve price distribution across value tiers (from sub-₹10L to luxury/industrial ₹5Cr+).</p>

                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={baanknetStats?.priceBracketDistribution || []} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="tier" tick={{fontSize: 10, fill: '#64748b'}} interval={0} angle={-15} textAnchor="end" tickLine={false} axisLine={false} />
                      <YAxis tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: '#fef3c7'}} />
                      <Bar dataKey="count" name="Auctions" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                {(baanknetStats?.priceBracketDistribution || []).map((t) => (
                  <div key={t.tier} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[11px] font-bold text-slate-500 truncate">{t.tier}</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5 flex items-baseline justify-between">
                      <span>{t.count}</span>
                      <span className="text-[11px] font-semibold text-slate-400 font-mono">{t.percentage}%</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Geographic Distribution (State-wise) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-600" /> Geographic Footprint (State & Region Breakdown)
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">Distribution of bank foreclosure assets across Indian States and Union Territories.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-xl border border-amber-200">
                  {baanknetStats?.stateDistribution?.length || 0} States Identified
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* State Volume Bar Chart */}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(baanknetStats?.stateDistribution || []).slice(0, 10)} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="state" tick={{fontSize: 11, fill: '#64748b'}} interval={0} angle={-20} textAnchor="end" tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: '#fef3c7'}} />
                    <Bar dataKey="count" name="Auctions" fill="#d97706" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* State Breakdown Table */}
              <div className="overflow-x-auto max-h-72 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold bg-slate-50/50">
                      <th className="py-2.5 px-3 font-bold">State / Territory</th>
                      <th className="py-2.5 px-3 font-bold">Leading Bank</th>
                      <th className="py-2.5 px-3 font-bold text-center">Share</th>
                      <th className="py-2.5 px-3 font-bold text-right">Auctions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                    {(baanknetStats?.stateDistribution || []).map((s, idx) => (
                      <tr key={`${s.state}-${idx}`} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">{s.state}</span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 font-semibold truncate">
                          {s.topBank}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-xs text-amber-700 font-bold">
                          {s.percentage}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                          {s.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 4: Live / Upcoming Bank Auctions Catalog Inspector */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-amber-600" /> Bank Assets Catalog Inspector
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Browse and inspect recently ingested PSB Alliance bank property auction listings.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search bank or property..."
                    value={baanknetSearchQuery}
                    onChange={(e) => setBaanknetSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>

                <select
                  value={baanknetBankFilter}
                  onChange={(e) => setBaanknetBankFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-amber-500 transition-all cursor-pointer"
                >
                  <option value="all">All Banks</option>
                  {(baanknetStats?.bankDistribution || []).map(b => (
                    <option key={b.bank} value={b.bank}>{b.bank} ({b.count})</option>
                  ))}
                </select>

                <select
                  value={baanknetPropertyFilter}
                  onChange={(e) => setBaanknetPropertyFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-amber-500 transition-all cursor-pointer"
                >
                  <option value="all">All Categories & Classes</option>
                  {(baanknetStats?.categoryDistribution || []).map((cat: any) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name.includes('|') ? cat.name.split('|')[1].trim() : cat.name} ({cat.count})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={downloadBaanknetListingsCSV}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl flex items-center gap-2 transition-colors cursor-pointer select-none"
                >
                  <Download className="w-4 h-4 text-amber-600" /> CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-5 py-3 font-bold">Bank Name</th>
                    <th className="px-5 py-3 font-bold">Category & Domain</th>
                    <th className="px-5 py-3 font-bold">Property Title / Description</th>
                    <th className="px-5 py-3 font-bold">Property Class</th>
                    <th className="px-5 py-3 font-bold">State / Location</th>
                    <th className="px-5 py-3 font-bold text-right">Reserve Price</th>
                    <th className="px-5 py-3 font-bold text-center">Status</th>
                    <th className="px-5 py-3 font-bold text-right">Auction Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                  {(!baanknetStats?.sampleAuctions || baanknetStats.sampleAuctions.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400 font-semibold">
                        No BaankNet auctions found.
                      </td>
                    </tr>
                  ) : (
                    baanknetStats.sampleAuctions
                      .filter((a: any) => {
                        const q = baanknetSearchQuery.toLowerCase();
                        const matchesQuery = !q || (a.bank_name || '').toLowerCase().includes(q) || (a.title || '').toLowerCase().includes(q) || (a.state || '').toLowerCase().includes(q) || (a.property_type || '').toLowerCase().includes(q) || (a.category_name || '').toLowerCase().includes(q);
                        const matchesBank = baanknetBankFilter === 'all' || a.bank_name === baanknetBankFilter;
                        const matchesProperty = baanknetPropertyFilter === 'all' || a.category_name === baanknetPropertyFilter || a.property_type === baanknetPropertyFilter;
                        return matchesQuery && matchesBank && matchesProperty;
                      })
                      .slice(0, 25)
                      .map((a: any) => {
                        const isLive = a.auction_status === 'live';
                        return (
                          <tr key={a.id} className="hover:bg-amber-50/20 transition-colors">
                            <td className="px-5 py-3 font-bold text-slate-900 flex items-center gap-2">
                              <Landmark className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate max-w-[150px]" title={a.bank_name || 'Bank'}>
                                {a.bank_name || 'Public Sector Bank'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs font-semibold text-slate-700">
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold border border-amber-200 text-[10px]">
                                {a.category_name ? (a.category_name.includes('|') ? a.category_name.split('|')[1].trim() : a.category_name) : 'Bank Foreclosure'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs text-slate-700 max-w-[280px] truncate" title={a.title}>
                              {a.source_url ? (
                                <a 
                                  href={a.source_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-slate-800 hover:text-amber-600 hover:underline flex items-center gap-1"
                                >
                                  <span className="truncate">{a.title || 'Bank Auction Property'}</span>
                                  <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                                </a>
                              ) : (
                                a.title || 'Bank Auction Property'
                              )}
                            </td>
                            <td className="px-5 py-3 text-xs font-semibold text-slate-600">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
                                {a.property_type || 'Foreclosure'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs text-slate-600">
                              <span className="truncate">{a.city && a.city !== a.state ? `${a.city}, ` : ''}{a.state || 'India'}</span>
                            </td>
                            <td className="px-5 py-3 text-right font-mono font-bold text-slate-900 text-xs">
                              {a.reserve_price_value ? `₹${Number(a.reserve_price_value).toLocaleString('en-IN')}` : (a.reserve_price_text || 'See Document')}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={clsx(
                                "px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-1",
                                isLive ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                              )}>
                                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                                {a.auction_status || 'Upcoming'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right text-xs font-mono text-slate-500">
                              {a.auction_start_date ? new Date(a.auction_start_date).toLocaleDateString() : 'TBD'}
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
      )}

        </div>
      )}
    </div>
  );
}
