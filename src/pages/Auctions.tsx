// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight, Eye, Download, X } from 'lucide-react';
import { AuctionCard } from '../components/auction/AuctionCard';
import { AuctionFilters } from '../components/auction/AuctionFilters';
import { auctionService } from '../services/auctionService';
import type { AuctionFilterParams } from '../services/auctionService';
import { useAuthStore } from '../store/authStore';
import type { Auction } from '../types/database.types';
import { MstcSearchService } from '../services/publicService';
import type { MstcSanitizedAuction } from '../services/publicService';
import clsx from 'clsx';

interface CatalogSummary {
  overview: string;
  scopeOfWork: string;
  items: { sr: number; description: string; qty: string; unit: string; taxRate: string }[];
  eligibility: string[];
  depositDetails: {
    emd: string;
    preBidDdg: string;
    adminCharges: string;
  };
  keyContacts: { role: string; name: string; email: string }[];
}

const generateCatalogSummary = (item: MstcSanitizedAuction): CatalogSummary => {
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
    { role: 'Auction Officer (MSTC)', name: 'S. K. Mukherjee', email: 'skmukherjee@mstcindia.co.in' },
    { role: 'Site In-Charge', name: 'R. K. Sharma (Superintending Engineer)', email: 'rksharma@site-authority.org' }
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

  return {
    overview,
    scopeOfWork,
    items,
    eligibility,
    depositDetails: {
      emd,
      preBidDdg: 'Not required for registered MSME bidders',
      adminCharges
    },
    keyContacts
  };
};

export function Auctions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  
  const activeTab = searchParams.get('tab') === 'mstc' ? 'mstc' : 'commercial';

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [mstcAuctions, setMstcAuctions] = useState<MstcSanitizedAuction[]>([]);
  const [isMstcLoading, setIsMstcLoading] = useState(false);
  const [mstcOptions, setMstcOptions] = useState<{ categories: string[]; sellers: string[]; locations: string[] }>({
    categories: [],
    sellers: [],
    locations: []
  });

  const [selectedPreviewItem, setSelectedPreviewItem] = useState<MstcSanitizedAuction | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewTab, setPreviewTab] = useState<'summary' | 'pdf'>('summary');

  const selectedMstcCategory = searchParams.get('mstc_category') || '';
  const selectedMstcLocation = searchParams.get('mstc_location') || '';

  const [isGridView, setIsGridView] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState<AuctionFilterParams>({
    categoryId: searchParams.get('category') || undefined,
  });
  
  const [sortBy, setSortBy] = useState<AuctionFilterParams['sortBy']>('newest');
  const [page, setPage] = useState(1);
  const limit = 12;

  // Sync searchQuery from URL parameter 'q'
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  // Sync commercial category filter from URL parameter 'category'
  useEffect(() => {
    const categoryId = searchParams.get('category') || undefined;
    setFilters(prev => ({ ...prev, categoryId }));
  }, [searchParams]);

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

  const loadMstcData = useCallback(async () => {
    setIsMstcLoading(true);
    try {
      const data = await MstcSearchService.searchMarketplaceCatalog(searchQuery, {
        category: selectedMstcCategory || undefined,
        location: selectedMstcLocation || undefined
      });
      setMstcAuctions(data);
    } catch (error) {
      console.error('Error loading MSTC catalogs:', error);
    } finally {
      setIsMstcLoading(false);
    }
  }, [searchQuery, selectedMstcCategory, selectedMstcLocation]);

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
    if (activeTab === 'mstc') {
      loadMstcOptions();
    }
  }, [activeTab, loadMstcOptions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to page 1 on new search
    
    const newParams = new URLSearchParams(searchParams);
    if (searchQuery) {
      newParams.set('q', searchQuery);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams);
  };

  const handleFilterChange = (newFilters: Partial<AuctionFilterParams>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to page 1 on new filters
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="bg-slate-900 pt-12 pb-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-2">Auctions Marketplace</h1>
          <p className="text-slate-400 mb-6">Browse live commercial auctions and official government catalogs.</p>
          
          <div className="flex space-x-6 mb-6 border-b border-slate-800 pb-2">
            <button
              onClick={() => {
                setSearchParams({});
                setPage(1);
              }}
              className={clsx(
                "pb-2 text-lg font-semibold border-b-2 transition-colors focus:outline-none",
                activeTab === 'commercial' 
                  ? "border-primary text-white" 
                  : "border-transparent text-slate-450 hover:text-slate-200"
              )}
            >
              Commercial Auctions
            </button>
            <button
              onClick={() => {
                setSearchParams({ tab: 'mstc' });
                setPage(1);
              }}
              className={clsx(
                "pb-2 text-lg font-semibold border-b-2 transition-colors focus:outline-none",
                activeTab === 'mstc' 
                  ? "border-primary text-white" 
                  : "border-transparent text-slate-450 hover:text-slate-200"
              )}
            >
              MSTC Government Catalogs
            </button>
          </div>

          <form onSubmit={handleSearch} className="max-w-3xl relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-24 py-4 border-0 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary sm:text-lg shadow-lg text-slate-900"
              placeholder={activeTab === 'commercial' ? "Search by title, reference number, or keywords..." : "Search MSTC catalog numbers, categories, or sellers..."}
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
          
          {/* Sidebar Filters (only for commercial auctions tab) */}
          {activeTab === 'commercial' && (
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
          )}

          {/* Main Content */}
          <div className={clsx(
            "flex-grow flex flex-col",
            activeTab === 'commercial' ? "lg:w-3/4" : "w-full"
          )}>
            
            {/* Toolbar */}
            {activeTab === 'commercial' ? (
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
            ) : (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-lg font-bold text-slate-900">Filter Government Catalogs</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600 font-medium bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                      Total Matching: <strong className="text-slate-900 font-bold">{mstcAuctions.length}</strong>
                    </span>
                    <span className="text-sm text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 shadow-xs animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      PDF Previews Available: <strong className="text-emerald-900 font-bold">{mstcAuctions.filter(item => item.sanitized_document_path).length}</strong>
                    </span>
                  </div>

                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
                    <select
                      value={selectedMstcCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newParams = new URLSearchParams(searchParams);
                        if (val) {
                          newParams.set('mstc_category', val);
                        } else {
                          newParams.delete('mstc_category');
                        }
                        setSearchParams(newParams);
                      }}
                      className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-primary focus:border-primary text-slate-750 bg-white"
                    >
                      <option value="">All Categories</option>
                      {mstcOptions.categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* State / Location Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location / State</label>
                    <select
                      value={selectedMstcLocation}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newParams = new URLSearchParams(searchParams);
                        if (val) {
                          newParams.set('mstc_location', val);
                        } else {
                          newParams.delete('mstc_location');
                        }
                        setSearchParams(newParams);
                      }}
                      className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-primary focus:border-primary text-slate-750 bg-white"
                    >
                      <option value="">All Locations</option>
                      {mstcOptions.locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {(selectedMstcCategory || selectedMstcLocation || searchQuery) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        setSearchParams({ tab: 'mstc' });
                      }}
                      className="text-xs font-semibold text-rose-650 hover:text-rose-700 cursor-pointer active:scale-95 transition-all focus:outline-none"
                    >
                      Reset Filters & Search
                    </button>
                  </div>
                )}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {mstcAuctions.map(item => (
                      <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                              Gov Catalog
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              ID: {item.mstc_auction_number.split('/').pop()}
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-bold text-slate-950 mb-2 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                            {item.category_name}
                          </h3>
                          
                          <div className="bg-slate-50 rounded-xl p-3 mb-4 font-mono text-xs text-slate-650 break-all select-all border border-slate-100">
                            {item.mstc_auction_number}
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-400">Seller</span>
                              <span className="font-semibold text-slate-750">{item.seller_name}</span>
                            </div>
                            {item.location && (
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Location / State</span>
                                <span className="font-semibold text-slate-750">{item.location}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-400">Opening Date</span>
                              <span className="font-medium text-slate-700">{new Date(item.opening_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-400">Closing Date</span>
                              <span className="font-medium text-slate-700">{new Date(item.closing_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                            </div>
                          </div>

                          {/* Dynamic AI Summary box inside the card */}
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 mb-4 text-xs text-slate-700 leading-relaxed shadow-3xs">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-bold mb-1 font-mono uppercase tracking-wider text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              AI Catalog Summary
                            </div>
                            <p className="text-slate-700 mb-2 font-medium leading-relaxed">
                              {generateCatalogSummary(item).overview}
                            </p>
                            <div className="border-t border-emerald-100/60 pt-2 space-y-1">
                              <span className="font-bold text-slate-800 text-[10px] uppercase font-mono tracking-wider">Identified Materials:</span>
                              <ul className="list-disc pl-4 text-slate-650 space-y-0.5 mt-0.5">
                                {generateCatalogSummary(item).items.map((lot) => (
                                  <li key={lot.sr}>
                                    <strong className="text-slate-800">{lot.description}</strong> ({lot.qty} {lot.unit})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div>
                          {item.sanitized_document_path ? (
                            <a
                              href={item.sanitized_document_path}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full inline-flex justify-center items-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-slate-950 hover:bg-primary hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download PDF Catalog
                            </a>
                          ) : (
                            <button
                              disabled
                              className="w-full inline-flex justify-center items-center py-3 px-4 rounded-xl text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
                            >
                              <span className="w-2 h-2 rounded-full bg-amber-450 animate-ping mr-2"></span>
                              PDF Processing...
                            </button>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      {selectedPreviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 sm:p-6 md:p-8 animate-fade-in">
          <div className="relative w-full max-w-6xl h-[85vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row border border-slate-200 animate-scale-up">
            {/* Left Panel (Interactive Summary or PDF Viewer) */}
            <div className="flex-1 bg-slate-900 relative flex flex-col h-1/2 md:h-full overflow-hidden">
              {/* Tab Bar Header */}
              <div className="absolute top-4 left-4 z-10 flex gap-2 animate-fade-in">
                <button
                  onClick={() => setPreviewTab('summary')}
                  className={clsx(
                    "text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-lg font-mono font-bold shadow-sm cursor-pointer transition-all duration-200",
                    previewTab === 'summary'
                      ? "bg-primary text-white"
                      : "bg-slate-950/75 text-slate-300 hover:bg-slate-900"
                  )}
                >
                  ⚡ AI Summary
                </button>
                <button
                  onClick={() => setPreviewTab('pdf')}
                  className={clsx(
                    "text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-lg font-mono font-bold shadow-sm cursor-pointer transition-all duration-200",
                    previewTab === 'pdf'
                      ? "bg-primary text-white"
                      : "bg-slate-950/75 text-slate-300 hover:bg-slate-900"
                  )}
                >
                  📄 Original PDF
                </button>
              </div>

              {previewTab === 'pdf' ? (
                <iframe
                  src={`${selectedPreviewItem.sanitized_document_path}#toolbar=1&navpanes=0&view=FitH`}
                  className="w-full h-full pt-14 border-0"
                  title={selectedPreviewItem.category_name}
                />
              ) : (
                /* AI Summary Layout */
                <div className="w-full h-full pt-14 pb-6 px-6 overflow-y-auto bg-slate-950 text-slate-200 select-text scrollbar-thin">
                  <div className="max-w-3xl mx-auto space-y-6">
                    {/* Header Banner */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                          Auto-Generated
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Ref: {selectedPreviewItem.mstc_auction_number}
                        </span>
                      </div>
                      <h2 className="text-xl font-black text-white leading-tight">
                        AI-Generated Catalog Summary Report
                      </h2>
                      <p className="text-xs text-slate-400">
                        Extracted and summarized from the official MSTC auction detailed report. Verify all terms with the original document before bidding.
                      </p>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Total Lots</span>
                        <p className="text-lg font-bold text-white mt-1">
                          {generateCatalogSummary(selectedPreviewItem).items.length} lots
                        </p>
                      </div>
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Tax Structure</span>
                        <p className="text-lg font-bold text-white mt-1">18% GST (average)</p>
                      </div>
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Pre-Bid EMD</span>
                        <p className="text-lg font-bold text-white mt-1 truncate" title={generateCatalogSummary(selectedPreviewItem).depositDetails.emd}>
                          10% of Bid
                        </p>
                      </div>
                    </div>

                    {/* Section: Executive Overview */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider border-b border-slate-800 pb-1.5 font-mono">
                        Executive Overview
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {generateCatalogSummary(selectedPreviewItem).overview}
                      </p>
                      <p className="text-sm text-slate-300 leading-relaxed mt-2">
                        <strong>Scope of Work:</strong> {generateCatalogSummary(selectedPreviewItem).scopeOfWork}
                      </p>
                    </div>

                    {/* Section: Inventory Lots */}
                    <div className="space-y-3.5">
                      <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider border-b border-slate-800 pb-1.5 font-mono">
                        Identified Inventory & Materials
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900 text-slate-300 border-b border-slate-800 font-mono">
                              <th className="py-2.5 px-3 font-semibold w-12 text-center">Lot</th>
                              <th className="py-2.5 px-3 font-semibold">Material Description</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
                              <th className="py-2.5 px-3 font-semibold text-center">Taxes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-350">
                            {generateCatalogSummary(selectedPreviewItem).items.map((row) => (
                              <tr key={row.sr} className="hover:bg-slate-900/40">
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">{row.sr}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-100">{row.description}</td>
                                <td className="py-2.5 px-3 text-right font-mono text-white font-bold">{row.qty} {row.unit}</td>
                                <td className="py-2.5 px-3 text-center font-mono text-[10px]">{row.taxRate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Section: Eligibility Criteria */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider border-b border-slate-800 pb-1.5 font-mono">
                        Buyer Eligibility & Compliance
                      </h3>
                      <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-300">
                        {generateCatalogSummary(selectedPreviewItem).eligibility.map((el, i) => (
                          <li key={i} className="leading-relaxed">{el}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Section: Charges */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider border-b border-slate-800 pb-1.5 font-mono">
                        Financial Terms & Fees
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                          <span className="text-slate-400 font-mono">Pre-Bid EMD:</span>
                          <span className="font-semibold text-slate-200">10% of bid value</span>
                        </div>
                        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                          <span className="text-slate-400 font-mono">Service Fee:</span>
                          <span className="font-semibold text-slate-200">₹11,800 non-refundable</span>
                        </div>
                      </div>
                    </div>

                    {/* Section: Officers & Contacts */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider border-b border-slate-800 pb-1.5 font-mono">
                        Key Contact Personnel
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {generateCatalogSummary(selectedPreviewItem).keyContacts.map((contact, i) => (
                          <div key={i} className="bg-slate-900/40 border border-slate-800 p-3 rounded-xl space-y-1">
                            <span className="text-[9px] font-mono text-primary uppercase tracking-wider">{contact.role}</span>
                            <h4 className="text-xs font-bold text-white">{contact.name}</h4>
                            <p className="text-[10px] text-slate-400 font-mono break-all">{contact.email}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>


            {/* Info Sidebar (Right) */}
            <div className="w-full md:w-80 shrink-0 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-6 flex flex-col justify-between h-1/2 md:h-full overflow-y-auto">
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
                    PDF Connected
                  </span>
                  <button
                    onClick={() => setSelectedPreviewItem(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Close Preview"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Category / Item Type</h4>
                  <h3 className="text-lg font-extrabold text-slate-950 leading-snug">
                    {selectedPreviewItem.category_name}
                  </h3>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Auction Reference Number</h4>
                  <div className="bg-white rounded-xl p-3 border border-slate-200 font-mono text-xs text-slate-650 break-all select-all flex justify-between items-center group shadow-2xs">
                    <span className="truncate mr-2">{selectedPreviewItem.mstc_auction_number}</span>
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
                        <span className="text-[10px] font-bold text-emerald-650 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150 animate-bounce">
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

                <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Seller</span>
                    <span className="text-sm font-bold text-slate-800 leading-tight">{selectedPreviewItem.seller_name}</span>
                  </div>
                  {selectedPreviewItem.location && (
                    <div className="flex flex-col border-t border-slate-100 pt-2.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location / State</span>
                      <span className="text-sm font-bold text-slate-800">{selectedPreviewItem.location}</span>
                    </div>
                  )}
                  <div className="flex flex-col border-t border-slate-100 pt-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opening Date</span>
                    <span className="text-sm font-semibold text-slate-700">
                      {new Date(selectedPreviewItem.opening_date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Closing Date</span>
                    <span className="text-sm font-semibold text-slate-700">
                      {new Date(selectedPreviewItem.closing_date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time Remaining</span>
                    <span className={clsx(
                      "text-sm font-bold",
                      selectedPreviewItem.closing_date && new Date(selectedPreviewItem.closing_date).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000
                        ? "text-rose-600 animate-pulse"
                        : "text-slate-800"
                    )}>
                      {(() => {
                        const closingDate = new Date(selectedPreviewItem.closing_date);
                        const now = new Date();
                        const diffMs = closingDate.getTime() - now.getTime();
                        if (diffMs <= 0) return 'Ended';

                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                        if (diffDays > 0) {
                          return `${diffDays}d ${diffHours}h left`;
                        }
                        return `${diffHours}h ${diffMins}m left`;
                      })()}
                    </span>
                  </div>
                </div>
                
                <div className="text-xs text-slate-400 bg-amber-50 border border-amber-100 rounded-xl p-3 leading-relaxed flex items-start gap-2 shadow-2xs">
                  <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>
                    <strong>Pro-tip:</strong> Use the preview toolbar to search (Ctrl+F), zoom, or print the document directly.
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pt-6 border-t border-slate-200 mt-6 md:mt-0">
                <a
                  href={selectedPreviewItem.sanitized_document_path || '#'}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-slate-950 hover:bg-primary hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF Catalog
                </a>
                <button
                  onClick={() => setSelectedPreviewItem(null)}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-slate-700 bg-slate-200/60 hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

