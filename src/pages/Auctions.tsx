// @ts-nocheck
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight, Eye, Download, X, Copy, Check, MapPin, Tag, CornerDownLeft, FileText, Phone, Mail, Sparkles, Gift, Zap } from 'lucide-react';
import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { AuctionCard } from '../components/auction/AuctionCard';
import { MstcCard } from '../components/auction/MstcCard';
import { BaanknetCard } from '../components/auction/BaanknetCard';
import { GemCard } from '../components/auction/GemCard';
import { GemBidCard } from '../components/auction/GemBidCard';
const MstcDetailsModal = lazy(() => import('../components/auction/MstcDetailsModal').then(module => ({ default: module.MstcDetailsModal })));
const BaanknetDetailsModal = lazy(() => import('../components/auction/BaanknetDetailsModal').then(module => ({ default: module.BaanknetDetailsModal })));
const GemDetailsModal = lazy(() => import('../components/auction/GemDetailsModal').then(module => ({ default: module.GemDetailsModal })));
const GemBidDetailsModal = lazy(() => import('../components/auction/GemBidDetailsModal').then(module => ({ default: module.GemBidDetailsModal })));
import { AuctionFilters } from '../components/auction/AuctionFilters';
import { auctionService } from '../services/auctionService';
import type { AuctionFilterParams } from '../services/auctionService';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { dashboardService } from '../services/dashboardService';
import type { Auction } from '../types/database.types';
import { MstcSearchService, expandMstcOffice, BaanknetSearchService, GemSearchService, GemBidSearchService, CommercialSearchService, publicService } from '../services/publicService';
import type { MstcSanitizedAuction, SearchSuggestion, BaanknetAuction, GemAuction, GemBid } from '../services/publicService';
import clsx from 'clsx';
import { generateCatalogSummary, formatDateOrdinal, formatDateTimeOrdinal } from '../utils/mstcHelpers';
import { recommendationService } from '../services/recommendationService';
import { useAuctionAccess } from '../hooks/useAuctionAccess';

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
      <div className="w-full sm:w-64 h-40 bg-slate-100 rounded-lg shrink-0" />
      <div className="flex-grow flex flex-col space-y-4 justify-between">
        <div className="space-y-2">
          <div className="h-3 bg-slate-200 rounded w-1/4" />
          <div className="h-5 bg-slate-200 rounded w-1/2" />
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
  const { user, profile, isAuthenticated } = useAuthStore();
  const isBusinessUser = (isAuthenticated && (profile?.subscription_plan === 'pro' || profile?.subscription_plan === 'enterprise')) || profile?.role === 'admin' || profile?.role === 'superadmin';

  const rawTab = searchParams.get('tab');
  const activeTab = rawTab === 'commercial' ? 'commercial' : rawTab === 'baanknet' ? 'baanknet' : rawTab === 'gem' ? 'gem' : rawTab === 'gem-bids' ? 'gem-bids' : 'mstc';

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // BaankNet eAuction specific states
  const [baanknetAuctions, setBaanknetAuctions] = useState<BaanknetAuction[]>([]);
  const [baanknetTotalCount, setBaanknetTotalCount] = useState(0);
  const [isBaanknetLoading, setIsBaanknetLoading] = useState(false);
  const [selectedPreviewBaanknetItem, setSelectedPreviewBaanknetItem] = useState<BaanknetAuction | null>(null);
  const [baanknetOptions, setBaanknetOptions] = useState<{
    categories: string[];
    locations: string[];
    regionalOffices: string[];
  }>({
    categories: [],
    locations: [],
    regionalOffices: []
  });

  // GeM Portal specific states
  const [gemAuctions, setGemAuctions] = useState<GemAuction[]>([]);
  const [gemTotalCount, setGemTotalCount] = useState(0);
  const [isGemLoading, setIsGemLoading] = useState(false);
  const [selectedPreviewGemItem, setSelectedPreviewGemItem] = useState<GemAuction | null>(null);
  const [gemOptions, setGemOptions] = useState<{
    categories: string[];
    locations: string[];
    regionalOffices: string[];
  }>({
    categories: [],
    locations: [],
    regionalOffices: []
  });

  // GeM Bids specific states
  const [gemBids, setGemBids] = useState<GemBid[]>([]);
  const [gemBidsTotalCount, setGemBidsTotalCount] = useState(0);
  const [isGemBidsLoading, setIsGemBidsLoading] = useState(false);
  const [selectedPreviewGemBid, setSelectedPreviewGemBid] = useState<GemBid | null>(null);
  const [gemBidsOptions, setGemBidsOptions] = useState<{
    categories: string[];
    departments: string[];
  }>({
    categories: [],
    departments: []
  });
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

  const { hasAccess } = useAuctionAccess();

  const accessibleTabs = useMemo(() => {
    const list: { id: string; label: string; beta?: boolean }[] = [];
    if (hasAccess('mstc')) {
      list.push({ id: 'mstc', label: 'MSTC Gov Catalogs' });
    }
    if (hasAccess('baanknet')) {
      list.push({ id: 'baanknet', label: 'BaankNet Bank Auctions', beta: true });
    }
    if (hasAccess('gem_auctions')) {
      list.push({ id: 'gem', label: 'GeM Notice Board', beta: true });
    }
    if (hasAccess('gem_bids') || hasAccess('gem_pbp')) {
      list.push({ id: 'gem-bids', label: 'GeM Procurement Bids', beta: true });
    }
    if (hasAccess('custom')) {
      list.push({ id: 'commercial', label: 'Commercial Auctions', beta: true });
    }
    return list;
  }, [hasAccess]);

  // Guard: if current activeTab is not permitted, silently redirect to 'mstc' (or first accessible tab)
  useEffect(() => {
    const isAllowed = accessibleTabs.some(t => t.id === activeTab);
    if (!isAllowed && accessibleTabs.length > 0) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', accessibleTabs[0].id);
        return next;
      }, { replace: true });
    }
  }, [activeTab, accessibleTabs, setSearchParams]);

  const handleMstcPreview = (item: MstcSanitizedAuction) => {
    setSelectedPreviewItem(item);
  };

  const handleBaanknetPreview = (item: BaanknetAuction) => {
    setSelectedPreviewBaanknetItem(item);
  };

  const handleGemPreview = (item: GemAuction) => {
    setSelectedPreviewGemItem(item);
  };

  const handleGemBidPreview = (item: GemBid) => {
    setSelectedPreviewGemBid(item);
  };

  const { interestedMstcIds, toggleInterestedMstcId } = useAppStore();

  // Scroll trigger for Free MSTC Consultation Popup
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [dontShowConsultationAgain, setDontShowConsultationAgain] = useState(false);
  const hasTriggeredConsultation = useRef(false);

  // Consultation Form State
  const [consultName, setConsultName] = useState('');
  const [consultPhone, setConsultPhone] = useState('');
  const [consultEmail, setConsultEmail] = useState('');
  const [isSubmittingConsultation, setIsSubmittingConsultation] = useState(false);
  const [consultationSuccess, setConsultationSuccess] = useState(false);

  useEffect(() => {
    // Check if user already opted out of consultation modal
    const isDismissed = localStorage.getItem('hide_mstc_consultation_popup') === 'true';
    if (isDismissed) return;

    const handleScroll = () => {
      if (hasTriggeredConsultation.current) return;
      // Allow user to explore initial auction listings before showing consultation prompt (750px)
      if (window.scrollY > 750) {
        hasTriggeredConsultation.current = true;
        setShowConsultationModal(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCloseConsultationModal = () => {
    if (dontShowConsultationAgain) {
      localStorage.setItem('hide_mstc_consultation_popup', 'true');
    }
    setShowConsultationModal(false);
  };

  const handleConsultationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultName.trim() || !consultPhone.trim() || !consultEmail.trim()) return;

    setIsSubmittingConsultation(true);
    try {
      const ok = await publicService.submitContactMessage({
        name: consultName,
        email: consultEmail,
        subject: '[Free MSTC Consultation Request]',
        message: `Requested Free MSTC Consultation.\n\nFull Name: ${consultName}\nPhone: ${consultPhone}\nEmail: ${consultEmail}\nSource: Auctions Page Scroll Popup`,
        status: 'pending'
      });

      if (ok) {
        setConsultationSuccess(true);
        if (dontShowConsultationAgain) {
          localStorage.setItem('hide_mstc_consultation_popup', 'true');
        }
      }
    } catch (err) {
      console.error('Error submitting consultation request:', err);
    } finally {
      setIsSubmittingConsultation(false);
    }
  };

  const handleMstcInterestedToggle = (itemId: string) => {
    toggleInterestedMstcId(user?.id || '', itemId);
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
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-2";
      case 4:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
      case 5:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
      case 3:
      default:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3";
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
  const filterDrawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isFiltersOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element;
      if (!target) return;
      if (
        filterDrawerRef.current?.contains(target as Node) ||
        target.closest('.ant-dropdown') ||
        target.closest('[role="dialog"]') ||
        target.closest('[data-radix-popper-content-wrapper]') ||
        target.closest('.rdp')
      ) {
        return;
      }
      setIsFiltersOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isFiltersOpen]);

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
    const timer = setTimeout(async () => {
      let list: SearchSuggestion[] = [];
      if (activeTab === 'mstc') {
        list = await MstcSearchService.getMstcSearchSuggestions(searchQuery);
      } else if (activeTab === 'baanknet') {
        list = await BaanknetSearchService.getBaanknetSearchSuggestions(searchQuery);
      } else if (activeTab === 'gem') {
        list = await GemSearchService.getGemSearchSuggestions(searchQuery);
      } else if (activeTab === 'gem-bids') {
        list = await GemBidSearchService.getGemBidSearchSuggestions(searchQuery);
      } else if (activeTab === 'commercial') {
        list = await CommercialSearchService.getCommercialSearchSuggestions(searchQuery);
      }
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

      const isReauctionSearch = qParam.toLowerCase().replace(/[^a-z0-9]/g, '').includes('reauction');
      if (!isBusinessUser && (isReauctionSearch || mstcIsReauction)) {
        setMstcAuctions([]);
        setMstcTotalCount(0);
        setIsShowingSimilarMstc(false);
        setIsMstcLoading(false);
        return;
      }

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

      if (qParam.trim() !== '' || selectedMstcCategories.length > 0 || selectedMstcLocations.length > 0 || selectedMstcRegionalOffices.length > 0) {
        import('../services/auditService').then(({ logUserActivity }) => {
          logUserActivity('mstc_catalog_search', 'search', undefined, {
            query: qParam || null,
            filters: {
              categories: selectedMstcCategories,
              subcategories: selectedMstcSubcategories,
              locations: selectedMstcLocations,
              regionalOffices: selectedMstcRegionalOffices,
              page
            }
          });
        }).catch(() => {});
      }

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
    limit,
    isBusinessUser
  ]);

  const loadMstcOptions = useCallback(async () => {
    try {
      const options = await MstcSearchService.getMstcFilterOptions();
      setMstcOptions(options);
    } catch (error) {
      console.error('Error loading MSTC filter options:', error);
    }
  }, []);

  const loadBaanknetData = useCallback(async () => {
    setIsBaanknetLoading(true);
    try {
      const qParam = searchParams.get('q') || '';
      const result = await BaanknetSearchService.searchBaanknetCatalog(qParam, {
        category: selectedMstcCategories[0] || undefined,
        location: selectedMstcLocations[0] || undefined,
        regionalOffice: selectedMstcRegionalOffices[0] || undefined,
        page,
        limit,
        sortBy
      });

      setBaanknetAuctions(result.data);
      setBaanknetTotalCount(result.count);
    } catch (error) {
      console.error('Error loading BaankNet data:', error);
    } finally {
      setIsBaanknetLoading(false);
    }
  }, [
    searchParams,
    selectedMstcCategoriesJoined,
    selectedMstcLocationsJoined,
    selectedMstcRegionalOfficesJoined,
    page,
    limit,
    sortBy
  ]);

  const loadBaanknetOptions = useCallback(async () => {
    try {
      const options = await BaanknetSearchService.getBaanknetFilterOptions();
      setBaanknetOptions(options);
    } catch (error) {
      console.error('Error loading BaankNet filter options:', error);
    }
  }, []);

  const loadGemData = useCallback(async () => {
    setIsGemLoading(true);
    try {
      const qParam = searchParams.get('q') || '';
      const result = await GemSearchService.searchGemCatalog(qParam, {
        category: selectedMstcCategories[0] || undefined,
        location: selectedMstcLocations[0] || undefined,
        regionalOffice: selectedMstcRegionalOffices[0] || undefined,
        page,
        limit,
        sortBy
      });

      setGemAuctions(result.data);
      setGemTotalCount(result.count);
    } catch (error) {
      console.error('Error loading GeM data:', error);
    } finally {
      setIsGemLoading(false);
    }
  }, [
    searchParams,
    selectedMstcCategoriesJoined,
    selectedMstcLocationsJoined,
    selectedMstcRegionalOfficesJoined,
    page,
    limit,
    sortBy
  ]);

  const loadGemOptions = useCallback(async () => {
    try {
      const options = await GemSearchService.getGemFilterOptions();
      setGemOptions(options);
    } catch (error) {
      console.error('Error loading GeM filter options:', error);
    }
  }, []);

  const loadGemBidsData = useCallback(async () => {
    setIsGemBidsLoading(true);
    try {
      const qParam = searchParams.get('q') || '';
      const result = await GemBidSearchService.searchGemBids(qParam, {
        category: selectedMstcCategories[0] || undefined,
        department: selectedMstcRegionalOffices[0] || undefined,
        page,
        limit,
        sortBy
      });

      setGemBids(result.data);
      setGemBidsTotalCount(result.count);
    } catch (error) {
      console.error('Error loading GeM Bids data:', error);
    } finally {
      setIsGemBidsLoading(false);
    }
  }, [
    searchParams,
    selectedMstcCategoriesJoined,
    selectedMstcRegionalOfficesJoined,
    page,
    limit,
    sortBy
  ]);

  const loadGemBidsOptions = useCallback(async () => {
    try {
      const options = await GemBidSearchService.getGemBidFilterOptions();
      setGemBidsOptions({
        categories: options.categories,
        departments: options.departments
      });
    } catch (error) {
      console.error('Error loading GeM Bids filter options:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'commercial' && hasAccess('custom')) {
      loadData();
    }
  }, [activeTab, loadData, hasAccess]);

  useEffect(() => {
    if (activeTab === 'mstc') {
      loadMstcData();
    }
  }, [activeTab, loadMstcData]);

  useEffect(() => {
    if (activeTab === 'baanknet' && hasAccess('baanknet')) {
      loadBaanknetData();
    }
  }, [activeTab, loadBaanknetData, hasAccess]);

  useEffect(() => {
    if (activeTab === 'baanknet' && hasAccess('baanknet')) {
      loadBaanknetOptions();
    }
  }, [activeTab, loadBaanknetOptions, hasAccess]);

  useEffect(() => {
    if (activeTab === 'gem' && hasAccess('gem_auctions')) {
      loadGemData();
    }
  }, [activeTab, loadGemData, hasAccess]);

  useEffect(() => {
    if (activeTab === 'gem' && hasAccess('gem_auctions')) {
      loadGemOptions();
    }
  }, [activeTab, loadGemOptions, hasAccess]);

  useEffect(() => {
    if (activeTab === 'gem-bids' && (hasAccess('gem_bids') || hasAccess('gem_pbp'))) {
      loadGemBidsData();
    }
  }, [activeTab, loadGemBidsData, hasAccess]);

  useEffect(() => {
    if (activeTab === 'gem-bids' && (hasAccess('gem_bids') || hasAccess('gem_pbp'))) {
      loadGemBidsOptions();
    }
  }, [activeTab, loadGemBidsOptions, hasAccess]);
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
    : activeTab === 'baanknet'
      ? Math.ceil(baanknetTotalCount / limit)
      : activeTab === 'gem'
        ? Math.ceil(gemTotalCount / limit)
        : activeTab === 'gem-bids'
          ? Math.ceil(gemBidsTotalCount / limit)
          : Math.ceil(mstcTotalCount / limit);

  const startIndex = (page - 1) * limit;
  const paginatedMstcAuctions = mstcAuctions;

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="relative z-20 bg-slate-900 py-20 md:py-28">
        {/* Background decoration */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-slate-900 mix-blend-multiply" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/20 to-transparent" />
        </div>

        <div className="relative z-30 container mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center justify-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">Auctions Marketplace</h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg mb-8 max-w-2xl font-medium leading-relaxed">
            Browse official government catalogs, bank properties and MSTC eAuctions.
          </p>

          {/* Glassmorphic Tab Switcher - only renders permitted tabs */}
          {accessibleTabs.length > 1 && (
            <div className="flex space-x-2 mb-6 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl w-fit border border-white/15 flex-wrap gap-y-2 justify-center shadow-lg">
              {accessibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSearchParams({ tab: tab.id })}
                  className={clsx(
                    "px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                    activeTab === tab.id
                      ? "bg-white text-slate-900 shadow-md font-bold"
                      : "text-white hover:bg-white/10"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.beta && (
                    <span className={clsx(
                      "px-1.5 py-0.5 text-[9px] font-black uppercase rounded tracking-wider shadow-2xs",
                      activeTab === tab.id
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                    )}>
                      BETA
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSearch} className="max-w-3xl w-full mx-auto relative group" onKeyDown={handleKeyDown}>
            {/* Elegant White Glow Backdrop */}
            <div className="absolute -inset-1 bg-white/70 rounded-3xl blur-md opacity-40 group-hover:opacity-60 group-focus-within:opacity-75 group-focus-within:blur-lg transition-all duration-300 pointer-events-none" />

            <div className="relative z-10 bg-white rounded-2xl shadow-2xl">
              <input
                ref={inputRef}
                type="text"
                className="block w-full pl-6 sm:pl-7 pr-16 sm:pr-28 py-5 border-0 rounded-2xl leading-6 bg-white focus:outline-none text-base sm:text-lg text-slate-900"
                placeholder=""
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => setShowSuggestions(true)}
                autoComplete="off"
              />
              {/* Custom animated placeholder with blinking cursor */}
              {!searchQuery && (
                <div className="absolute inset-y-0 left-6 sm:left-7 right-16 sm:right-28 flex items-center pointer-events-none select-none overflow-hidden z-10">
                  <span className="text-base sm:text-lg text-slate-400 whitespace-nowrap">
                    {activeTab === 'commercial'
                      ? "Search by title, reference number, or keywords..."
                      : activeTab === 'baanknet'
                        ? "Search bank names, property titles, address, locations..."
                        : activeTab === 'gem'
                          ? "Search GeM ministries, organizations, categories, titles..."
                          : activeTab === 'gem-bids'
                            ? "Search GeM bid/RA numbers, departments, items..."
                            : animatedPlaceholder}
                  </span>
                  <span className="inline-block w-0.5 h-6 bg-slate-400 ml-0.5 animate-[blink_1s_step-end_infinite]" />
                </div>
              )}
              <button
                type="submit"
                aria-label="Search Auctions"
                className="absolute right-2.5 top-2.5 bottom-2.5 px-4 sm:px-7 bg-primary hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-md shadow-primary/25 cursor-pointer text-base z-10 flex items-center justify-center"
              >
                <Search className="w-5 h-5 sm:hidden" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>

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
          ref={filterDrawerRef}
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
              customCategories={activeTab === 'baanknet' ? baanknetOptions.categories : activeTab === 'gem' ? gemOptions.categories : activeTab === 'gem-bids' ? gemBidsOptions.categories : mstcOptions.categories}
              customSubcategories={activeTab === 'baanknet' || activeTab === 'gem' || activeTab === 'gem-bids' ? {} : mstcOptions.subcategories}
              customLocations={activeTab === 'baanknet' ? baanknetOptions.locations : activeTab === 'gem' ? gemOptions.locations : []}
              customRegionalOffices={activeTab === 'baanknet' ? baanknetOptions.regionalOffices : activeTab === 'gem' ? gemOptions.regionalOffices : activeTab === 'gem-bids' ? gemBidsOptions.departments : mstcOptions.regionalOffices}
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
              <span className="bg-white text-primary text-[10px] font-black w-5 h-5 rounded-full inline-flex items-center justify-center leading-none text-center shrink-0 mr-1 select-none">
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
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 overflow-hidden">
                <div className="min-w-0 flex-1 space-y-2 max-w-full">
                  <div className="text-sm text-slate-800 font-bold flex items-center">
                    {activeTab === 'baanknet'
                      ? `Showing ${baanknetTotalCount} Bank Auctions`
                      : activeTab === 'gem'
                        ? `Showing ${gemTotalCount} GeM Auctions`
                        : activeTab === 'gem-bids'
                          ? `Showing ${gemBidsTotalCount} GeM Procurement Bids`
                          : `Showing ${mstcTotalCount} Government Catalogs`}
                  </div>
                  {mstcActiveFilters.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5 max-w-full" aria-label="Applied filters">
                      <span className="text-xs font-semibold text-slate-500 shrink-0">Applied filters:</span>
                      {mstcActiveFilters.map(filter => (
                        <span
                          key={`${filter.label}-${filter.value}`}
                          className="inline-flex items-center gap-1 max-w-[260px] rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 shrink-0"
                          title={`${filter.label}: ${filter.value}`}
                        >
                          <span className="font-bold text-slate-900 shrink-0">{filter.label}:</span>{' '}
                          <span className="truncate">{filter.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
                  {/* Desktop Filter Toggle Button */}
                  <button
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className={clsx(
                      "hidden lg:inline-flex items-center gap-2 px-3.5 h-10 text-sm font-semibold rounded-lg border transition-all cursor-pointer shrink-0 whitespace-nowrap",
                      isFiltersOpen
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                    )}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>{isFiltersOpen ? "Hide Filters" : "Show Filters"}</span>
                    {mstcActiveFilters.length > 0 && (
                      <span className={clsx(
                        "text-[10px] font-black w-5 h-5 rounded-full inline-flex items-center justify-center leading-none text-center -mr-1 shrink-0 select-none",
                        isFiltersOpen ? "bg-white text-primary" : "bg-primary text-white"
                      )}>
                        {mstcActiveFilters.length}
                      </span>
                    )}
                  </button>

                  {/* Column Switcher (Hidden on mobile) */}
                  <div className="hidden md:flex items-center h-10 bg-slate-100 rounded-lg p-1 border border-slate-200 shrink-0">
                    {[2, 3, 4, 5].map((cols) => (
                      <button
                        key={cols}
                        onClick={() => {
                          setIsGridView(true);
                          setColumns(cols as any);
                        }}
                        className={clsx(
                          "px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer h-full flex items-center justify-center",
                          isGridView && columns === cols
                            ? "bg-white shadow-sm text-primary"
                            : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        {cols} Col
                      </button>
                    ))}
                  </div>

                  <div className="hidden sm:flex items-center h-10 bg-slate-100 rounded-lg p-1 border border-slate-200 shrink-0">
                    <button
                      onClick={() => setIsGridView(true)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors cursor-pointer h-full flex items-center justify-center",
                        isGridView ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsGridView(false)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors cursor-pointer h-full flex items-center justify-center",
                        !isGridView ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <List className="w-4 h-4" />
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

            {/* BaankNet Bank Auctions Tab */}
            {activeTab === 'baanknet' && (
              <>
                {isBaanknetLoading ? (
                  <SkeletonGrid
                    isGrid={isGridView}
                    count={6}
                    classes={clsx(
                      "gap-6 flex-grow",
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
                    )}
                  />
                ) : baanknetAuctions.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-350 flex-grow text-left">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No BaankNet auctions found</h3>
                    <p className="text-slate-500 mb-6">Try adjusting your search criteria or keywords.</p>
                    <button
                      onClick={() => {
                        setSearchParams({ tab: 'baanknet' });
                      }}
                      className="px-6 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
                    >
                      Clear search & filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={clsx(
                      "gap-6",
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
                    )}>
                      {baanknetAuctions.map(item => (
                        <BaanknetCard
                          key={item.id}
                          item={item}
                          isGrid={isGridView}
                          onPreview={handleBaanknetPreview}
                          isInterested={watchlistIds.includes(item.id)}
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
                              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, baanknetTotalCount)}</span> of <span className="font-medium">{baanknetTotalCount}</span> results
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
                                      key={`dots-baanknet-${i}`}
                                      className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-inset ring-slate-300 focus:outline-none"
                                    >
                                      ...
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={`baanknet-page-${p}`}
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

            {/* GeM Notice Board Tab */}
            {activeTab === 'gem' && (
              <>
                {isGemLoading ? (
                  <SkeletonGrid
                    isGrid={isGridView}
                    count={6}
                    classes={clsx(
                      "gap-6 flex-grow",
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
                    )}
                  />
                ) : gemAuctions.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-350 flex-grow text-left">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No GeM auctions found</h3>
                    <p className="text-slate-500 mb-6">Try adjusting your search criteria or keywords.</p>
                    <button
                      onClick={() => {
                        setSearchParams({ tab: 'gem' });
                      }}
                      className="px-6 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
                    >
                      Clear search & filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={clsx(
                      "gap-6",
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
                    )}>
                      {gemAuctions.map(item => (
                        <GemCard
                          key={item.id}
                          item={item}
                          isGrid={isGridView}
                          onPreview={handleGemPreview}
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
                              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, gemTotalCount)}</span> of <span className="font-medium">{gemTotalCount}</span> results
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
                                      key={`dots-gem-${i}`}
                                      className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-inset ring-slate-300 focus:outline-none"
                                    >
                                      ...
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={`gem-page-${p}`}
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

            {/* GeM Procurement Bids Tab */}
            {activeTab === 'gem-bids' && (
              <>
                {isGemBidsLoading ? (
                  <SkeletonGrid
                    isGrid={isGridView}
                    count={6}
                    classes={clsx(
                      "gap-6 flex-grow",
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
                    )}
                  />
                ) : gemBids.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-350 flex-grow text-left">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No GeM procurement bids found</h3>
                    <p className="text-slate-500 mb-6">Try adjusting your search criteria or keywords.</p>
                    <button
                      onClick={() => {
                        setSearchParams({ tab: 'gem-bids' });
                      }}
                      className="px-6 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
                    >
                      Clear search & filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={clsx(
                      "gap-6",
                      isGridView ? clsx("grid", getGridColsClass(columns)) : "flex flex-col space-y-4"
                    )}>
                      {gemBids.map(item => (
                        <GemBidCard
                          key={item.id}
                          item={item}
                          isGrid={isGridView}
                          onPreview={handleGemBidPreview}
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
                              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, gemBidsTotalCount)}</span> of <span className="font-medium">{gemBidsTotalCount}</span> results
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
                                      key={`dots-gem-bids-${i}`}
                                      className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-inset ring-slate-300 focus:outline-none"
                                    >
                                      ...
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={`gem-bids-page-${p}`}
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
                          onPreview={handleMstcPreview}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs">
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

      {/* Free MSTC Consultation Popup (Offer / Ad Style in Brand Palette) */}
      {showConsultationModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="consultation-modal-title">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200 border border-slate-100">
            
            {/* Top Ribbon Offer Banner */}
            <div className="bg-primary-600 text-white text-[11px] font-bold tracking-wider uppercase py-2 px-4 text-center flex items-center justify-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 fill-white stroke-none" />
              <span>SPECIAL OFFER • 100% FREE CONSULTATION</span>
              <Gift className="w-3.5 h-3.5" />
            </div>

            {/* Header Content */}
            <div className="p-6 pb-2 relative bg-slate-50/70 border-b border-slate-100">
              <button 
                onClick={handleCloseConsultationModal}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-1.5 rounded-full transition-colors cursor-pointer border border-slate-200/80 shadow-xs"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
              
              <h3 id="consultation-modal-title" className="text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                Get Free MSTC Expert Guidance
              </h3>
              
              <p className="text-slate-600 text-xs mt-1.5 leading-relaxed">
                Connect directly with certified MSTC experts. Get 1-on-1 strategy for lot valuations, EMD refunds, and winning bids — <span className="text-primary-700 font-bold">100% Free!</span>
              </p>

              {/* Offer Highlights Grid */}
              <div className="mt-3.5 grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <div className="w-5 h-5 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                    <Zap className="w-3 h-3 fill-primary-600" />
                  </div>
                  <span>Instant Guidance</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>₹0 Consultation Fee</span>
                </div>
              </div>
            </div>

            {/* Modal Form Body */}
            <div className="p-6 pt-4 space-y-4">
              {consultationSuccess ? (
                <div className="text-center py-6 space-y-3 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900">Free Offer Claimed!</h4>
                  <p className="text-xs text-slate-600 max-w-xs mx-auto">
                    Our MSTC specialist will reach out to you at <span className="font-bold text-slate-900">{consultPhone}</span> shortly.
                  </p>
                  <button
                    onClick={handleCloseConsultationModal}
                    className="mt-2 py-2.5 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-primary-600/20"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleConsultationSubmit} className="space-y-3">
                  <div>
                    <label htmlFor="consult_name" className="block text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-1">
                      Full Name *
                    </label>
                    <input
                      id="consult_name"
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={consultName}
                      onChange={(e) => setConsultName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50/50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="consult_phone" className="block text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-1">
                      Phone Number *
                    </label>
                    <input
                      id="consult_phone"
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={consultPhone}
                      onChange={(e) => setConsultPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50/50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="consult_email" className="block text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-1">
                      Email Address *
                    </label>
                    <input
                      id="consult_email"
                      type="email"
                      required
                      placeholder="e.g. rahul@company.com"
                      value={consultEmail}
                      onChange={(e) => setConsultEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50/50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingConsultation}
                    className="w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md shadow-primary-600/20 hover:shadow-primary-600/35 transition-all text-center cursor-pointer uppercase tracking-wide flex items-center justify-center gap-2 mt-2"
                  >
                    <span>{isSubmittingConsultation ? 'Submitting...' : 'Claim Free Consultation Now'}</span>
                    <Sparkles className="w-4 h-4 fill-white stroke-none" />
                  </button>
                </form>
              )}

              {/* Opt-out Custom Checkbox & Close */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={dontShowConsultationAgain}
                  aria-label="Don't show this consultation popup again"
                  onClick={() => setDontShowConsultationAgain(prev => !prev)}
                  className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer select-none group focus:outline-none"
                >
                  <div className={clsx(
                    "w-4 h-4 rounded border transition-colors flex items-center justify-center shrink-0 cursor-pointer",
                    dontShowConsultationAgain 
                      ? "bg-primary-600 border-primary-600 text-white" 
                      : "border-slate-300 bg-white group-hover:border-slate-400"
                  )}>
                    {dontShowConsultationAgain && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="group-hover:text-slate-900 cursor-pointer">Don't show this again</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseConsultationModal}
                  className="text-xs text-slate-400 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BaankNet Details Modal */}
      {selectedPreviewBaanknetItem && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        }>
          <BaanknetDetailsModal
            item={selectedPreviewBaanknetItem}
            onClose={() => setSelectedPreviewBaanknetItem(null)}
          />
        </Suspense>
      )}

      {/* GeM Notice Details Modal */}
      {selectedPreviewGemItem && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-xs">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        }>
          <GemDetailsModal
            item={selectedPreviewGemItem}
            onClose={() => setSelectedPreviewGemItem(null)}
          />
        </Suspense>
      )}

      {/* GeM Bid Details Modal */}
      {selectedPreviewGemBid && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        }>
          <GemBidDetailsModal
            item={selectedPreviewGemBid}
            onClose={() => setSelectedPreviewGemBid(null)}
          />
        </Suspense>
      )}

      {/* Catalog Modals */}
    </div>
  );
}

