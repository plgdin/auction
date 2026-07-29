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
  Navigation
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { adminService } from '../../services/adminService';
import { supabase } from '../../lib/supabase';
import clsx from 'clsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

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
          <p className="text-[10px] text-slate-450 mt-2 font-semibold pt-1.5 border-t border-slate-100">
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
  const [activeTab, setActiveTab] = useState<'overview' | 'location'>('overview');

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
    async function loadLocationData() {
      setIsLoadingLocations(true);
      try {
        const locData = await adminService.getLocationAnalytics();
        setLocationStats(locData);
      } catch (err) {
        console.error('Failed loading location analytics', err);
      } finally {
        setIsLoadingLocations(false);
      }
    }

    async function loadCategoryData() {
      setIsLoadingCategories(true);
      try {
        const catData = await adminService.getCategoryAnalytics();
        setCategoryStats(groupStatsByParent(catData));
      } catch (err) {
        console.error('Failed loading categories', err);
      } finally {
        setIsLoadingCategories(false);
      }
    }

    async function loadReportMetrics() {
      let growth: { month: string; buyers: number; sellers: number }[] = [];

      try {
        // Fetch user growth from profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('created_at, role');

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const growthMap: Record<string, { buyers: number, sellers: number }> = {};

        if (profiles && profiles.length > 0) {
          profiles.forEach(p => {
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
        growth = last6Months;
      } catch (err) {
        console.error('Error fetching dashboard growth data', err);
      }

      setLiveReportData({ growth });
    }

    async function loadFinancialData() {
      setIsLoadingFinancial(true);
      try {
        const globalData = await adminService.getGlobalAnalytics();
        const finData = await adminService.getFinancialAnalytics();

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
      } catch (err) {
        console.error('Failed loading financial analytics', err);
      } finally {
        setIsLoadingFinancial(false);
      }
    }

    loadLocationData();
    loadCategoryData();
    loadReportMetrics();
    loadFinancialData();
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
    const totalItems = displayTotals.reduce((sum, c) => sum + c.count, 0);
    const lines: string[] = [
      'Category,Item Count,Share of Total,Avg Pre-Bid EMD (₹),Avg EMD (%)'
    ];

    displayTotals.forEach(cat => {
      const catPct = totalItems > 0 ? ((cat.count / totalItems) * 100).toFixed(2) : '0.00';
      const avgPreBid = categoryAverages[cat.name]?.avgPreBid || 0;
      const rawEmdPct = categoryAverages[cat.name]?.avgEmdPct || 0;

      lines.push([
        csvCell(cat.name), 
        cat.count, 
        `${catPct}%`,
        Math.round(avgPreBid),
        rawEmdPct > 100 ? '100.00%' : `${rawEmdPct.toFixed(2)}%`
      ].join(','));
    });

    const filterLabel = dateFilter === 'all' ? totalsTab : dateFilter;
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

  const handleExportCSV = () => {
    const filterLabel = dateFilter === 'all' ? totalsTab : dateFilter;
    const lines: string[] = [];

    // ── Section 1: Platform Summary Metrics ──
    lines.push('PLATFORM SUMMARY METRICS');
    lines.push('Metric,Value');
    lines.push(`Total Registered Users,${financialData.summary.totalUsers || 0}`);
    lines.push(`Active Auction Listings,${financialData.summary.activeListings || 0}`);
    lines.push(`Pre-Bid EMD Currently Held (₹),${Math.round(financialData.summary.emdHeld || 0)}`);
    lines.push(`Total Pre-Bid EMD Volume (₹),${Math.round(financialData.summary.emdVolume || 0)}`);
    lines.push('');
    lines.push('');

    // ── Section 2: Category Inventory Breakdown ──
    const totalItems = displayTotals.reduce((sum, c) => sum + c.count, 0);

    lines.push('CATEGORY INVENTORY BREAKDOWN');
    lines.push('Category Name,Item Count,Share of Total,Avg Pre-Bid EMD (₹),Avg EMD (%)');

    displayTotals.forEach(cat => {
      const catPct = totalItems > 0 ? ((cat.count / totalItems) * 100).toFixed(2) : '0.00';
      const avgPreBid = categoryAverages[cat.name]?.avgPreBid || 0;
      const rawEmdPct = categoryAverages[cat.name]?.avgEmdPct || 0;

      lines.push([
        csvCell(cat.name), 
        cat.count, 
        `${catPct}%`,
        Math.round(avgPreBid),
        rawEmdPct > 100 ? '100.00%' : `${rawEmdPct.toFixed(2)}%`
      ].join(','));
    });
    lines.push([csvCell('TOTAL CATEGORIES SUMMARY'), totalItems, '100.00%', '', ''].join(','));
    lines.push('');
    lines.push('');

    // ── Section 3: Location & Region Breakdown ──
    lines.push('LOCATION & REGION BREAKDOWN');
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
        {(['overview', 'location'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer capitalize whitespace-nowrap flex items-center gap-2",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            {tab === 'location' && <MapPin className="w-4 h-4" />}
            {tab === 'location' ? 'Location Analytics' : 'Overview'}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoadingCategories || isLoadingFinancial ? (
        <div className="flex justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {activeTab === 'overview' && (
            <>
              {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 print:grid-cols-3">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Users</h3>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{(financialData.summary.totalUsers || 0).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Gavel className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Listings</h3>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{(financialData.summary.activeListings || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pre-Bid EMD Held</h3>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">₹{(financialData.summary.emdHeld || 0).toLocaleString()}</p>
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
                          dateFilter === '7d' ? "bg-primary/5 text-primary" : "text-slate-650 hover:bg-slate-50"
                        )}
                      >
                        Last 7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDateFilter('30d'); setDateDropdownOpen(false); }}
                        className={clsx(
                          "w-full text-left px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                          dateFilter === '30d' ? "bg-primary/5 text-primary" : "text-slate-650 hover:bg-slate-50"
                        )}
                      >
                        Last 30 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDateFilter('all'); setDateDropdownOpen(false); }}
                        className={clsx(
                          "w-full text-left px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                          dateFilter === 'all' ? "bg-primary/5 text-primary" : "text-slate-650 hover:bg-slate-50"
                        )}
                      >
                        All-Time History
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDateFilter('custom'); setDateDropdownOpen(false); }}
                        className={clsx(
                          "w-full text-left px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                          dateFilter === 'custom' ? "bg-primary/5 text-primary" : "text-slate-650 hover:bg-slate-50"
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
                      <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-150 px-2">
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
                              <p className="text-[10px] text-slate-550 font-bold mt-0.5">{entry.value} ({pct}%)</p>
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
                              <p className="text-[10px] text-slate-550 font-bold mt-0.5">{entry.count} ({pct}%)</p>
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
                      <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-650">
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
                    {totalItems.toLocaleString()} Total Items
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
                {filteredDisplayTotals.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">No categories found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold">
                          <th className="pb-2.5 font-bold">Category</th>
                          <th className="pb-2.5 font-bold text-right">Avg Pre-Bid</th>
                          <th className="pb-2.5 font-bold text-right">Avg EMD</th>
                          <th className="pb-2.5 font-bold text-right">Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-650">
                        {filteredDisplayTotals.map((cat) => (
                          <tr key={cat.name} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 flex items-center gap-1.5 min-w-0">
                              <div 
                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                style={{ backgroundColor: getCategoryColor(cat.name) }}
                              />
                              <span className="truncate font-semibold text-slate-700 max-w-[350px] sm:max-w-[450px]" title={cat.name}>
                                {cat.name}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-mono text-xs text-slate-500">
                              ₹{(categoryAverages[cat.name]?.avgPreBid || 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 text-right font-mono text-xs text-slate-500">
                              {(categoryAverages[cat.name]?.avgEmdPct || 0)}%
                            </td>
                            <td className="py-2.5 text-right font-bold text-slate-900">
                              {cat.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                      <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-650">
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

        </div>
      )}
    </div>
  );
}
