// @ts-nocheck
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight, Eye, Download, X, Copy, Check, MapPin, Tag, CornerDownLeft, FileText } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { AuctionCard } from '../components/auction/AuctionCard';
import { MstcCard } from '../components/auction/MstcCard';
const MstcDetailsModal = lazy(() => import('../components/auction/MstcDetailsModal').then(module => ({ default: module.MstcDetailsModal })));
import { AuctionFilters } from '../components/auction/AuctionFilters';
import { auctionService } from '../services/auctionService';
import type { AuctionFilterParams } from '../services/auctionService';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { dashboardService } from '../services/dashboardService';
import type { Auction } from '../types/database.types';
import { MstcSearchService, expandMstcOffice } from '../services/publicService';
import type { MstcSanitizedAuction, SearchSuggestion } from '../services/publicService';
import clsx from 'clsx';
import { generateCatalogSummary, formatDateOrdinal, formatDateTimeOrdinal } from '../utils/mstcHelpers';
import { recommendationService } from '../services/recommendationService';

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

function AuctionCardSkeleton({ isGrid }: { isGrid: boolean }) {
  if (isGrid) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full animate-pulse shadow-sm p-4 md:p-5">
        <div className="h-40 bg-slate-100 rounded-xl mb-4 shrink-0" />
        <div className="flex-grow flex flex-col space-y-3">
          <div className="h-3 bg-slate-200 rounded w-1/4" />
          <div className="space-y-2 flex-grow">
            <div className="h-5 bg-slate-200 rounded w-3/4" />
            <div className="h-5 bg-slate-200 rounded w-1/2" />
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="h-3 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-between items-end mt-auto">
            <div className="space-y-1.5">
              <div className="h-2.5 bg-slate-200 rounded w-16" />
              <div className="h-5 bg-slate-200 rounded w-24" />
            </div>
            <div className="h-8 bg-slate-200 rounded w-20" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse p-5 gap-5 shadow-sm">
      <div className="w-full sm:w-64 h-40 bg-slate-150 rounded-lg shrink-0" />
      <div className="flex-grow flex flex-col space-y-4 justify-between">
        <div className="space-y-2">
          <div className="h-3 bg-slate-200 rounded w-1/4" />
          <div className="h-5 bg-slate-250 rounded w-1/2" />
          <div className="h-4 bg-slate-200 rounded w-full" />
        </div>
        <div className="flex gap-4 pt-2">
          <div className="h-3 bg-slate-200 rounded w-1/4" />
          <div className="h-3 bg-slate-200 rounded w-1/4" />
          <div className="h-3 bg-slate-200 rounded w-1/4" />
        </div>
        <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-auto">
          <div className="h-6 bg-slate-200 rounded w-28" />
          <div className="h-9 bg-slate-200 rounded w-28" />
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid({ isGrid, count = 6, classes }: { isGrid: boolean; count?: number; classes?: string }) {
  return (
    <div className={classes}>
      {[...Array(count)].map((_, i) => (
        <AuctionCardSkeleton key={i} isGrid={isGrid} />
      ))}
    </div>
  );
}

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = [];
  
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      pages.push(currentPage - 1);
      pages.push(currentPage);
      pages.push(currentPage + 1);
      pages.push('...');
      pages.push(totalPages);
    }
  }
  
  return pages;
}

export function Auctions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();

  const rawTab = searchParams.get('tab');
  const activeTab = rawTab === 'commercial' ? 'commercial' : 'mstc';

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [mstcAuctions, setMstcAuctions] = useState<MstcSanitizedAuction[]>([]);
  const [mstcTotalCount, setMstcTotalCount] = useState(0);
  const [isMstcLoading, setIsMstcLoading] = useState(false);
  const [isShowingSimilarMstc, setIsShowingSimilarMstc] = useState(false);
  const [mstcOptions, setMstcOptions] = useState<{
    categories: string[];
    subcategories: Record<string, string[]>;
    sellers: string[];
    locations: string[];
    regionalOffices: string[];
  }>({
    categories: [],
    subcategories: {},
    sellers: [],
    locations: [],
    regionalOffices: []
  });

  const [selectedPreviewItem, setSelectedPreviewItem] = useState<MstcSanitizedAuction | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [previewTab, setPreviewTab] = useState<'summary' | 'pdf'>('summary');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { interestedMstcIds, toggleInterestedMstcId } = useAppStore();

  const handleMstcInterestedToggle = (itemId: string) => {
    if (!user) return;
    toggleInterestedMstcId(user.id, itemId);
  };


  const selectedMstcCategories = searchParams.getAll('mstc_category');
  const selectedMstcSubcategories = searchParams.getAll('mstc_subcategory');
  const selectedMstcLocations = searchParams.getAll('mstc_location');
  const selectedMstcRegionalOffices = searchParams.getAll('mstc_regional_office');
  const mstcHasAssetDocuments = searchParams.get('has_docs') === 'true';
  const mstcHasImages = searchParams.get('has_images') === 'true';
  const mstcIsReauction = searchParams.get('is_reauction') === 'true';
  const mstcPreBid = searchParams.get('mstc_pre_bid') || undefined;
  const submittedSearchQuery = (searchParams.get('q') || '').trim();

  const [isGridView, setIsGridView] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [columns, setColumns] = useState<2 | 3 | 4 | 5>(3);

  const getGridColsClass = (cols: number) => {
    switch (cols) {
      case 2:
        return "grid-cols-1 md:grid-cols-2";
      case 4:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4";
      case 5:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
      case 3:
      default:
        return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    }
  };

  // Lock body scroll when mobile filters drawer is active
  useEffect(() => {
    if (isFiltersOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFiltersOpen]);

  // Show floating filter tag only after scrolling past the hero section
  const [scrollPastHero, setScrollPastHero] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setScrollPastHero(window.scrollY > 280);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync searchQuery local input state with query params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);


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

  // Hybrid search examples cycling typing animation
  const placeholderExamples = [
    "Show me auctions in Delhi",
    "Show me vehicle auctions",
    "Show me property auctions",
    "Copper scrap auctions in Mumbai",
    "Iron and steel scrap near Kolkata",
    "Auctions in Kolkata",
    "Auctions in Tamil Nadu",
    "Auctions in Chennai",
    "Auctions in Bangalore"
  ];
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [phExampleIdx, setPhExampleIdx] = useState(0);
  const [phCharIdx, setPhCharIdx] = useState(0);
  const [phPhase, setPhPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');

  useEffect(() => {
    const current = placeholderExamples[phExampleIdx];
    let timer: ReturnType<typeof setTimeout>;

    if (phPhase === 'typing') {
      if (phCharIdx < current.length) {
        timer = setTimeout(() => {
          setAnimatedPlaceholder(current.substring(0, phCharIdx + 1));
          setPhCharIdx(prev => prev + 1);
        }, 70);
      } else {
        // Done typing, pause before deleting
        timer = setTimeout(() => setPhPhase('pausing'), 2200);
      }
    } else if (phPhase === 'pausing') {
      timer = setTimeout(() => setPhPhase('deleting'), 100);
    } else if (phPhase === 'deleting') {
      if (phCharIdx > 0) {
        timer = setTimeout(() => {
          setPhCharIdx(prev => prev - 1);
          setAnimatedPlaceholder(current.substring(0, phCharIdx - 1));
        }, 25);
      } else {
        // Done deleting, move to next example
        setPhExampleIdx(prev => (prev + 1) % placeholderExamples.length);
        setPhPhase('typing');
      }
    }

    return () => clearTimeout(timer);
  }, [phCharIdx, phPhase, phExampleIdx]);

  const selectSuggestion = (suggestion: SearchSuggestion) => {
    let queryText = suggestion.text;
    if (suggestion.type === 'location' && queryText.startsWith('Auctions in ')) {
      queryText = queryText.replace('Auctions in ', '');
    }
    setSearchQuery(queryText);
    setShowSuggestions(false);
    setHighlightedIndex(-1);

    if (user) {
      recommendationService.logUserSearch(user.id, queryText);
    }

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
  const limit = 60;

  const filters: AuctionFilterParams = {
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    listingType,
    regionalOffice,
    location,
    preBid,
    startDate,
    endDate,
  };

  const mstcActiveFilters = [
    ...(submittedSearchQuery ? [{ label: 'Search', value: submittedSearchQuery }] : []),
    ...(selectedMstcCategories.length ? [{ label: 'Category', value: selectedMstcCategories.join(', ') }] : []),
    ...(selectedMstcSubcategories.length ? [{ label: 'Subcategory', value: selectedMstcSubcategories.join(', ') }] : []),
    ...(selectedMstcLocations.length ? [{ label: 'Location', value: selectedMstcLocations.join(', ') }] : []),
    ...(selectedMstcRegionalOffices.length ? [{ label: 'Regional office', value: selectedMstcRegionalOffices.join(', ') }] : []),
    ...(startDate ? [{ label: 'From', value: startDate }] : []),
    ...(endDate ? [{ label: 'To', value: endDate }] : []),
    ...(mstcHasAssetDocuments ? [{ label: 'Documents', value: 'Available' }] : []),
    ...(mstcHasImages ? [{ label: 'Images', value: 'Available' }] : []),
    ...(mstcIsReauction ? [{ label: 'Auction status', value: 'Re-auction' }] : []),
  ];

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

  const categoryIdsJoined = categoryIds.join(',');

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
    categoryIdsJoined,
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

  const selectedMstcCategoriesJoined = selectedMstcCategories.join(',');
  const selectedMstcSubcategoriesJoined = selectedMstcSubcategories.join(',');
  const selectedMstcLocationsJoined = selectedMstcLocations.join(',');
  const selectedMstcRegionalOfficesJoined = selectedMstcRegionalOffices.join(',');

  const mstcInitialFilters = useMemo(() => ({
    categoryIds: selectedMstcCategories,
    subcategories: selectedMstcSubcategories,
    locations: selectedMstcLocations,
    regionalOffices: selectedMstcRegionalOffices,
    startDate,
    endDate,
    hasAssetDocuments: mstcHasAssetDocuments,
    hasImages: mstcHasImages,
    isReauction: mstcIsReauction,
    preBid: mstcPreBid
  }), [
    selectedMstcCategoriesJoined,
    selectedMstcSubcategoriesJoined,
    selectedMstcLocationsJoined,
    selectedMstcRegionalOfficesJoined,
    startDate,
    endDate,
    mstcHasAssetDocuments,
    mstcHasImages,
    mstcIsReauction,
    mstcPreBid
  ]);

  const loadMstcData = useCallback(async () => {
    setIsMstcLoading(true);
    try {
      const qParam = searchParams.get('q') || '';
      const searchFilters = {
        categories: selectedMstcCategories.length > 0 ? selectedMstcCategories : undefined,
        subcategories: selectedMstcSubcategories.length > 0 ? selectedMstcSubcategories : undefined,
        locations: selectedMstcLocations.length > 0 ? selectedMstcLocations : undefined,
        regionalOffices: selectedMstcRegionalOffices.length > 0 ? selectedMstcRegionalOffices : undefined,
        startDate,
        endDate,
        hasImages: mstcHasImages,
        hasAssetDocuments: mstcHasAssetDocuments,
        isReauction: mstcIsReauction || undefined,
        preBid: mstcPreBid,
        page,
        limit
      };

      let result = await MstcSearchService.searchMarketplaceCatalog(qParam, searchFilters);
      let showingSimilar = !!qParam.trim() && result.data.length > 0 && result.hasDirectMatches === false;

      // Don't dump ALL catalogs as a fallback — just show empty state
      // The spell correction in publicService already tried to fix typos

      setMstcAuctions(result.data);
      setMstcTotalCount(result.count);
      setIsShowingSimilarMstc(showingSimilar);
    } catch (error) {
      console.error('Error loading MSTC catalogs:', error);
      setIsShowingSimilarMstc(false);
    } finally {
      setIsMstcLoading(false);
    }
  }, [
    searchParams,
    selectedMstcCategoriesJoined,
    selectedMstcSubcategoriesJoined,
    selectedMstcLocationsJoined,
    selectedMstcRegionalOfficesJoined,
    startDate,
    endDate,
    mstcHasAssetDocuments,
    mstcHasImages,
    mstcIsReauction,
    mstcPreBid,
    page,
    limit
  ]);

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
    }
  }, [activeTab, loadData]);

  useEffect(() => {
    if (activeTab === 'mstc') {
      loadMstcData();
    }
  }, [activeTab, loadMstcData]);

  // Prefetch adjacent pages into PageCache after current page loads
  useEffect(() => {
    if (isMstcLoading || mstcTotalCount === 0) return;

    const totalPg = Math.ceil(mstcTotalCount / limit);
    const qParam = searchParams.get('q') || '';
    const baseFilters = {
      categories: selectedMstcCategories.length > 0 ? selectedMstcCategories : undefined,
      subcategories: selectedMstcSubcategories.length > 0 ? selectedMstcSubcategories : undefined,
      locations: selectedMstcLocations.length > 0 ? selectedMstcLocations : undefined,
      regionalOffices: selectedMstcRegionalOffices.length > 0 ? selectedMstcRegionalOffices : undefined,
      startDate,
      endDate,
      hasImages: mstcHasImages,
      hasAssetDocuments: mstcHasAssetDocuments,
      isReauction: mstcIsReauction || undefined,
      preBid: mstcPreBid,
      limit
    };

    const pagesToPrefetch: number[] = [];
    if (page < totalPg) pagesToPrefetch.push(page + 1);
    if (page > 1) pagesToPrefetch.push(page - 1);

    if (pagesToPrefetch.length === 0) return;

    // Use requestIdleCallback (or setTimeout fallback) to avoid blocking UI
    const schedule = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 200);
    const id = schedule(() => {
      pagesToPrefetch.forEach(pg => {
        MstcSearchService.searchMarketplaceCatalog(qParam, { ...baseFilters, page: pg }).catch(() => {});
      });
    });

    return () => {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id as number);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMstcLoading, mstcTotalCount, page]);

  useEffect(() => {
    // Load options when tab is active OR initially on mount
    loadMstcOptions();
  }, [loadMstcOptions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (user && searchQuery) {
      recommendationService.logUserSearch(user.id, searchQuery);
    }
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
        next.delete('mstc_category');
        if (newFilters.categoryIds && newFilters.categoryIds.length > 0) {
          newFilters.categoryIds.forEach((cat: string) => {
            next.append('mstc_category', cat);
          });
        }
      }

      // Update Subcategory
      if ('subcategories' in newFilters) {
        next.delete('mstc_subcategory');
        if (newFilters.subcategories && newFilters.subcategories.length > 0) {
          newFilters.subcategories.forEach((sub: string) => {
            next.append('mstc_subcategory', sub);
          });
        }
      } else if ('subcategory' in newFilters) {
        next.delete('mstc_subcategory');
        if (newFilters.subcategory) {
          next.set('mstc_subcategory', newFilters.subcategory);
        }
      }

      // Update Location
      if ('locations' in newFilters) {
        next.delete('mstc_location');
        if (newFilters.locations && newFilters.locations.length > 0) {
          newFilters.locations.forEach((loc: string) => {
            next.append('mstc_location', loc);
          });
        }
      } else if ('location' in newFilters) {
        next.delete('mstc_location');
        if (newFilters.location) {
          next.set('mstc_location', newFilters.location);
        }
      }

      // Update Regional Offices
      if ('regionalOffices' in newFilters) {
        next.delete('mstc_regional_office');
        if (newFilters.regionalOffices && newFilters.regionalOffices.length > 0) {
          newFilters.regionalOffices.forEach((office: string) => {
            next.append('mstc_regional_office', office);
          });
        }
      } else if ('regionalOffice' in newFilters) {
        next.delete('mstc_regional_office');
        if (newFilters.regionalOffice) {
          next.set('mstc_regional_office', newFilters.regionalOffice);
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

      // Update asset attachment filters
      if ('hasAssetDocuments' in newFilters) {
        if (newFilters.hasAssetDocuments) {
          next.set('has_docs', 'true');
        } else {
          next.delete('has_docs');
        }
      }
      if ('hasImages' in newFilters) {
        if (newFilters.hasImages) {
          next.set('has_images', 'true');
        } else {
          next.delete('has_images');
        }
      }
      if ('isReauction' in newFilters) {
        if (newFilters.isReauction) {
          next.set('is_reauction', 'true');
        } else {
          next.delete('is_reauction');
        }
      }
      if ('preBid' in newFilters) {
        if (newFilters.preBid) {
          next.set('mstc_pre_bid', newFilters.preBid);
        } else {
          next.delete('mstc_pre_bid');
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

      // Update regionalOffices
      if ('regionalOffices' in newFilters) {
        next.delete('regionalOffice');
        if (newFilters.regionalOffices && newFilters.regionalOffices.length > 0) {
          newFilters.regionalOffices.forEach(office => next.append('regionalOffice', office));
        }
      } else if ('regionalOffice' in newFilters) {
        next.delete('regionalOffice');
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

  const totalPages = activeTab === 'commercial'
    ? Math.ceil(totalCount / limit)
    : Math.ceil(mstcTotalCount / limit);

  const startIndex = (page - 1) * limit;
  const paginatedMstcAuctions = mstcAuctions;

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="relative bg-slate-900 py-20 md:py-28 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-slate-900 mix-blend-multiply" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/20 to-transparent" />
        </div>

        <div className="relative z-30 container mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center justify-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">Auctions Marketplace</h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg mb-8 max-w-2xl font-medium leading-relaxed">
            Browse official government catalogs, bank properties and MSTC eAuctions.
          </p>

          <form onSubmit={handleSearch} className="max-w-3xl w-full mx-auto relative" onKeyDown={handleKeyDown}>
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-slate-400" />
            </div>
            <input
              ref={inputRef}
              type="text"
              className="block w-full pl-14 pr-28 py-5 border-0 rounded-2xl leading-6 bg-white focus:outline-none focus:ring-2 focus:ring-primary text-lg shadow-xl text-slate-900"
              placeholder=""
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => setShowSuggestions(true)}
              autoComplete="off"
            />
            {/* Custom animated placeholder with blinking cursor */}
            {!searchQuery && (
              <div className="absolute inset-y-0 left-14 right-28 flex items-center pointer-events-none select-none overflow-hidden">
                <span className="text-lg text-slate-400 whitespace-nowrap">{animatedPlaceholder}</span>
                <span className="inline-block w-0.5 h-6 bg-slate-400 ml-0.5 animate-[blink_1s_step-end_infinite]" />
              </div>
            )}
            <button
              type="submit"
              className="absolute right-2.5 top-2.5 bottom-2.5 px-7 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors cursor-pointer text-base"
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

      {/* Pullable Left Filter Drawer & Floating Side Tag anchored to far left screen border */}
      <div className="fixed top-1/2 -translate-y-1/2 left-0 z-50 pointer-events-none">
        {/* Backdrop Overlay */}
        <div 
          className={clsx(
            "fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto lg:hidden",
            isFiltersOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setIsFiltersOpen(false)}
        />

        {/* Sliding Flex Wrapper */}
        <div 
          className={clsx(
            "relative flex items-start pointer-events-auto transition-transform duration-300 ease-in-out transform",
            isFiltersOpen ? "translate-x-0" : "-translate-x-[340px] sm:-translate-x-[380px]"
          )}
        >
          {/* Filter Drawer Container */}
          <div 
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            className="w-[340px] sm:w-[380px] max-h-[85vh] bg-white rounded-r-3xl rounded-l-none border-r border-y border-l-0 border-slate-200 shadow-2xl flex flex-col overflow-hidden"
          >
            <AuctionFilters
              onClose={() => setIsFiltersOpen(false)}
              onFilterChange={activeTab === 'commercial' ? handleFilterChange : handleMstcFilterChange}
              initialFilters={activeTab === 'commercial' ? filters : mstcInitialFilters}
              activeTab={activeTab}
              customCategories={mstcOptions.categories}
              customSubcategories={mstcOptions.subcategories}
              customLocations={mstcOptions.locations}
              customRegionalOffices={mstcOptions.regionalOffices}
            />
          </div>

          {/* Attached Side Tag Button */}
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            className={clsx(
              "mt-16 shrink-0 flex items-center justify-between bg-primary text-white font-bold text-xs rounded-r-2xl rounded-l-none border border-l-0 border-white/20 shadow-2xl hover:bg-primary/95 active:scale-95 transition-all duration-300 cursor-pointer select-none group translate-x-0 overflow-hidden",
              (!isFiltersOpen && !scrollPastHero)
                ? "px-2.5 py-3 hover:px-3.5"
                : "px-3.5 py-3"
            )}
            title={isFiltersOpen ? "Close filters panel" : "Open filters panel"}
            aria-label="Toggle filters side panel"
          >
            <div className={clsx(
              "flex items-center gap-1.5 shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
              (!isFiltersOpen && !scrollPastHero)
                ? "max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:mr-1"
                : "max-w-[120px] opacity-100 mr-1"
            )}>
              <SlidersHorizontal className="w-4 h-4 text-white shrink-0" />
              <span className="font-semibold tracking-wider uppercase text-[11px] whitespace-nowrap">
                Filters
              </span>
            </div>
            {mstcActiveFilters.length > 0 && (
              <span className="bg-white text-primary text-[10px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mr-1">
                {mstcActiveFilters.length}
              </span>
            )}
            {isFiltersOpen ? (
              <X className="w-4 h-4 text-white/90 group-hover:scale-110 transition-transform shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white/90 group-hover:translate-x-0.5 transition-transform shrink-0" />
            )}
          </button>
        </div>
      </div>

      <div className="container max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Main Content */}
          <div className="flex-grow flex flex-col w-full">

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

                  {/* Column Switcher (Hidden on mobile) */}
                  <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 shrink-0">
                    {[2, 3, 4, 5].map((cols) => (
                      <button
                        key={cols}
                        onClick={() => {
                          setIsGridView(true);
                          setColumns(cols as any);
                        }}
                        className={clsx(
                          "px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer",
                          isGridView && columns === cols
                            ? "bg-white shadow-sm text-primary"
                            : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        {cols} Col
                      </button>
                    ))}
                  </div>

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
            ) : (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="min-w-0 flex items-center h-full">
                  <div className="space-y-1">
                    <div className="text-sm text-slate-700 font-semibold flex items-center h-full">
                      Showing {mstcTotalCount} Government Catalogs
                    </div>
                    {mstcActiveFilters.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5" aria-label="Applied filters">
                        <span className="text-xs font-medium text-slate-500 mr-0.5">Applied filters:</span>
                        {mstcActiveFilters.map(filter => (
                          <span
                            key={`${filter.label}-${filter.value}`}
                            className="max-w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                            title={`${filter.label}: ${filter.value}`}
                          >
                            <span className="font-semibold text-slate-700">{filter.label}:</span>{' '}
                            <span className="break-words">{filter.value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Desktop Filter Toggle Button */}
                  <button
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className={clsx(
                      "hidden lg:flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all cursor-pointer",
                      isFiltersOpen
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                    )}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>{isFiltersOpen ? "Hide Filters" : "Show Filters"}</span>
                    {mstcActiveFilters.length > 0 && (
                      <span className={clsx(
                        "text-[11px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center -mr-1",
                        isFiltersOpen ? "bg-white text-primary" : "bg-primary text-white"
                      )}>
                        {mstcActiveFilters.length}
                      </span>
                    )}
                  </button>

                  {/* Column Switcher (Hidden on mobile) */}
                  <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 shrink-0">
                    {[2, 3, 4, 5].map((cols) => (
                      <button
                        key={cols}
                        onClick={() => {
                          setIsGridView(true);
                          setColumns(cols as any);
                        }}
                        className={clsx(
                          "px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer",
                          isGridView && columns === cols
                            ? "bg-white shadow-sm text-primary"
                            : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        {cols} Col
                      </button>
                    ))}
                  </div>

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
                  <SkeletonGrid
                    isGrid={isGridView}
                    count={6}
                    classes={clsx(
                      "gap-6 flex-grow",
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
                    )}
                  />
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
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
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
                                onClick={() => handlePageChange(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50 focus:z-20 focus:outline-offset-0"
                              >
                                <span className="sr-only">Previous</span>
                                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                              </button>

                              {getPageNumbers(page, totalPages).map((p, i) => {
                                if (p === '...') {
                                  return (
                                    <span
                                      key={`dots-comm-${i}`}
                                      className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-inset ring-slate-300 focus:outline-none"
                                    >
                                      ...
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={p}
                                    onClick={() => handlePageChange(p as number)}
                                    className={clsx(
                                      "relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ring-1 ring-inset cursor-pointer",
                                      page === p
                                        ? "z-10 bg-primary text-white ring-primary focus-visible:outline-primary"
                                        : "text-slate-900 ring-slate-300 hover:bg-slate-50"
                                    )}
                                  >
                                    {p}
                                  </button>
                                );
                              })}

                              <button
                                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
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
                  <SkeletonGrid
                    isGrid={isGridView}
                    count={6}
                    classes={clsx(
                      "gap-6 flex-grow",
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
                    )}
                  />
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
                  <>
                    {isShowingSimilarMstc && submittedSearchQuery && (
                      <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3" role="status">
                        <p className="text-sm font-semibold text-slate-900">
                          We couldn't find exactly what you're looking for.
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          Here are similar listings for &ldquo;{submittedSearchQuery}&rdquo;.
                        </p>
                      </div>
                    )}
                    <div className={clsx(
                      "gap-6",
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
                    )}>
                      {paginatedMstcAuctions.map(item => (
                        <MstcCard
                          key={item.id}
                          item={item}
                          isGrid={isGridView}
                          onPreview={setSelectedPreviewItem}
                          isInterested={interestedMstcIds.includes(item.id)}
                          onInterestedToggle={() => handleMstcInterestedToggle(item.id)}
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
                              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, mstcTotalCount)}</span> of <span className="font-medium">{mstcTotalCount}</span> results
                            </p>
                          </div>
                          <div>
                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                              <button
                                onClick={() => handlePageChange(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50 focus:z-20 focus:outline-offset-0"
                              >
                                <span className="sr-only">Previous</span>
                                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                              </button>

                              {getPageNumbers(page, totalPages).map((p, i) => {
                                if (p === '...') {
                                  return (
                                    <span
                                      key={`dots-mstc-${i}`}
                                      className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-inset ring-slate-300 focus:outline-none"
                                    >
                                      ...
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={p}
                                    onClick={() => handlePageChange(p as number)}
                                    className={clsx(
                                      "relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ring-1 ring-inset cursor-pointer",
                                      page === p
                                        ? "z-10 bg-primary text-white ring-primary focus-visible:outline-primary"
                                        : "text-slate-900 ring-slate-300 hover:bg-slate-50"
                                    )}
                                  >
                                    {p}
                                  </button>
                                );
                              })}

                              <button
                                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
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

          </div>
        </div>
      </div>

      {/* Catalog Details Modal */}
      {selectedPreviewItem && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-xs">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        }>
          <MstcDetailsModal
            item={selectedPreviewItem}
            onClose={() => setSelectedPreviewItem(null)}
            isInterested={interestedMstcIds.includes(selectedPreviewItem.id)}
            onInterestedToggle={() => handleMstcInterestedToggle(selectedPreviewItem.id)}
          />
        </Suspense>
      )}
    </div>
  );
}

