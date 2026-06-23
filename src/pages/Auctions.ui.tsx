// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight, Eye, Download, X, Copy, Check, Heart, FileText } from 'lucide-react';
import { AuctionCard } from '../components/auction/AuctionCard';
import { MstcCard } from '../components/auction/MstcCard';
import { AuctionFilters } from '../components/auction/AuctionFilters';
import { auctionService } from '../services/auctionService';
import type { AuctionFilterParams } from '../services/auctionService';
import { useAuthStore } from '../store/authStore';
import type { Auction } from '../types/database.types';
import { MstcSearchService, expandMstcOffice } from '../services/publicService';
import type { MstcSanitizedAuction } from '../services/publicService';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import { dashboardService } from '../services/dashboardService';
import { MstcDetailsModal } from '../components/auction/MstcDetailsModal';
import { 
  getEstimatedMarketPrice, 
  getNumericQty, 
  getNumericPrice, 
  generateCatalogSummary 
} from '../utils/mstcHelpers';

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

export function Auctions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const activeTab = 'mstc';

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [mstcAuctions, setMstcAuctions] = useState<MstcSanitizedAuction[]>([]);
  const [interestedMstcIds, setInterestedMstcIds] = useState<string[]>([]);
  const [isMstcLoading, setIsMstcLoading] = useState(false);
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

  const selectedMstcCategories = searchParams.getAll('mstc_category');
  const selectedMstcSubcategories = searchParams.getAll('mstc_subcategory');
  const selectedMstcLocations = searchParams.getAll('mstc_location');
  const selectedMstcSellers = searchParams.getAll('mstc_seller');
  const selectedMstcRegionalOffices = searchParams.getAll('mstc_regional_office');
  const mstcIsReauction = searchParams.get('is_reauction') === 'true';

  const [isGridView, setIsGridView] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Sync searchQuery local input state with query params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const userId = isAuthenticated && user ? user.id : 'anonymous';
    setInterestedMstcIds(dashboardService.getInterestedAuctions(userId));
  }, [isAuthenticated, user]);

  const handleMstcInterestedToggle = (itemId: string) => {
    const userId = isAuthenticated && user ? user.id : 'anonymous';
    const isNowInterested = dashboardService.toggleInterestedAuction(userId, itemId);
    setInterestedMstcIds(dashboardService.getInterestedAuctions(userId));
    if (isNowInterested) {
      toast.success('Added to interested list');
    } else {
      toast.success('Removed from interested list');
    }
  };

  // Derived filter and paging variables from URL query parameters
  const categoryIds = searchParams.getAll('category');
  const listingType = (searchParams.get('listingType') as AuctionFilterParams['listingType']) || undefined;
  const regionalOffices = searchParams.getAll('regionalOffice');
  const locations = searchParams.getAll('location');
  const preBid = searchParams.get('preBid') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const sortBy = (searchParams.get('sortBy') as AuctionFilterParams['sortBy']) || 'newest';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 12;

  const filters: AuctionFilterParams = {
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    listingType,
    regionalOffices: regionalOffices.length > 0 ? regionalOffices : undefined,
    locations: locations.length > 0 ? locations : undefined,
    preBid,
    startDate,
    endDate,
  };

  const isAnyFilterActive = !!(
    (filters.categoryIds && filters.categoryIds.length > 0) ||
    filters.listingType ||
    (filters.regionalOffices && filters.regionalOffices.length > 0) ||
    (filters.locations && filters.locations.length > 0) ||
    filters.preBid ||
    filters.startDate ||
    filters.endDate ||
    searchParams.get('q')
  );

  const categoryIdsJoined = categoryIds.join(',');
  const regionalOfficesJoined = regionalOffices.join(',');
  const locationsJoined = locations.join(',');

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
    regionalOfficesJoined,
    locationsJoined,
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
  const selectedMstcSellersJoined = selectedMstcSellers.join(',');
  const selectedMstcRegionalOfficesJoined = selectedMstcRegionalOffices.join(',');

  const loadMstcData = useCallback(async () => {
    setIsMstcLoading(true);
    try {
      const { data } = await MstcSearchService.searchMarketplaceCatalog(searchQuery, {
        categories: selectedMstcCategories,
        subcategories: selectedMstcSubcategories,
        locations: selectedMstcLocations,
        sellers: selectedMstcSellers,
        regionalOffices: selectedMstcRegionalOffices,
        isReauction: mstcIsReauction || undefined
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
  }, [
    searchQuery,
    selectedMstcCategoriesJoined,
    selectedMstcSubcategoriesJoined,
    selectedMstcLocationsJoined,
    selectedMstcSellersJoined,
    selectedMstcRegionalOfficesJoined,
    startDate,
    endDate,
    mstcIsReauction
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
          newFilters.categoryIds.forEach((id: string) => next.append('mstc_category', id));
        }
      }

      // Update Subcategory
      if ('subcategories' in newFilters) {
        next.delete('mstc_subcategory');
        if (newFilters.subcategories && newFilters.subcategories.length > 0) {
          newFilters.subcategories.forEach((sub: string) => next.append('mstc_subcategory', sub));
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
          newFilters.locations.forEach((loc: string) => next.append('mstc_location', loc));
        }
      } else if ('location' in newFilters) {
        next.delete('mstc_location');
        if (newFilters.location) {
          next.set('mstc_location', newFilters.location);
        }
      }

      // Update Regional Office
      if ('regionalOffices' in newFilters) {
        next.delete('mstc_regional_office');
        if (newFilters.regionalOffices && newFilters.regionalOffices.length > 0) {
          newFilters.regionalOffices.forEach((office: string) => next.append('mstc_regional_office', office));
        }
      } else if ('regionalOffice' in newFilters) {
        next.delete('mstc_regional_office');
        if (newFilters.regionalOffice) {
          next.set('mstc_regional_office', newFilters.regionalOffice);
        }
      }

      // Update Seller
      if ('mstcSellers' in newFilters) {
        next.delete('mstc_seller');
        if (newFilters.mstcSellers && newFilters.mstcSellers.length > 0) {
          newFilters.mstcSellers.forEach((sel: string) => next.append('mstc_seller', sel));
        }
      } else if ('mstcSeller' in newFilters) {
        next.delete('mstc_seller');
        if (newFilters.mstcSeller) {
          next.set('mstc_seller', newFilters.mstcSeller);
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

      // Update isReauction
      if ('isReauction' in newFilters) {
        if (newFilters.isReauction) {
          next.set('is_reauction', 'true');
        } else {
          next.delete('is_reauction');
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
        }
      }

      // Update locations
      if ('locations' in newFilters) {
        next.delete('location');
        if (newFilters.locations && newFilters.locations.length > 0) {
          newFilters.locations.forEach(loc => next.append('location', loc));
        }
      } else if ('location' in newFilters) {
        next.delete('location');
        if (newFilters.location) {
          next.set('location', newFilters.location);
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
      <div className="relative bg-slate-900 overflow-hidden py-12">
        {/* Background decoration */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-slate-900 mix-blend-multiply" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/20 to-transparent" />
        </div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-2">Auctions Marketplace</h1>
          <p className="text-slate-400 mb-6">Browse official government catalogs and MSTC eAuctions.</p>

          <form onSubmit={handleSearch} className="max-w-3xl relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-24 py-4 border-0 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 sm:text-lg shadow-lg text-slate-900"
              placeholder={activeTab === 'commercial' ? "Search by title, reference number, or keywords..." : "Search MSTC catalog numbers, categories, or sellers..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="submit"
              className="absolute right-2 top-2 bottom-2 px-6 bg-slate-900 text-white font-medium rounded-lg hover:bg-black transition-colors"
            >
              Search
            </button>
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
                isReauction: mstcIsReauction
              }}
              activeTab={activeTab}
              customCategories={mstcOptions.categories}
              customSubcategories={mstcOptions.subcategories}
              customLocations={mstcOptions.locations}
              customSellers={mstcOptions.sellers}
              customRegionalOffices={mstcOptions.regionalOffices}
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
                  <button
                    onClick={() => navigate(isAuthenticated ? '/dashboard/quotes' : '/quotes')}
                    className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs shrink-0"
                  >
                    <FileText className="w-4 h-4" />
                    Build a Quote
                  </button>
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
                        isGridView ? "bg-white shadow-sm text-slate-900 font-bold" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsGridView(false)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors",
                        !isGridView ? "bg-white shadow-sm text-slate-900 font-bold" : "text-slate-500 hover:text-slate-700"
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
                  <button
                    onClick={() => navigate(isAuthenticated ? '/dashboard/quotes' : '/quotes')}
                    className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs shrink-0"
                  >
                    <FileText className="w-4 h-4" />
                    Build a Quote
                  </button>
                  <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 shrink-0">
                    <button
                      onClick={() => setIsGridView(true)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors cursor-pointer",
                        isGridView ? "bg-white shadow-sm text-slate-900 font-bold" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsGridView(false)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors cursor-pointer",
                        !isGridView ? "bg-white shadow-sm text-slate-900 font-bold" : "text-slate-500 hover:text-slate-700"
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
                                      ? "z-10 bg-slate-900 text-white ring-slate-900 focus-visible:outline-slate-900"
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
                        isInterested={interestedMstcIds.includes(item.id)}
                        onInterestedToggle={() => handleMstcInterestedToggle(item.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

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
          </div>
        </div>
      </div>
  );
}

