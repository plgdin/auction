// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight, Eye, Download, X, Copy, Check, Heart } from 'lucide-react';
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

export const getEstimatedMarketPrice = (description: string, categoryName: string = ''): string => {
  const desc = (description || '').toLowerCase();
  const cat = (categoryName || '').toLowerCase();

  if (desc.includes('copper') || cat.includes('copper')) {
    return '₹780 / kg';
  }
  if (desc.includes('aluminum') || desc.includes('aluminium') || cat.includes('aluminum') || cat.includes('aluminium')) {
    return '₹235 / kg';
  }
  if (desc.includes('battery') || desc.includes('batteries') || cat.includes('battery') || cat.includes('batteries')) {
    return '₹120 / kg';
  }
  if (desc.includes('lead') || cat.includes('lead')) {
    return '₹185 / kg';
  }
  if (desc.includes('brass') || cat.includes('brass')) {
    return '₹480 / kg';
  }
  if (desc.includes('zinc') || cat.includes('zinc')) {
    return '₹220 / kg';
  }
  if (desc.includes('iron') || desc.includes('steel') || desc.includes('ferrous') || cat.includes('iron') || cat.includes('steel') || cat.includes('ferrous')) {
    return '₹38,500 / Ton';
  }
  if (desc.includes('oil') || desc.includes('lubricating') || desc.includes('petroleum') || cat.includes('oil') || cat.includes('petroleum')) {
    return '₹85 / Liter';
  }
  if (desc.includes('wheat') || cat.includes('wheat')) {
    return '₹2,450 / Quintal';
  }
  if (desc.includes('rice') || desc.includes('paddy') || cat.includes('rice') || cat.includes('paddy')) {
    return '₹2,200 / Quintal';
  }
  if (desc.includes('coal') || desc.includes('lignite') || cat.includes('coal') || cat.includes('lignite')) {
    return '₹8,400 / Ton';
  }
  if (desc.includes('sand') || desc.includes('mine') || desc.includes('stone') || desc.includes('block') || cat.includes('sand') || cat.includes('mine') || cat.includes('stone') || cat.includes('block')) {
    return '₹4,500 / Ton';
  }
  if (desc.includes('cable') || desc.includes('wire') || cat.includes('cable') || cat.includes('wire')) {
    return '₹340 / kg';
  }
  if (desc.includes('computer') || desc.includes('laptop') || desc.includes('it equipment') || cat.includes('computer') || cat.includes('laptop')) {
    return '₹14,500 / Unit';
  }
  if (desc.includes('vehicle') || desc.includes('car') || desc.includes('bus') || desc.includes('truck') || cat.includes('vehicle') || cat.includes('car')) {
    return '₹3,50,000 / Unit';
  }
  return '₹2,500 / Ton';
};

const getNumericQty = (qtyStr: string, unitStr: string = ''): number => {
  const clean = (qtyStr || '').replace(/,/g, '').trim();
  let num = parseFloat(clean);
  if (isNaN(num)) num = 1;
  const unitUpper = (unitStr || '').toUpperCase().trim();
  if (unitUpper === 'MT' || unitUpper === 'M.T.' || unitUpper === 'M.T') {
    return num * 1000000;
  }
  return num;
};

const getNumericPrice = (priceStr: string): number => {
  const clean = (priceStr || '').replace(/[^\d]/g, '');
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
};

interface CatalogSummary {
  overview: string;
  scopeOfWork: string;
  items: { sr: number; description: string; qty: string; unit: string; taxRate: string; marketPrice: string }[];
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
        let emdVal = parsed.depositDetails.emd || '';
        let preBidDdg = parsed.depositDetails.preBidDdg;

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
              taxRate: tax,
              marketPrice: getEstimatedMarketPrice(desc, item.category_name)
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
      preBidDdg: fallbackPreBid,
      adminCharges
    },
    keyContacts
  };
};

export function Auctions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const activeTab = searchParams.get('tab') === 'commercial' ? 'commercial' : 'mstc';

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

  const [isGridView, setIsGridView] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Sync searchQuery local input state with query params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setInterestedMstcIds(dashboardService.getInterestedAuctions(user.id));
    } else {
      setInterestedMstcIds([]);
    }
  }, [isAuthenticated, user]);

  const handleMstcInterestedToggle = (itemId: string) => {
    if (!isAuthenticated || !user) {
      navigate('/auth/login', { state: { from: `/auctions?tab=mstc` } });
      return;
    }
    dashboardService.toggleInterestedAuction(user.id, itemId);
    setInterestedMstcIds(dashboardService.getInterestedAuctions(user.id));
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

