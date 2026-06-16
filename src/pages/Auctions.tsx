// @ts-nocheck
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight, Eye, Download, X, Copy, Check, MapPin, Tag, CornerDownLeft, FileText } from 'lucide-react';
import { AuctionCard } from '../components/auction/AuctionCard';
import { MstcCard } from '../components/auction/MstcCard';
import { AuctionFilters } from '../components/auction/AuctionFilters';
import { auctionService } from '../services/auctionService';
import type { AuctionFilterParams } from '../services/auctionService';
import { useAuthStore } from '../store/authStore';
import type { Auction } from '../types/database.types';
import { MstcSearchService } from '../services/publicService';
import type { MstcSanitizedAuction, SearchSuggestion } from '../services/publicService';
import clsx from 'clsx';
import { valuationService } from '../services/valuationService';
import type { ValuationCosts, ValuationOutput } from '../services/valuationService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { getEstimatedMarketPrice } from '../utils/valuationUtils';


interface CatalogSummary {
  overview: string;
  scopeOfWork: string;
  items: {
    sr: number | string;
    description: string;
    qty: string;
    unit: string;
    taxRate: string;
    marketPrice: string;
    attachments?: string[];
    images?: string[];
  }[];
  eligibility: string[];
  depositDetails: {
    emd: string;
    preBidDdg: string;
    adminCharges: string;
  };
  keyContacts: { role: string; name: string; email: string; phone?: string }[];
  preview_image_url?: string | null;
  extracted_images?: string[];
  inspectionDetails?: {
    time: string;
    contact: string;
  };
  totalMarketValue?: number;
}

const getTaxPercent = (taxRateStr: string): number => {
  if (!taxRateStr) return 0;
  const matches = taxRateStr.match(/([\d\.]+)\s*%/g);
  if (matches && matches.length > 0) {
    let totalPercent = 0;
    for (const m of matches) {
      const num = parseFloat(m);
      if (!isNaN(num)) {
        totalPercent += num;
      }
    }
    return totalPercent;
  }
  if (taxRateStr.toLowerCase().includes('gst')) {
    return 18;
  }
  return 0;
};

const generateCatalogSummary = (item: MstcSanitizedAuction): CatalogSummary => {
  if (item.raw_materials_text) {
    try {
      const parsed = JSON.parse(item.raw_materials_text);
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.items &&
        parsed.eligibility &&
        parsed.depositDetails &&
        parsed.keyContacts
      ) {
        // EMD extraction/cleaning logic
        let emdVal = parsed.depositDetails.emd || '';
        let preBidDdg = parsed.depositDetails.preBidDdg || 'Not required for registered MSME bidders';

        if (emdVal.includes('%')) {
          const percentMatch = emdVal.match(/([\d\.]+)\s*%/);
          if (percentMatch) {
            const percentVal = parseFloat(percentMatch[1]);
            if (percentVal > 100) {
              // Parse error / invalid percent, reset
              emdVal = '10% of total bid value';
              preBidDdg = 'Not required for registered MSME bidders';
            }
          }
        } else {
          const numMatch = emdVal.match(/([\d\.]+)/);
          if (numMatch) {
            const val = parseFloat(numMatch[1]);
            if (val > 100) {
              // Value is a large number (e.g. 7600000), make it pre-bid value
              preBidDdg = `₹${val.toLocaleString('en-IN')}`;
              emdVal = '10% of total bid value';
            }
          }
        }

        parsed.depositDetails.emd = emdVal;
        parsed.depositDetails.preBidDdg = preBidDdg;

        // Clean items list: if lot.description is purely numeric, replace with category_name
        if (parsed.items && Array.isArray(parsed.items)) {
          parsed.items = parsed.items.map(lot => {
            let desc = lot.description || '';
            if (desc && /^\d+$/.test(desc.trim())) {
              desc = item.category_name || 'Auction Lot Items';
            }

            let tax = lot.taxRate || '';
            if (tax) {
              if (tax.includes('%')) {
                const taxMatch = tax.match(/([\d\.]+)\s*%/);
                if (taxMatch && parseFloat(taxMatch[1]) > 100) {
                  tax = 'As Applicable GST';
                }
              }
            }

            return {
              ...lot,
              description: desc,
              taxRate: tax,
              marketPrice: lot.marketPrice || getEstimatedMarketPrice(desc, item.category_name)
            };
          });
        }

        // Fallback for inspection details if not in JSON
        if (!parsed.inspectionDetails) {
          const mainContact = parsed.keyContacts.find((c: any) => c.role.toLowerCase().includes('site') || c.role.toLowerCase().includes('engineer')) || parsed.keyContacts[0];
          parsed.inspectionDetails = {
            time: 'From publication date to 1 day prior to bidding (10:00 AM - 4:00 PM on working days)',
            contact: mainContact ? `${mainContact.name} (${mainContact.phone || 'phone listed in catalog'})` : 'Site In-Charge'
          };
        }

        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse raw_materials_text as JSON, falling back to mock generator:', e);
    }
  }

  const cat = (item.category_name || '').toUpperCase();
  const seller = (item.seller_name || '').toUpperCase();

  let overview = `This auction is conducted by MSTC on behalf of ${item.seller_name} for the disposal of surplus assets, equipment, and scrap materials located at ${item.location || 'various sites'}.`;
  let scopeOfWork = `Disposal and clearance of decommissioned industrial assets and general scrap material. All materials are offered strictly on an "As-Is-Where-Is" basis.`;

  let items = [
    { sr: 1, description: 'Mixed Ferrous Scrap (MS Pipes, Angle, Channels)', qty: '12.5', unit: 'MT', taxRate: '18% GST' },
    { sr: 2, description: 'Non-Ferrous Scrap (Aluminum cables & Copper windings)', qty: '1,850', unit: 'Kgs', taxRate: '18% GST' },
    { sr: 3, description: 'Unserviceable Batteries & Used Lubricating Oil', qty: '45', unit: 'Nos', taxRate: '18% GST + TCS' },
    { sr: 4, description: 'Obsolete Machinery Parts & Hand Tools', qty: '1', unit: 'Lot', taxRate: '18% GST' }
  ];

  let eligibility = [
    'Valid MSTC Buyer Registration.',
    'GSTIN Registration Certificate matching buyer profile.',
    'Hazardous waste buyers must possess active State Pollution Control Board (SPCB) authorization.'
  ];

  let keyContacts = [
    { role: 'Auction Officer (MSTC)', name: 'S. K. Mukherjee', email: 'skmukherjee@mstcindia.co.in', phone: '07969066600' },
    { role: 'Site In-Charge', name: 'R. K. Sharma (Superintending Engineer)', email: 'rksharma@site-authority.org', phone: 'no contact info available' }
  ];

  let emd = '10% of total bid value to be submitted via pre-bid EMD link';
  let adminCharges = '₹11,800 (incl. GST) non-refundable service provider fees';

  // Customize based on Category/Seller
  if (cat.includes('ROADWAYS') || cat.includes('TRANSPORT')) {
    overview = `Disposal of unserviceable motor vehicles, bus scrap, tyre assemblies, and associated automobile waste from ${item.seller_name} depots.`;
    scopeOfWork = `Complete dismantling, lifting, and clearing of designated scrap transport assets from the depot premises within the specified deadline.`;
    items = [
      { sr: 1, description: 'Scrap Condemned Buses (without tyres & batteries)', qty: '8', unit: 'Units', taxRate: '18% GST' },
      { sr: 2, description: 'Used Automobile Tyres (Various sizes, worn out)', qty: '120', unit: 'Nos', taxRate: '18% GST' },
      { sr: 3, description: 'Lead Acid Batteries (Unserviceable)', qty: '35', unit: 'Nos', taxRate: '18% GST' },
      { sr: 4, description: 'Waste Gear & Lubricating Oil (in drums)', qty: '1,200', unit: 'Liters', taxRate: '18% GST + 1% TCS' }
    ];
    eligibility.push('Automobile recycler license / lead smelter certificate required for Lot 3.');
  } else if (cat.includes('TELECOM') || cat.includes('BSNL') || cat.includes('COMMUNICATION')) {
    overview = `Sale of telecom infrastructure scrap, office equipment, batteries, and underground cables decommissioned by ${item.seller_name}.`;
    scopeOfWork = `Safe extraction, lifting, and environment-compliant transport of copper/telecom scrap from exchange storage locations.`;
    items = [
      { sr: 1, description: 'Decommissioned Copper Cables (Pipes/Wires)', qty: '4.2', unit: 'MT', taxRate: '18% GST' },
      { sr: 2, description: 'SMPS Power Plant Panels & Rack Units', qty: '12', unit: 'Lots', taxRate: '18% GST' },
      { sr: 3, description: 'Unserviceable Valve Regulated Lead Acid (VRLA) Battery Banks', qty: '18', unit: 'Sets', taxRate: '18% GST' },
      { sr: 4, description: 'E-Waste (Telecom switches, cards, & motherboards)', qty: '650', unit: 'Kgs', taxRate: '18% GST' }
    ];
    eligibility.push('CPCB/SPCB E-Waste registration required for Lot 3 and Lot 4.');
  } else if (seller.includes('INVESTIGATION') || seller.includes('POLICE') || seller.includes('COURT')) {
    overview = `Auction of seized, confiscated, or unclaimed vehicles and miscellaneous goods under the authority of ${item.seller_name}.`;
    scopeOfWork = `Lifting of vehicles/goods in "as-is" condition. Registration documents or salvage papers will be issued as per court/department rules.`;
    items = [
      { sr: 1, description: 'Confiscated Light Motor Vehicles (SUVs, Sedans)', qty: '4', unit: 'Units', taxRate: '12% GST' },
      { sr: 2, description: 'Two-Wheelers (Motorcycles, Scooters)', qty: '15', unit: 'Units', taxRate: '12% GST' },
      { sr: 3, description: 'Unclaimed Miscellaneous Electronic Items', qty: '1', unit: 'Lot', taxRate: '18% GST' }
    ];
    eligibility = [
      'Valid Indian citizenship proof (Aadhaar/PAN).',
      'No pending criminal record declarations.',
      'Active MSTC registration.'
    ];
  } else if (cat.includes('MECHANICAL') || cat.includes('DRILLING') || cat.includes('ENGINEERING')) {
    overview = `Disposal of unserviceable drilling rigs, heavy plant machinery, compressor units, and metal boring scrap of ${item.seller_name}.`;
    scopeOfWork = `Heavy loading, mechanical dismantling, and clearance of rig attachments and scrap iron components from the engineering depot yard.`;
    items = [
      { sr: 1, description: 'Condemned Compressor Units & Air Dryers', qty: '3', unit: 'Units', taxRate: '18% GST' },
      { sr: 2, description: 'Heavy Duty Drilling Rig Parts (Unserviceable)', qty: '9.8', unit: 'MT', taxRate: '18% GST' },
      { sr: 3, description: 'Used Lubricants & Engine Oil (drums included)', qty: '800', unit: 'Liters', taxRate: '18% GST' },
      { sr: 4, description: 'Turnings, Borings & Miscellaneous Iron Scrap', qty: '14', unit: 'MT', taxRate: '18% GST' }
    ];
    eligibility.push('Heavy crane entry permit must be cleared with site security 24 hours prior to lifting.');
  }

  const enrichedItems = items.map(lot => ({
    ...lot,
    marketPrice: getEstimatedMarketPrice(lot.description, item.category_name)
  }));

  return {
    overview,
    scopeOfWork,
    items: enrichedItems,
    eligibility,
    depositDetails: {
      emd,
      preBidDdg: 'Not required for registered MSME bidders',
      adminCharges
    },
    keyContacts,
    inspectionDetails: {
      time: 'From publication date until 1 day prior to bidding (10:00 AM - 4:00 PM on working days)',
      contact: 'R. K. Sharma (Superintending Engineer) - 07969066600'
    }
  };
};
const renderSuggestionText = (text: string, query: string) => {
  if (!query) return <span>{text}</span>;
  const cleanQuery = query.trim().toLowerCase();
  const index = text.toLowerCase().indexOf(cleanQuery);
  if (index === -1) return <span>{text}</span>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + cleanQuery.length);
  const after = text.slice(index + cleanQuery.length);

  return (
    <span>
      {before}
      <span className="font-normal text-slate-400">{match}</span>
      <span className="font-bold text-slate-800">{after}</span>
    </span>
  );
};

export function Auctions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();

  const activeTab = searchParams.get('tab') === 'commercial' ? 'commercial' : 'mstc';

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [mstcAuctions, setMstcAuctions] = useState<MstcSanitizedAuction[]>([]);
  const [isMstcLoading, setIsMstcLoading] = useState(false);
  const [mstcOptions, setMstcOptions] = useState<{
    categories: string[];
    subcategories: Record<string, string[]>;
    sellers: string[];
    locations: string[];
  }>({
    categories: [],
    subcategories: {},
    sellers: [],
    locations: []
  });

  const [selectedPreviewItem, setSelectedPreviewItem] = useState<MstcSanitizedAuction | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'summary' | 'pdf'>('summary');

  // Valuation states
  const [modalTab, setModalTab] = useState<'catalog' | 'valuation'>('catalog');
  const [customCosts, setCustomCosts] = useState<ValuationCosts>({
    currentBid: 0,
    transportation: 5000,
    loadingUnloading: 2000,
    refurbishment: 0,
    otherFees: 1000,
  });
  const [valuationData, setValuationData] = useState<ValuationOutput | null>(null);
  const [isValuating, setIsValuating] = useState(false);
  const [selectedChartItemId, setSelectedChartItemId] = useState<string>('total');

  const getChartData = () => {
    if (!valuationData) return [];
    
    let currentVal = valuationData.totalLotValue;
    if (selectedChartItemId !== 'total') {
      const idx = parseInt(selectedChartItemId, 10);
      const it = valuationData.items[idx];
      if (it) {
        currentVal = it.totalValue;
      }
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const multipliers = [0.91, 0.94, 0.92, 0.96, 0.98, 1.0];
    
    return months.map((m, i) => ({
      name: m,
      value: Math.round(currentVal * multipliers[i])
    }));
  };

  useEffect(() => {
    if (selectedPreviewItem) {
      const summary = generateCatalogSummary(selectedPreviewItem);
      
      let defaultBid = summary.totalMarketValue || 0;
      if (defaultBid <= 0) {
        const rawPreBid = summary.depositDetails?.preBidDdg || '';
        const preBidVal = rawPreBid.replace(/[^\d]/g, '');
        const parsedVal = parseInt(preBidVal, 10);
        defaultBid = isNaN(parsedVal) || parsedVal <= 0 ? 50000 : parsedVal;
      }

      setCustomCosts({
        currentBid: defaultBid,
        transportation: 5000,
        loadingUnloading: 2000,
        refurbishment: 0,
        otherFees: 1000,
      });
      setModalTab('catalog');
      setSelectedChartItemId('total');
    } else {
      setValuationData(null);
    }
  }, [selectedPreviewItem]);

  useEffect(() => {
    if (!selectedPreviewItem) return;
    let isMounted = true;
    const runValuation = async () => {
      setIsValuating(true);
      try {
        const summary = generateCatalogSummary(selectedPreviewItem);
        const hasImages = !!(summary.extracted_images && summary.extracted_images.length > 0);
        const rawItems = (summary.items || []).map((it: any) => ({
          sr: it.sr,
          description: it.description || '',
          qty: String(it.qty || '1'),
          unit: it.unit || 'Nos',
          marketPrice: it.marketPrice || '',
        }));
        const result = await valuationService.calculateValuation(rawItems, customCosts, hasImages);
        if (isMounted) {
          setValuationData(result);
        }
      } catch (err) {
        console.error('Valuation engine calculation failed:', err);
      } finally {
        if (isMounted) {
          setIsValuating(false);
        }
      }
    };
    runValuation();
    return () => {
      isMounted = false;
    };
  }, [selectedPreviewItem, customCosts]);

  const selectedMstcCategories = searchParams.getAll('mstc_category');
  const selectedMstcSubcategories = searchParams.getAll('mstc_subcategory');
  const selectedMstcLocations = searchParams.getAll('mstc_location');
  const selectedMstcSellers = searchParams.getAll('mstc_seller');
  const selectedMstcRegionalOffices = searchParams.getAll('mstc_regional_office');

  const [isGridView, setIsGridView] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Sync searchQuery local input state with query params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const handleKeyDownEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    if (lightboxImage) {
      window.addEventListener('keydown', handleKeyDownEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDownEsc);
    };
  }, [lightboxImage]);

  // Autocomplete search suggestions states & refs
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDeletingRef = useRef(false);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch suggestions as-you-type (debounced)
  useEffect(() => {
    if (activeTab !== 'mstc') {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const list = await MstcSearchService.getMstcSearchSuggestions(searchQuery);
      setSuggestions(list);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const selectSuggestion = (suggestion: SearchSuggestion) => {
    let queryText = suggestion.text;
    if (suggestion.type === 'location' && queryText.startsWith('Auctions in ')) {
      queryText = queryText.replace('Auctions in ', '');
    }
    setSearchQuery(queryText);
    setShowSuggestions(false);
    setHighlightedIndex(-1);

    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('q', queryText);
      next.set('page', '1');
      return next;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      isDeletingRef.current = true;
    } else {
      isDeletingRef.current = false;
    }

    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        selectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Derived filter and paging variables from URL query parameters
  const categoryIds = searchParams.getAll('category');
  const listingType = (searchParams.get('listingType') as AuctionFilterParams['listingType']) || undefined;
  const regionalOffice = searchParams.get('regionalOffice') || undefined;
  const location = searchParams.get('location') || undefined;
  const preBid = searchParams.get('preBid') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const sortBy = (searchParams.get('sortBy') as AuctionFilterParams['sortBy']) || 'newest';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 12;

  const filters: AuctionFilterParams = {
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    listingType,
    regionalOffice,
    location,
    preBid,
    startDate,
    endDate,
  };

  const isAnyFilterActive = !!(
    (filters.categoryIds && filters.categoryIds.length > 0) ||
    filters.listingType ||
    filters.regionalOffice ||
    filters.location ||
    filters.preBid ||
    filters.startDate ||
    filters.endDate ||
    searchParams.get('q')
  );

  const loadData = useCallback(async () => {
    if (!isAnyFilterActive) {
      setAuctions([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [{ data, count }, wIds] = await Promise.all([
        auctionService.getAuctions({
          ...filters,
          searchQuery: searchParams.get('q') || undefined,
          sortBy,
          page,
          limit
        }),
        isAuthenticated && user ? auctionService.getUserWatchlistIds(user.id) : Promise.resolve([])
      ]);

      setAuctions(data);
      setTotalCount(count);
      setWatchlistIds(wIds);
    } catch (error) {
      console.error('Error loading auctions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchParams,
    categoryIds.join(','),
    listingType,
    regionalOffice,
    location,
    preBid,
    startDate,
    endDate,
    sortBy,
    page,
    limit,
    isAuthenticated,
    user,
    isAnyFilterActive
  ]);

  const loadMstcData = useCallback(async () => {
    setIsMstcLoading(true);
    try {
      const qParam = searchParams.get('q') || '';
      const data = await MstcSearchService.searchMarketplaceCatalog(qParam, {
        category: selectedMstcCategory || undefined,
        subcategory: selectedMstcSubcategory || undefined,
        location: selectedMstcLocation || undefined,
        seller: selectedMstcSeller || undefined
      });

      let filteredData = data;
      if (startDate) {
        const start = new Date(startDate);
        filteredData = filteredData.filter(item => {
          if (!item.opening_date) return false;
          const openDate = new Date(item.opening_date);
          return openDate >= start;
        });
      }
      if (endDate) {
        const end = new Date(endDate);
        filteredData = filteredData.filter(item => {
          if (!item.opening_date) return false;
          const openDate = new Date(item.opening_date);
          return openDate <= end;
        });
      }
      setMstcAuctions(filteredData);
    } catch (error) {
      console.error('Error loading MSTC catalogs:', error);
    } finally {
      setIsMstcLoading(false);
    }
  }, [searchParams, selectedMstcCategory, selectedMstcSubcategory, selectedMstcLocation, selectedMstcSeller, startDate, endDate]);

  const loadMstcOptions = useCallback(async () => {
    try {
      const options = await MstcSearchService.getMstcFilterOptions();
      setMstcOptions(options);
    } catch (error) {
      console.error('Error loading MSTC filter options:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'commercial') {
      loadData();
    } else {
      loadMstcData();
    }
  }, [activeTab, loadData, loadMstcData]);

  useEffect(() => {
    // Load options when tab is active OR initially on mount
    loadMstcOptions();
  }, [loadMstcOptions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (searchQuery) {
        next.set('q', searchQuery);
      } else {
        next.delete('q');
      }
      next.set('page', '1');
      return next;
    });
  };

  const handleMstcFilterChange = (newFilters: any) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);

      // Update Category
      if ('categoryIds' in newFilters) {
        if (newFilters.categoryIds && newFilters.categoryIds.length > 0) {
          next.set('mstc_category', newFilters.categoryIds[0]);
        } else {
          next.delete('mstc_category');
        }
      }

      // Update Subcategory
      if ('subcategory' in newFilters) {
        if (newFilters.subcategory) {
          next.set('mstc_subcategory', newFilters.subcategory);
        } else {
          next.delete('mstc_subcategory');
        }
      }

      // Update Location
      if ('location' in newFilters) {
        if (newFilters.location) {
          next.set('mstc_location', newFilters.location);
        } else {
          next.delete('mstc_location');
        }
      }

      // Update Seller (mapped to regionalOffice)
      if ('regionalOffice' in newFilters) {
        if (newFilters.regionalOffice) {
          next.set('mstc_seller', newFilters.regionalOffice);
        } else {
          next.delete('mstc_seller');
        }
      }

      // Update startDate
      if ('startDate' in newFilters) {
        if (newFilters.startDate) {
          next.set('startDate', newFilters.startDate);
        } else {
          next.delete('startDate');
        }
      }

      // Update endDate
      if ('endDate' in newFilters) {
        if (newFilters.endDate) {
          next.set('endDate', newFilters.endDate);
        } else {
          next.delete('endDate');
        }
      }

      next.set('page', '1');
      return next;
    });
  };

  const handleFilterChange = (newFilters: Partial<AuctionFilterParams>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);

      // Update categories
      if ('categoryIds' in newFilters) {
        next.delete('category');
        if (newFilters.categoryIds && newFilters.categoryIds.length > 0) {
          newFilters.categoryIds.forEach(id => next.append('category', id));
        }
      }

      // Update listingType
      if ('listingType' in newFilters) {
        if (newFilters.listingType && newFilters.listingType !== 'all') {
          next.set('listingType', newFilters.listingType);
        } else {
          next.delete('listingType');
        }
      }

      // Update regionalOffice
      if ('regionalOffice' in newFilters) {
        if (newFilters.regionalOffice) {
          next.set('regionalOffice', newFilters.regionalOffice);
        } else {
          next.delete('regionalOffice');
        }
      }

      // Update location
      if ('location' in newFilters) {
        if (newFilters.location) {
          next.set('location', newFilters.location);
        } else {
          next.delete('location');
        }
      }

      // Update preBid
      if ('preBid' in newFilters) {
        if (newFilters.preBid) {
          next.set('preBid', newFilters.preBid);
        } else {
          next.delete('preBid');
        }
      }

      // Update startDate
      if ('startDate' in newFilters) {
        if (newFilters.startDate) {
          next.set('startDate', newFilters.startDate);
        } else {
          next.delete('startDate');
        }
      }

      // Update endDate
      if ('endDate' in newFilters) {
        if (newFilters.endDate) {
          next.set('endDate', newFilters.endDate);
        } else {
          next.delete('endDate');
        }
      }

      next.set('page', '1');
      return next;
    });
  };

  const handleSortChange = (newSortBy: AuctionFilterParams['sortBy']) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('sortBy', newSortBy);
      next.set('page', '1');
      return next;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', newPage.toString());
      return next;
    });
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="relative bg-slate-900 py-12">
        {/* Background decoration */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-slate-900 mix-blend-multiply" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/20 to-transparent" />
        </div>

        <div className="relative z-30 container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-2">Auctions Marketplace</h1>
          <p className="text-slate-400 mb-6">Browse live commercial auctions and official government catalogs.</p>

          <div className="flex space-x-6 mb-6 border-b border-slate-800 pb-2">
            <button
              onClick={() => {
                setSearchParams({ tab: 'mstc' });
              }}
              className={clsx(
                "pb-2 text-lg font-semibold border-b-2 transition-colors focus:outline-none cursor-pointer",
                activeTab === 'mstc'
                  ? "border-primary text-white font-bold"
                  : "border-transparent text-slate-300 hover:text-white"
              )}
            >
              MSTC Government Catalogs
            </button>
            <button
              onClick={() => {
                setSearchParams({ tab: 'commercial' });
              }}
              className={clsx(
                "pb-2 text-lg font-semibold border-b-2 transition-colors focus:outline-none cursor-pointer",
                activeTab === 'commercial'
                  ? "border-primary text-white font-bold"
                  : "border-transparent text-slate-300 hover:text-white"
              )}
            >
              Commercial Auctions
            </button>
          </div>

          <form onSubmit={handleSearch} className="max-w-3xl relative" onKeyDown={handleKeyDown}>
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              ref={inputRef}
              type="text"
              className="block w-full pl-11 pr-24 py-4 border-0 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary sm:text-lg shadow-lg text-slate-900"
              placeholder={activeTab === 'commercial' ? "Search by title, reference number, or keywords..." : "Search MSTC catalog numbers, categories, or sellers..."}
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => setShowSuggestions(true)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 bottom-2 px-6 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Search
            </button>

            {/* Gemini-style real-time autocomplete suggestions dropdown */}
            {activeTab === 'mstc' && showSuggestions && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 py-2 text-slate-700 max-h-[380px] overflow-y-auto"
              >
                <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-left">
                  Suggested Searches
                </div>
                {suggestions.map((suggestion, index) => {
                  const isHighlighted = highlightedIndex === index;
                  return (
                    <div
                      key={index}
                      onClick={() => selectSuggestion(suggestion)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={clsx(
                        "px-4 py-3 flex items-center justify-between cursor-pointer transition-colors border-l-4",
                        isHighlighted
                          ? "bg-slate-50 border-primary-500 text-slate-900 font-medium"
                          : "border-transparent hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        {suggestion.type === 'location' && (
                          <MapPin className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                        )}
                        {suggestion.type === 'category' && (
                          <Tag className="h-4.5 w-4.5 text-primary-500 shrink-0" />
                        )}
                        {suggestion.type === 'subcategory' && (
                          <Tag className="h-4.5 w-4.5 text-teal-500 shrink-0" />
                        )}
                        {suggestion.type === 'auction' && (
                          <FileText className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                        )}
                        {suggestion.type === 'query' && (
                          <Search className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                        )}
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-medium">{renderSuggestionText(suggestion.text, searchQuery)}</span>
                          {suggestion.subtext && (
                            <span className="text-xs text-slate-400">{suggestion.subtext}</span>
                          )}
                        </div>
                      </div>
                      {isHighlighted && (
                        <CornerDownLeft className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Mobile Filter Toggle */}
          <div className="lg:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 w-full mb-4">
            <button
              onClick={() => setIsFiltersOpen(true)}
              className="flex items-center text-slate-700 font-medium cursor-pointer"
            >
              <SlidersHorizontal className="w-5 h-5 mr-2" />
              Filters
            </button>
            <div className="text-sm text-slate-500 font-medium">
              {activeTab === 'commercial'
                ? (!isAnyFilterActive ? '0 results' : `${totalCount} results`)
                : `${mstcAuctions.length} results`
              }
            </div>
          </div>

          {/* Sidebar Filters */}
          <div className="lg:w-1/4 shrink-0 lg:sticky lg:top-[96px] lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar z-20">
            <AuctionFilters
              isOpen={isFiltersOpen}
              onClose={() => setIsFiltersOpen(false)}
              onFilterChange={activeTab === 'commercial' ? handleFilterChange : handleMstcFilterChange}
              initialFilters={activeTab === 'commercial' ? filters : {
                categoryIds: selectedMstcCategory ? [selectedMstcCategory] : [],
                subcategory: selectedMstcSubcategory,
                location: selectedMstcLocation,
                regionalOffice: selectedMstcSeller,
                startDate,
                endDate
              }}
              activeTab={activeTab}
              customCategories={mstcOptions.categories}
              customSubcategories={mstcOptions.subcategories}
              customLocations={mstcOptions.locations}
              customSellers={mstcOptions.sellers}
            />
            {/* Overlay for mobile filters */}
            {isFiltersOpen && (
              <div
                className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
                onClick={() => setIsFiltersOpen(false)}
              />
            )}
          </div>

          {/* Main Content */}
          <div className="flex-grow flex flex-col lg:w-3/4">

            {/* Toolbar */}
            {activeTab === 'commercial' ? (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="hidden lg:block text-sm text-slate-600 font-medium">
                  {!isAnyFilterActive ? (
                    <span>Please select a filter to view auctions</span>
                  ) : (
                    <span>Showing {auctions.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, totalCount)} of {totalCount} auctions</span>
                  )}
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      handleSortChange(e.target.value as any);
                    }}
                    className="w-full sm:w-auto pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-primary focus:border-primary"
                  >
                    <option value="newest">Recently Added</option>
                    <option value="ending_soon">Ending Soon</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>

                  <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 shrink-0">
                    <button
                      onClick={() => setIsGridView(true)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors",
                        isGridView ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsGridView(false)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors",
                        !isGridView ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <List className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-slate-650 font-semibold flex items-center gap-2">
                  <span>Showing {mstcAuctions.length} Government Catalogs</span>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 shrink-0">
                    <button
                      onClick={() => setIsGridView(true)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors cursor-pointer",
                        isGridView ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsGridView(false)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors cursor-pointer",
                        !isGridView ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <List className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Auction Grid/List for Commercial Tab */}
            {activeTab === 'commercial' && (
              <>
                {isLoading ? (
                  <div className="flex justify-center py-20 flex-grow">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : auctions.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 flex-grow">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No auctions found</h3>
                    <p className="text-slate-500 mb-6">Try adjusting your search criteria or filters.</p>
                    <button
                      onClick={() => {
                        setSearchParams({});
                      }}
                      className="px-6 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={clsx(
                      "gap-6",
                      isGridView ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col space-y-4"
                    )}>
                      {auctions.map(auction => (
                        <AuctionCard
                          key={auction.id}
                          auction={auction}
                          isGrid={isGridView}
                          isWatchlistedInitial={watchlistIds.includes(auction.id)}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-10 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 rounded-xl shadow-sm">
                        <div className="flex flex-1 justify-between sm:hidden">
                          <button
                            onClick={() => handlePageChange(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm text-slate-700">
                              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, totalCount)}</span> of <span className="font-medium">{totalCount}</span> results
                            </p>
                          </div>
                          <div>
                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                              <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50 focus:z-20 focus:outline-offset-0"
                              >
                                <span className="sr-only">Previous</span>
                                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                              </button>

                              {[...Array(totalPages)].map((_, i) => (
                                <button
                                  key={i + 1}
                                  onClick={() => setPage(i + 1)}
                                  className={clsx(
                                    "relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ring-1 ring-inset",
                                    page === i + 1
                                      ? "z-10 bg-primary text-white ring-primary focus-visible:outline-primary"
                                      : "text-slate-900 ring-slate-300 hover:bg-slate-50"
                                  )}
                                >
                                  {i + 1}
                                </button>
                              ))}

                              <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50 focus:z-20 focus:outline-offset-0"
                              >
                                <span className="sr-only">Next</span>
                                <ChevronRight className="h-5 w-5" aria-hidden="true" />
                              </button>
                            </nav>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* MSTC Gov Catalogs Tab */}
            {activeTab === 'mstc' && (
              <>
                {isMstcLoading ? (
                  <div className="flex justify-center py-20 flex-grow">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : mstcAuctions.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 flex-grow">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No MSTC catalogs found</h3>
                    <p className="text-slate-500 mb-6">Try adjusting your search criteria or keywords.</p>
                    <button
                      onClick={() => {
                        setSearchParams({ tab: 'mstc' });
                      }}
                      className="px-6 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50"
                    >
                      Clear search & filters
                    </button>
                  </div>
                ) : (
                  <div className={clsx(
                    "gap-6",
                    isGridView ? "grid grid-cols-1 xl:grid-cols-2" : "flex flex-col space-y-4"
                  )}>
                    {mstcAuctions.map(item => (
                      <MstcCard
                        key={item.id}
                        item={item}
                        isGrid={isGridView}
                        onPreview={setSelectedPreviewItem}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>

      {/* Catalog Details Modal */}
      {selectedPreviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 sm:p-6 md:p-8 animate-fade-in">
          <div className="relative w-full max-w-[1400px] h-[95vh] md:h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-scale-up animate-duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold text-slate-400 font-mono">
                  Ref: {selectedPreviewItem.mstc_auction_number.split('/').pop()}
                </span>
                <button
                  onClick={() => {
                    const refId = selectedPreviewItem.mstc_auction_number.split('/').pop() || '';
                    navigator.clipboard.writeText(refId);
                    setCopiedRef(true);
                    setTimeout(() => setCopiedRef(false), 2000);
                  }}
                  className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center"
                  title="Copy Reference ID"
                >
                  {copiedRef ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <button
                onClick={() => setSelectedPreviewItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-5.5 h-5.5" />
              </button>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
              <button
                onClick={() => setModalTab('catalog')}
                className={clsx(
                  "py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider",
                  modalTab === 'catalog'
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                )}
              >
                Catalog Details
              </button>
              <button
                onClick={() => setModalTab('valuation')}
                className={clsx(
                  "py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider flex items-center gap-2",
                  modalTab === 'valuation'
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                )}
              >
                <span>Valuation & ROI Engine</span>
                {valuationData && (
                  <span className={clsx(
                    "text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-normal uppercase",
                    valuationData.recommendation === 'Strong Buy' ? "bg-emerald-100 text-emerald-800" :
                    valuationData.recommendation === 'Buy' ? "bg-emerald-50 text-emerald-700" :
                    valuationData.recommendation === 'Watch Carefully' ? "bg-amber-100 text-amber-800" :
                    "bg-rose-100 text-rose-800"
                  )}>
                    {valuationData.recommendation}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
              {/* Left Side: Details Scrollable */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/25">
                {modalTab === 'valuation' ? (
                  <div className="space-y-6">
                    {/* Cost Input Form Card */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                          Interactive Bid & Cost Estimator
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">Real-time ROI Calculation</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Current Bid Amount (₹)</label>
                          <div className="relative rounded-xl shadow-2xs">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-slate-400 text-xs font-semibold">₹</span>
                            </div>
                            <input
                              type="number"
                              value={customCosts.currentBid}
                              onChange={(e) => setCustomCosts(prev => ({ ...prev, currentBid: Math.max(0, parseFloat(e.target.value) || 0) }))}
                              className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                        </div>



                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Transportation Cost (₹)</label>
                          <div className="relative rounded-xl shadow-2xs">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-slate-400 text-xs font-semibold">₹</span>
                            </div>
                            <input
                              type="number"
                              value={customCosts.transportation}
                              onChange={(e) => setCustomCosts(prev => ({ ...prev, transportation: Math.max(0, parseFloat(e.target.value) || 0) }))}
                              className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Loading & Unloading (₹)</label>
                          <div className="relative rounded-xl shadow-2xs">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-slate-400 text-xs font-semibold">₹</span>
                            </div>
                            <input
                              type="number"
                              value={customCosts.loadingUnloading}
                              onChange={(e) => setCustomCosts(prev => ({ ...prev, loadingUnloading: Math.max(0, parseFloat(e.target.value) || 0) }))}
                              className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Refurbishment Costs (₹)</label>
                          <div className="relative rounded-xl shadow-2xs">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-slate-400 text-xs font-semibold">₹</span>
                            </div>
                            <input
                              type="number"
                              value={customCosts.refurbishment}
                              onChange={(e) => setCustomCosts(prev => ({ ...prev, refurbishment: Math.max(0, parseFloat(e.target.value) || 0) }))}
                              className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Other Service Charges (₹)</label>
                          <div className="relative rounded-xl shadow-2xs">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-slate-400 text-xs font-semibold">₹</span>
                            </div>
                            <input
                              type="number"
                              value={customCosts.otherFees}
                              onChange={(e) => setCustomCosts(prev => ({ ...prev, otherFees: Math.max(0, parseFloat(e.target.value) || 0) }))}
                              className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {isValuating || !valuationData ? (
                      <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">Recalculating Valuation...</h4>
                          <p className="text-xs text-slate-400 mt-1 max-w-xs font-medium">Querying SerpAPI live market pricing and simulating category valuations.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Recommendation Banner */}
                        <div className={clsx(
                          "rounded-3xl p-6 text-white shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border",
                          valuationData.recommendation === 'Strong Buy' ? "bg-gradient-to-r from-emerald-600 to-teal-700 border-emerald-500" :
                          valuationData.recommendation === 'Buy' ? "bg-gradient-to-r from-teal-500 to-emerald-600 border-teal-400" :
                          valuationData.recommendation === 'Watch Carefully' ? "bg-gradient-to-r from-amber-500 to-orange-600 border-amber-400" :
                          "bg-gradient-to-r from-rose-500 to-red-600 border-rose-400"
                        )}>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full font-mono">
                              Bidding Recommendation
                            </span>
                            <h3 className="text-2xl font-black tracking-tight">{valuationData.recommendation}</h3>
                            <p className="text-xs text-white/90 leading-relaxed font-medium mt-1.5 max-w-2xl">
                              {valuationData.recommendationReasoning}
                            </p>
                          </div>
                          <div className="shrink-0 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex flex-col items-center justify-center font-mono">
                            <span className="text-[9px] font-bold uppercase opacity-80">ROI</span>
                            <span className="text-xl font-black">{valuationData.roiPercent}%</span>
                          </div>
                        </div>

                        {/* Investment & ROI metrics grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs space-y-1">
                            <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Estimated Lot Value</h5>
                            <div className="text-lg font-black text-slate-900">₹{valuationData.totalLotValue.toLocaleString('en-IN')}</div>
                            <p className="text-[10px] text-slate-400 font-medium">Market value of items</p>
                          </div>
                          
                          <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs space-y-1">
                            <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Total Lot Cost</h5>
                            <div className="text-lg font-black text-slate-900">₹{valuationData.totalCost.toLocaleString('en-IN')}</div>
                            <p className="text-[10px] text-slate-400 font-medium">Bid + logistics</p>
                          </div>

                          <div className={clsx(
                            "rounded-2xl p-4.5 border shadow-2xs space-y-1",
                            valuationData.estimatedProfit >= 0 
                              ? "bg-emerald-50/50 border-emerald-150 text-emerald-950" 
                              : "bg-rose-50/50 border-rose-150 text-rose-950"
                          )}>
                            <h5 className="text-[9px] font-bold opacity-60 uppercase tracking-widest font-mono">Projected Profit</h5>
                            <div className="text-lg font-black">
                              {valuationData.estimatedProfit >= 0 ? '+' : ''}₹{valuationData.estimatedProfit.toLocaleString('en-IN')}
                            </div>
                            <p className="text-[10px] opacity-70 font-medium">Net profit estimate</p>
                          </div>

                          <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs space-y-1">
                            <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Break-Even Bid</h5>
                            <div className="text-lg font-black text-slate-900">₹{valuationData.breakEven.toLocaleString('en-IN')}</div>
                            <p className="text-[10px] text-slate-400 font-medium">Includes handling</p>
                          </div>
                        </div>

                        {/* Valuation Breakdown Table */}
                        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2 flex items-center justify-between">
                            <span>Valuation Details per Item</span>
                            <span className="text-[10px] text-slate-400 font-medium normal-case font-sans">
                              Valued using live pricing analysis
                            </span>
                          </h4>
                          <div className="overflow-x-auto rounded-xl border border-slate-150 bg-white">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 text-slate-650 border-b border-slate-250 font-mono">
                                  <th className="py-2.5 px-3.5 font-bold">Item Description</th>
                                  <th className="py-2.5 px-3.5 font-bold text-right w-20">Quantity</th>
                                  <th className="py-2.5 px-3.5 font-bold text-right w-32">Unit Est. Value</th>
                                  <th className="py-2.5 px-3.5 font-bold text-right w-36">Total Est. Value</th>
                                  <th className="py-2.5 px-3.5 font-bold text-center w-24">Confidence</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {valuationData.items.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3.5 font-bold text-slate-900">{row.name}</td>
                                    <td className="py-2.5 px-3.5 text-right font-mono text-slate-650">{row.qty}</td>
                                    <td className="py-2.5 px-3.5 text-right font-mono text-slate-950 font-bold">₹{row.unitValue.toLocaleString('en-IN')}</td>
                                    <td className="py-2.5 px-3.5 text-right font-mono text-slate-950 font-bold">₹{row.totalValue.toLocaleString('en-IN')}</td>
                                    <td className="py-2.5 px-3.5 text-center font-mono">
                                      <span className={clsx(
                                        "text-[10px] font-bold px-2 py-0.5 rounded",
                                        row.confidence >= 75 ? "bg-emerald-50 text-emerald-700" :
                                        row.confidence >= 55 ? "bg-amber-50 text-amber-700" :
                                        "bg-rose-50 text-rose-700"
                                      )}>
                                        {row.confidence}%
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Risk & Confidence Assessment Panel */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                              Risk & Confidence Assessment
                            </h4>
                            <span className={clsx(
                              "text-xs font-bold px-3 py-1 rounded-full",
                              valuationData.riskAnalysis.riskLevel === 'Low Risk' ? "bg-emerald-50 text-emerald-700 border border-emerald-150" :
                              valuationData.riskAnalysis.riskLevel === 'Medium Risk' ? "bg-amber-50 text-amber-700 border border-amber-150" :
                              "bg-rose-50 text-rose-700 border border-rose-150"
                            )}>
                              {valuationData.riskAnalysis.riskLevel}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                <span>Data Quality</span>
                                <span className="text-slate-700">{valuationData.riskAnalysis.dataConfidence}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-slate-800 rounded-full transition-all duration-500" 
                                  style={{ width: `${valuationData.riskAnalysis.dataConfidence}%` }} 
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                <span>Pricing Consistency</span>
                                <span className="text-slate-700">{valuationData.riskAnalysis.pricingConfidence}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={clsx(
                                    "h-full rounded-full transition-all duration-500",
                                    valuationData.riskAnalysis.pricingConfidence >= 70 ? "bg-emerald-500" :
                                    valuationData.riskAnalysis.pricingConfidence >= 40 ? "bg-amber-500" : "bg-rose-500"
                                  )}
                                  style={{ width: `${valuationData.riskAnalysis.pricingConfidence}%` }} 
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                <span>Overall Confidence</span>
                                <span className="text-slate-700 font-bold">{valuationData.riskAnalysis.overallConfidence}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={clsx(
                                    "h-full rounded-full transition-all duration-500",
                                    valuationData.riskAnalysis.overallConfidence >= 70 ? "bg-emerald-600" :
                                    valuationData.riskAnalysis.overallConfidence >= 45 ? "bg-amber-600" : "bg-rose-600"
                                  )}
                                  style={{ width: `${valuationData.riskAnalysis.overallConfidence}%` }} 
                                />
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-slate-650 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 font-medium">
                            {valuationData.riskAnalysis.reasoning}
                          </p>
                        </div>

                        {/* Price Trend Chart Panel */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                                Price Trend Comparison (6 Months)
                              </h4>
                              <p className="text-[10px] text-slate-400 font-medium font-sans mt-0.5">
                                Market rate tracking of auction lot items over time
                              </p>
                            </div>
                            <select
                              value={selectedChartItemId}
                              onChange={(e) => setSelectedChartItemId(e.target.value)}
                              className="bg-slate-50 border border-slate-250 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-slate-700 cursor-pointer"
                            >
                              <option value="total">Total Lot Value</option>
                              {valuationData.items.map((item, idx) => (
                                <option key={idx} value={String(idx)}>
                                  {item.name} (Qty: {item.qty})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={getChartData()} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="name" 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} 
                                />
                                <YAxis 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tickFormatter={(v) => `₹${v >= 100000 ? (v/100000).toFixed(1)+'L' : v.toLocaleString('en-IN')}`}
                                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} 
                                />
                                <Tooltip 
                                  formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Est. Value']}
                                  contentStyle={{ 
                                    borderRadius: '16px', 
                                    border: '1px solid #e2e8f0', 
                                    backgroundColor: '#ffffff', 
                                    color: '#0f172a',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                                  }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVal)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* International Market Comparison Panel */}
                        {valuationData.internationalTotals && (
                          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                                Average International Market Price
                              </h4>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Global Average Rate
                              </span>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div>
                                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider block">Average Global Value</span>
                                <h3 className="text-2xl font-black text-slate-950 mt-1">
                                  ₹{Math.round((valuationData.internationalTotals.in + valuationData.internationalTotals.us + valuationData.internationalTotals.uk) / 3).toLocaleString('en-IN')}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-medium mt-1">
                                  Computed average across India, USA, and UK market rates
                                </p>
                              </div>
                              <div className="flex gap-3 text-xs font-mono font-semibold text-slate-650 bg-white p-3 rounded-xl border border-slate-150 shrink-0">
                                <div className="pr-3 border-r border-slate-200">
                                  <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">US Rate</span>
                                  <span>${Math.round(((valuationData.internationalTotals.in + valuationData.internationalTotals.us + valuationData.internationalTotals.uk) / 3) / 85).toLocaleString('en-US')}</span>
                                </div>
                                <div>
                                  <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">UK Rate</span>
                                  <span>£{Math.round(((valuationData.internationalTotals.in + valuationData.internationalTotals.us + valuationData.internationalTotals.uk) / 3) / 108).toLocaleString('en-GB')}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Category & Auction Ref Title */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Category / Item Type</h4>
                  {(() => {
                    const summary = generateCatalogSummary(selectedPreviewItem);
                    let totalTurnover = 0;
                    summary.items.forEach(item => {
                      const qty = getNumericQty(item.qty, item.unit);
                      const price = getNumericPrice(item.marketPrice || '2500');
                      totalTurnover += qty * price;
                    });

                    const predictedClosingBid = totalTurnover * 0.78;
                    const projectedProfit = totalTurnover - predictedClosingBid;
                    const roi = predictedClosingBid > 0 ? (projectedProfit / predictedClosingBid) * 100 : 0;

                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13.5px] text-slate-705">
                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-500 font-semibold text-xs">Projected Turnover</span>
                          <span className="font-bold text-slate-900 text-lg">
                            ₹{totalTurnover.toLocaleString('en-IN')}
                          </span>
                        </div>
                        
                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-500 font-semibold text-xs">Predicted Closing Bid</span>
                          <span className="font-bold text-indigo-650 text-lg">
                            ₹{predictedClosingBid.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-500 font-semibold text-xs">Projected Profit</span>
                          <span className="font-bold text-emerald-600 text-lg">
                            ₹{projectedProfit.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex flex-col space-y-1 items-start">
                          <span className="text-slate-500 font-semibold text-xs">Projected ROI</span>
                          <span className="font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-sm mt-1">
                            +{roi.toFixed(1)}% ROI
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* General Parameters Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Reference Number */}
                  <div className="md:col-span-4 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1.5">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Auction Ref Number</h5>
                    <div className="font-mono text-sm text-slate-700 break-all select-all flex justify-between items-center bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                      <span className="mr-2 text-[13px] font-bold leading-snug">{selectedPreviewItem.mstc_auction_number}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedPreviewItem.mstc_auction_number);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-slate-400 hover:text-primary transition-colors shrink-0 cursor-pointer"
                        title="Copy reference"
                      >
                        {copied ? (
                          <span className="text-[9px] font-bold text-emerald-650 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-150">
                            Copied!
                          </span>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Seller & Location Details */}
                  <div className="md:col-span-4 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2.5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Regional Office</span>
                      <span className="text-sm font-bold text-slate-800 leading-tight mt-0.5">
                        {(() => {
                          const parts = selectedPreviewItem.mstc_auction_number.split('/');
                          const rawOffice = parts.length > 1 && parts[0].toUpperCase() === 'MSTC' ? parts[1] : selectedPreviewItem.seller_name;
                          return expandMstcOffice(rawOffice);
                        })()}
                      </span>
                    </div>
                    {selectedPreviewItem.location && (
                      <div className="flex flex-col border-t border-slate-100 pt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Location / State</span>
                        <span className="text-sm font-bold text-slate-800 mt-0.5">{expandMstcOffice(selectedPreviewItem.location)}</span>
                      </div>
                    )}
                  </div>

                  {/* Dates & Countdown */}
                  <div className="md:col-span-4 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-mono uppercase tracking-wider">Auction Date:</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(selectedPreviewItem.opening_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-slate-100 pt-1.5">
                      <span className="text-slate-400 font-mono uppercase tracking-wider">Bidding Starts:</span>
                      <span className="font-semibold text-slate-800">
                        {(() => {
                          const auctionDate = new Date(selectedPreviewItem.opening_date);
                          const biddingStartDate = new Date(auctionDate.getTime() - 14 * 24 * 60 * 60 * 1000);
                          return biddingStartDate.toLocaleDateString(undefined, { dateStyle: 'medium' });
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-slate-100 pt-1.5 items-center">
                      <span className="text-slate-400 font-mono uppercase tracking-wider">Status:</span>
                      {(() => {
                        const auctionDate = new Date(selectedPreviewItem.opening_date);
                        const biddingStartDate = new Date(auctionDate.getTime() - 14 * 24 * 60 * 60 * 1000);
                        const now = new Date();
                        const diffMs = biddingStartDate.getTime() - now.getTime();
                        if (diffMs <= 0) {
                          return <span className="font-bold text-xs px-2.5 py-0.5 rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50">Bidding Started</span>;
                        }
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        const isUrgent = diffDays < 3;
                        const isWarning = diffDays < 7;
                        return (
                          <span className={clsx(
                            "font-bold text-xs px-2.5 py-0.5 rounded-md border",
                            isUrgent ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" :
                            isWarning ? "text-amber-700 bg-amber-50 border-amber-200" :
                            "text-emerald-700 bg-emerald-50 border-emerald-200"
                          )}>
                            {diffDays > 0 ? `Starts in ${diffDays}d ${diffHours}h` : `Starts in ${diffHours}h ${diffMins}m`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Identified Materials & Lots */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2 flex items-center justify-between">
                    <span>Identified Inventory & Materials</span>
                    <span className="text-[10px] text-slate-405 font-medium normal-case font-sans">
                      {generateCatalogSummary(selectedPreviewItem).items.length} lots identified
                    </span>
                  </h4>
                  
                  <div className="overflow-x-auto rounded-xl border border-slate-150 bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-650 border-b border-slate-250 font-mono">
                          <th className="py-2.5 px-3.5 font-bold w-12 text-center">Lot</th>
                          <th className="py-2.5 px-3.5 font-bold">Material Description</th>
                          <th className="py-2.5 px-3.5 font-bold text-right">Quantity</th>
                          <th className="py-2.5 px-3.5 font-bold text-right">Est. Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {generateCatalogSummary(selectedPreviewItem).items.map((row, idx) => {
                          const valuedItem = valuationData && valuationData.items && valuationData.items[idx];
                          const baseTotalVal = valuedItem ? valuedItem.totalValue : 0;

                          return (
                            <tr key={row.sr} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-400">{row.sr}</td>
                              <td className="py-2.5 px-3.5 font-bold text-slate-900">
                                <div>{row.description}</div>
                                {row.images && row.images.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {row.images.map((imgUrl, imgIdx) => (
                                      <button
                                        key={imgIdx}
                                        type="button"
                                        onClick={() => setLightboxImage(imgUrl)}
                                        className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-500 transition-colors shrink-0 bg-slate-50 flex items-center justify-center cursor-zoom-in"
                                        title="Click to view image"
                                      >
                                        <img
                                          src={imgUrl}
                                          alt={`${row.description} image ${imgIdx + 1}`}
                                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-255"
                                        />
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono text-slate-950 font-bold">{row.qty} {row.unit}</td>
                              <td className="py-2.5 px-3.5 text-right font-mono text-slate-650">
                                {isValuating ? (
                                  <span className="text-[10px] text-slate-400">Valuating...</span>
                                ) : baseTotalVal > 0 ? (
                                  `₹${baseTotalVal.toLocaleString('en-IN')}`
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Eligibility, Compliance & Financial Terms */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Compliance Card */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                      Buyer Eligibility & Compliance
                    </h4>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-650">
                      {generateCatalogSummary(selectedPreviewItem).eligibility.map((el, i) => (
                        <li key={i} className="leading-relaxed">{el}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Financial Charges Card */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                      Financial Terms & Service Fees
                    </h4>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-mono">EMD Details</span>
                        <span className="font-bold text-slate-800">
                          {generateCatalogSummary(selectedPreviewItem).depositDetails.emd}
                        </span>
</div>
                      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-mono">Pre-bid EMD</span>
                        <span className="font-bold text-slate-800">
                          {generateCatalogSummary(selectedPreviewItem).depositDetails.preBidDdg}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Inspection & Site Visit Card */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2 flex items-center justify-between">
                      <span>Inspection & Site Visit</span>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                        Before Bidding
                      </span>
                    </h4>
                    <div className="space-y-2.5 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Inspection Schedule</span>
                        <span className="font-bold text-slate-850 leading-relaxed block">
                          {generateCatalogSummary(selectedPreviewItem).inspectionDetails?.time || 
                           'From publication date to 1 day prior to bidding (10:00 AM - 4:00 PM on working days)'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Inspection Contact / Escort</span>
                        <span className="font-bold text-slate-850 leading-relaxed block">
                          {generateCatalogSummary(selectedPreviewItem).inspectionDetails?.contact || 
                           'Site In-Charge / Contact Person listed in catalog'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Contact Personnel */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                    Key Contact Personnel
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {generateCatalogSummary(selectedPreviewItem).keyContacts.map((contact, i) => (
                      <div key={i} className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-xl space-y-1">
                        <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-wider">{contact.role}</span>
                        <h4 className="text-xs font-black text-slate-900">{contact.name}</h4>
                        <p className="text-[10px] text-slate-500 font-mono break-all mt-0.5">{contact.email}</p>
                        <p className="text-[10px] text-slate-600 font-medium mt-0.5">Phone: {contact.phone || 'no contact info available'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}
            </div>

              {/* Right Side: Image/Preview Panel */}
              {(() => {
                const summary = generateCatalogSummary(selectedPreviewItem);
                return (
                  <div className="w-full md:w-[440px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50 p-5 overflow-y-auto flex flex-col space-y-5">
                    {/* Image Gallery */}
                    {(() => {
                      const imageUrls = (summary.extracted_images || []).filter(
                        (url: string) => !url.toLowerCase().endsWith('.pdf')
                      );
                      if (imageUrls.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150 pb-2 flex items-center justify-between">
                            <span>Auction Images</span>
                            <span className="text-[9.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded font-mono">{imageUrls.length} Photos</span>
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {imageUrls.map((url: string, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setLightboxImage(url)}
                                className="relative rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-white group cursor-zoom-in aspect-square"
                              >
                                <img
                                  src={url}
                                  alt={`Auction image ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-250"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {summary.preview_image_url ? (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150 pb-2">
                          Catalog Document Preview
                        </h4>
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xs bg-white group">
                          <button
                            type="button"
                            onClick={() => setLightboxImage(summary.preview_image_url || null)}
                            className="w-full block text-left cursor-zoom-in"
                          >
                            <img 
                              src={summary.preview_image_url} 
                              alt="PDF First Page Preview" 
                              className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-250"
                            />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-150 bg-slate-50/50 flex flex-col sm:flex-row gap-3 sm:justify-end items-center">
              <button
                onClick={() => setSelectedPreviewItem(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold text-slate-650 hover:text-slate-850 hover:bg-slate-200 transition-all cursor-pointer text-center"
              >
                Close Details
              </button>
              <a
                href={selectedPreviewItem.sanitized_document_path || '#'}
                download
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex justify-center items-center py-2.5 px-6 rounded-xl text-sm font-bold text-white bg-slate-950 hover:bg-primary hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF Catalog
              </a>
            </div>

          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-300"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-white p-2.5 rounded-full cursor-pointer transition-all duration-200 shadow-lg border border-white/10"
            title="Close image"
          >
            <X className="w-6 h-6" />
          </button>
          <div 
            className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage}
              alt="Expanded view"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10 select-none animate-scale-up duration-200"
            />
          </div>
        </div>
      )}
    </div>
  );
}

