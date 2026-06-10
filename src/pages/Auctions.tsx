// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { AuctionCard } from '../components/auction/AuctionCard';
import { AuctionFilters } from '../components/auction/AuctionFilters';
import { auctionService } from '../services/auctionService';
import type { AuctionFilterParams } from '../services/auctionService';
import { useAuthStore } from '../store/authStore';
import type { Auction } from '../types/database.types';
import clsx from 'clsx';

export function Auctions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isGridView, setIsGridView] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState<AuctionFilterParams>({
    categoryId: searchParams.get('category') || undefined,
  });
  
  const [sortBy, setSortBy] = useState<AuctionFilterParams['sortBy']>('newest');
  const [page, setPage] = useState(1);
  const limit = 12;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data, count }, wIds] = await Promise.all([
        auctionService.getAuctions({
          ...filters,
          searchQuery,
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
  }, [filters, searchQuery, sortBy, page, limit, isAuthenticated, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to page 1 on new search
    setSearchParams(searchQuery ? { q: searchQuery } : {});
    loadData();
  };

  const handleFilterChange = (newFilters: Partial<AuctionFilterParams>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to page 1 on new filters
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="bg-slate-900 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-6">Live Auctions Marketplace</h1>
          
          <form onSubmit={handleSearch} className="max-w-3xl relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-24 py-4 border-0 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary sm:text-lg shadow-lg"
              placeholder="Search by title, reference number, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="submit"
              className="absolute right-2 top-2 bottom-2 px-6 bg-primary text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Mobile Filter Toggle */}
          <div className="lg:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <button 
              onClick={() => setIsFiltersOpen(true)}
              className="flex items-center text-slate-700 font-medium"
            >
              <SlidersHorizontal className="w-5 h-5 mr-2" />
              Filters
            </button>
            <div className="text-sm text-slate-500">
              {totalCount} results
            </div>
          </div>

          {/* Sidebar Filters */}
          <div className="lg:w-1/4 shrink-0">
            <AuctionFilters 
              isOpen={isFiltersOpen} 
              onClose={() => setIsFiltersOpen(false)} 
              onFilterChange={handleFilterChange}
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
          <div className="lg:w-3/4 flex-grow flex flex-col">
            
            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="hidden lg:block text-sm text-slate-600 font-medium">
                Showing {auctions.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, totalCount)} of {totalCount} auctions
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    setPage(1);
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

            {/* Auction Grid/List */}
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
                    setSearchQuery('');
                    setFilters({});
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
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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

          </div>
        </div>
      </div>
    </div>
  );
}
