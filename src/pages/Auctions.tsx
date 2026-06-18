// @ts-nocheck
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight, Eye, Download, X, Copy, Check, MapPin, Tag, CornerDownLeft, FileText } from 'lucide-react';
import { AuctionCard } from '../components/auction/AuctionCard';
import { MstcCard } from '../components/auction/MstcCard';
import { MstcDetailsModal } from '../components/auction/MstcDetailsModal';
import { AuctionFilters } from '../components/auction/AuctionFilters';
import { auctionService } from '../services/auctionService';
import type { AuctionFilterParams } from '../services/auctionService';
import { useAuthStore } from '../store/authStore';
import { dashboardService } from '../services/dashboardService';
import type { Auction } from '../types/database.types';
import { MstcSearchService, expandMstcOffice } from '../services/publicService';
import type { MstcSanitizedAuction, SearchSuggestion } from '../services/publicService';
import clsx from 'clsx';
import { generateCatalogSummary, formatDateOrdinal, formatDateTimeOrdinal } from '../utils/mstcHelpers';

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
  const [previewTab, setPreviewTab] = useState<'summary' | 'pdf'>('summary');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [interestedMstcIds, setInterestedMstcIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setInterestedMstcIds(dashboardService.getInterestedAuctions(user.id));
    } else {
      setInterestedMstcIds([]);
    }
  }, [user]);

  const handleMstcInterestedToggle = (itemId: string) => {
    if (!user) return;
    dashboardService.toggleInterestedAuction(user.id, itemId);
    setInterestedMstcIds(dashboardService.getInterestedAuctions(user.id));
  };


  const selectedMstcCategories = searchParams.getAll('mstc_category');
  const selectedMstcSubcategories = searchParams.getAll('mstc_subcategory');
  const selectedMstcLocations = searchParams.getAll('mstc_location');
  const selectedMstcSellers = searchParams.getAll('mstc_seller');
  const selectedMstcRegionalOffices = searchParams.getAll('mstc_regional_office');
  const mstcHasAssetDocuments = searchParams.get('has_docs') === 'true';
  const mstcHasImages = searchParams.get('has_images') === 'true';

  const [isGridView, setIsGridView] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

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
        categories: selectedMstcCategories.length > 0 ? selectedMstcCategories : undefined,
        subcategories: selectedMstcSubcategories.length > 0 ? selectedMstcSubcategories : undefined,
        locations: selectedMstcLocations.length > 0 ? selectedMstcLocations : undefined,
        sellers: selectedMstcSellers.length > 0 ? selectedMstcSellers : undefined,
        regionalOffices: selectedMstcRegionalOffices.length > 0 ? selectedMstcRegionalOffices : undefined
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

      // Filter by asset attachments
      if (mstcHasAssetDocuments) {
        filteredData = filteredData.filter(item => {
          if (!item.raw_materials_text) return false;
          try {
            const parsed = JSON.parse(item.raw_materials_text);
            const images = parsed?.extracted_images || [];
            // Asset documents are PDFs or document-type files (not actual photos)
            return images.some((url: string) => url.toLowerCase().endsWith('.pdf'));
          } catch { return false; }
        });
      }
      if (mstcHasImages) {
        filteredData = filteredData.filter(item => {
          if (!item.raw_materials_text) return false;
          try {
            const parsed = JSON.parse(item.raw_materials_text);
            const images = parsed?.extracted_images || [];
            // Photos are non-PDF visual files
            return images.some((url: string) => {
              const lower = url.toLowerCase();
              return !lower.endsWith('.pdf') && /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff?)$/i.test(lower);
            });
          } catch { return false; }
        });
      }

      setMstcAuctions(filteredData);
    } catch (error) {
      console.error('Error loading MSTC catalogs:', error);
    } finally {
      setIsMstcLoading(false);
    }
  }, [
    searchQuery,
    selectedMstcCategories.join(','),
    selectedMstcSubcategories.join(','),
    selectedMstcLocations.join(','),
    selectedMstcSellers.join(','),
    selectedMstcRegionalOffices.join(','),
    startDate,
    endDate,
    mstcHasAssetDocuments,
    mstcHasImages
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
    : Math.ceil(mstcAuctions.length / limit);

  const startIndex = (page - 1) * limit;
  const paginatedMstcAuctions = mstcAuctions.slice(startIndex, startIndex + limit);

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
          <div className="lg:w-1/4 shrink-0 lg:sticky lg:top-[96px] lg:overflow-visible z-20">
            <AuctionFilters
              isOpen={isFiltersOpen}
              onClose={() => setIsFiltersOpen(false)}
              onFilterChange={activeTab === 'commercial' ? handleFilterChange : handleMstcFilterChange}
              initialFilters={activeTab === 'commercial' ? filters : {
                categoryIds: selectedMstcCategories,
                subcategories: selectedMstcSubcategories,
                locations: selectedMstcLocations,
                regionalOffices: selectedMstcRegionalOffices,
                mstcSellers: selectedMstcSellers,
                startDate,
                endDate,
                hasAssetDocuments: mstcHasAssetDocuments,
                hasImages: mstcHasImages
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
                className="fixed inset-0 bg-white/45 backdrop-blur-md z-30 lg:hidden"
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
                  <SkeletonGrid
                    isGrid={isGridView}
                    count={6}
                    classes={clsx(
                      "gap-6 flex-grow",
                      isGridView ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col space-y-4"
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
                    count={4}
                    classes={clsx(
                      "gap-6 flex-grow",
                      isGridView ? "grid grid-cols-1 xl:grid-cols-2" : "flex flex-col space-y-4"
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
                    <div className={clsx(
                      "gap-6",
                      isGridView ? "grid grid-cols-1 xl:grid-cols-2" : "flex flex-col space-y-4"
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
                              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, mstcAuctions.length)}</span> of <span className="font-medium">{mstcAuctions.length}</span> results
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
        <MstcDetailsModal
          item={selectedPreviewItem}
          onClose={() => setSelectedPreviewItem(null)}
          isInterested={interestedMstcIds.includes(selectedPreviewItem.id)}
          onInterestedToggle={() => handleMstcInterestedToggle(selectedPreviewItem.id)}
        />
      )}
    </div>
  );
}

