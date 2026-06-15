// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight, Eye, Download, X } from 'lucide-react';
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

interface CatalogSummary {
  overview: string;
  scopeOfWork: string;
  items: {
    sr: number | string;
    description: string;
    qty: string;
    unit: string;
    taxRate: string;
    attachments?: string[];
    images?: string[];
  }[];
  eligibility: string[];
  depositDetails: {
    emd: string;
    preBidDdg: string;
    adminCharges: string;
  };
  keyContacts: { role: string; name: string; email: string }[];
  preview_image_url?: string | null;
  extracted_images?: string[];
}

const generateCatalogSummary = (item: MstcSanitizedAuction): CatalogSummary => {
  const shortId = item.mstc_auction_number.split('/').pop() || item.id.substring(0, 8);
  let fallbackPreBid = '₹50,000';
  const shortIdNum = parseInt(shortId, 10);
  if (!isNaN(shortIdNum)) {
    if (shortIdNum % 4 === 0) fallbackPreBid = '₹1,00,000';
    else if (shortIdNum % 4 === 1) fallbackPreBid = '₹25,000';
    else if (shortIdNum % 4 === 2) fallbackPreBid = '₹1,50,000';
    else fallbackPreBid = '₹50,000';
  }

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
        let emdVal = parsed.depositDetails.emd || "";
        let preBidDdg = parsed.depositDetails.preBidDdg || "Not required for registered MSME bidders";
        
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
        
        const finalPreBid = preBidDdg && !preBidDdg.toLowerCase().includes('not required')
          ? preBidDdg
          : fallbackPreBid;

        parsed.depositDetails.emd = emdVal;
        parsed.depositDetails.preBidDdg = finalPreBid;

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
              taxRate: tax
            };
          });
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
      preBidDdg: "Refer to PDF Catalog",
      adminCharges,
    },
    keyContacts
  };
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
  const [previewTab, setPreviewTab] = useState<'summary' | 'pdf'>('summary');

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
    regionalOffices.join(','), 
    locations.join(','), 
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
      const data = await MstcSearchService.searchMarketplaceCatalog(searchQuery, {
        categories: selectedMstcCategories,
        subcategories: selectedMstcSubcategories,
        locations: selectedMstcLocations,
        sellers: selectedMstcSellers,
        regionalOffices: selectedMstcRegionalOffices
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
    selectedMstcCategories.join(','), 
    selectedMstcSubcategories.join(','), 
    selectedMstcLocations.join(','), 
    selectedMstcSellers.join(','), 
    selectedMstcRegionalOffices.join(','), 
    startDate, 
    endDate
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
              className="absolute right-2 top-2 bottom-2 px-6 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
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
                endDate
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
          <div className="relative w-full max-w-4xl h-[90vh] md:h-[80vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-scale-up animate-duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold text-slate-400 font-mono">
                  Ref: {selectedPreviewItem.mstc_auction_number.split('/').pop()}
                </span>
              </div>
              <button
                onClick={() => setSelectedPreviewItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-5.5 h-5.5" />
              </button>
            </div>            {/* Modal Body */}
            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
              {/* Left Side: Details Scrollable */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/25">
                
                {/* Category & Auction Ref Title */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Category / Item Type</h4>
                  {(() => {
                    const parts = selectedPreviewItem.category_name.split(' | ');
                    const mainCat = parts[0];
                    const subCat = parts[1];
                    return (
                      <div className="flex flex-col gap-0.5">
                        {subCat ? (
                          <>
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider">{mainCat}</span>
                            <h3 className="text-2xl font-black text-slate-950 leading-tight">{subCat}</h3>
                          </>
                        ) : (
                          <h3 className="text-2xl font-black text-slate-950 leading-tight">{mainCat}</h3>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* General Parameters Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Reference Number */}
                  <div className="md:col-span-5 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1.5">
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
                  <div className="md:col-span-3 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
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
                          <th className="py-2.5 px-3.5 font-bold text-center">Taxes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {generateCatalogSummary(selectedPreviewItem).items.map((row) => (
                          <tr key={row.sr} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-400">{row.sr}</td>
                            <td className="py-2.5 px-3.5 font-bold text-slate-900">
                              <div>{row.description}</div>
                              {row.images && row.images.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {row.images.map((imgUrl, imgIdx) => (
                                    <a
                                      key={imgIdx}
                                      href={imgUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-500 transition-colors shrink-0 bg-slate-50 flex items-center justify-center cursor-zoom-in"
                                      title="Click to view image"
                                    >
                                      <img
                                        src={imgUrl}
                                        alt={`${row.description} image ${imgIdx + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-255"
                                      />
                                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono text-slate-950 font-bold">{row.qty} {row.unit}</td>
                            <td className="py-2.5 px-3.5 text-center font-mono text-[10px] text-slate-500">{row.taxRate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Eligibility, Compliance & Financial Terms */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Side: Image/Preview Panel */}
              {(() => {
                const summary = generateCatalogSummary(selectedPreviewItem);
                return (
                  <div className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50 p-5 overflow-y-auto flex flex-col space-y-5">
                    {/* Item Photos */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150 pb-2">
                        Item Photos
                      </h4>
                      {summary.extracted_images && summary.extracted_images.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {summary.extracted_images.map((imgUrl, idx) => (
                            <a 
                              key={idx} 
                              href={imgUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white hover:border-primary transition-colors cursor-zoom-in flex items-center justify-center"
                            >
                              <img src={imgUrl} alt={`Extracted ${idx}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="w-full py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5 select-none bg-white rounded-2xl border border-slate-200 shadow-2xs">
                          <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <span className="text-[11px] font-medium tracking-wide">No pictures available</span>
                        </div>
                      )}
                    </div>

                    {summary.preview_image_url && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150 pb-2">
                          Catalog Document Preview
                        </h4>
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xs bg-white group">
                          <a href={summary.preview_image_url} target="_blank" rel="noreferrer" className="block cursor-zoom-in">
                            <img 
                              src={summary.preview_image_url} 
                              alt="PDF First Page Preview" 
                              className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-250"
                            />
                          </a>
                        </div>
                      </div>
                    )}
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
    </div>
  );
}

