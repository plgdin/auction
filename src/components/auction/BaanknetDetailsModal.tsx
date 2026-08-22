import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Calendar, Landmark, Heart, Clock, Download, Eye, Image, Ruler, ChevronLeft, ChevronRight, Shield, User, FileText, Info, MapPin, Building2 } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../../lib/supabase';
import type { BaanknetAuction } from '../../services/publicService';
import { DocumentViewerModal } from '../common/DocumentViewerModal';

interface BaanknetDetailsModalProps {
  item: BaanknetAuction;
  onClose: () => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export const BaanknetDetailsModal: React.FC<BaanknetDetailsModalProps> = ({
  item,
  onClose,
  isInterested = false,
  onInterestedToggle,
}) => {
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'details'>('details');
  const [countdownStr, setCountdownStr] = useState<string>('');

  // In-app document viewer state
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
    filename: string;
  }>({
    isOpen: false,
    title: '',
    url: '',
    filename: '',
  });

  const openInAppViewer = (url: string, title: string, filename: string) => {
    setViewerState({
      isOpen: true,
      title,
      url,
      filename,
    });
  };

  // Fetch photos from baanknet_auction_photos table
  useEffect(() => {
    async function fetchPhotos() {
      const { data } = await supabase
        .from('baanknet_auction_photos')
        .select('photo_url')
        .eq('baanknet_auction_id', item.baanknet_auction_id)
        .order('display_order', { ascending: true });
      if (data && data.length > 0) {
        const validPhotos = data
          .map(p => p.photo_url)
          .filter((url): url is string => {
            if (!url) return false;
            const lower = url.toLowerCase();
            return !lower.endsWith('.svg') &&
                   !lower.includes('icon') &&
                   !lower.includes('logo') &&
                   !lower.includes('facebook') &&
                   !lower.includes('twitter') &&
                   !lower.includes('linkedin') &&
                   !lower.includes('instagram') &&
                   !lower.includes('youtube') &&
                   !lower.includes('footer') &&
                   !lower.includes('faq') &&
                   !lower.includes('hassle') &&
                   !lower.includes('banner') &&
                   !lower.includes('ebkray');
          });
        setPhotos(validPhotos);
      } else if (item.thumbnail_url) {
        const lower = item.thumbnail_url.toLowerCase();
        if (!lower.endsWith('.svg') && !lower.includes('icon') && !lower.includes('logo') && !lower.includes('footer')) {
          setPhotos([item.thumbnail_url]);
        }
      }
    }
    fetchPhotos();
  }, [item.baanknet_auction_id, item.thumbnail_url]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Escape key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Safe date parser — never returns Invalid Date
  const safeParse = (d?: string | null): Date | null => {
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const safeDateStr = (d?: string | null): string => {
    const parsed = safeParse(d);
    return parsed ? parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not Available';
  };

  // Live bidding countdown timer
  useEffect(() => {
    const startD = safeParse(item.auction_start_date);
    const endD = safeParse(item.auction_end_date);

    if (!startD && !endD) {
      setCountdownStr('Schedule Pending');
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const startMs = startD ? startD.getTime() : 0;
      const endMs = endD ? endD.getTime() : 0;

      if (endD && now > endMs) {
        setCountdownStr('Auction Closed');
      } else if (startD && endD && now >= startMs && now <= endMs) {
        const diff = endMs - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownStr(`Bidding Ends in: ${hours}h ${mins}m ${secs}s`);
      } else if (startD && now < startMs) {
        const diff = startMs - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdownStr(`Starts in: ${days}d ${hours}h ${mins}m`);
      } else {
        setCountdownStr('Schedule Pending');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [item.auction_start_date, item.auction_end_date]);

  const handleCopyRef = () => {
    navigator.clipboard.writeText(item.baanknet_auction_id);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(item.full_address || `${item.city || ''}, ${item.location || ''}`);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const formattedPrice = item.reserve_price_value
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(item.reserve_price_value)
    : item.reserve_price_text || 'N/A';

  // Determine auction status
  const now = new Date();
  const startD = safeParse(item.auction_start_date);
  const endD = safeParse(item.auction_end_date);
  const isClosed = endD ? now > endD : false;
  const isLive = startD && endD ? (now >= startD && now <= endD) : false;

  // Helper to gather all downloadable PDF document URLs
  interface DocumentEntry {
    url: string;
    isStored: boolean;
    label: string;
    safeName: string;
    downloadUrl: string;
  }

  const getDocLabel = (url: string, index: number): string => {
    const lower = url.toLowerCase();
    if (lower.includes('tender')) return 'Tender Application Form';
    if (lower.includes('annexure') || lower.includes('bid-form') || lower.includes('bidform')) return 'Annexure II / III Bid Form';
    if (lower.includes('possession')) return 'Possession Notice PDF';
    if (lower.includes('process-memo') || lower.includes('memo')) return 'Process Memorandum PDF';
    if (lower.includes('form-g') || lower.includes('form_g')) return 'Form G Notice PDF';
    if (lower.includes('sale-notice') || lower.includes('salenotice') || lower.includes('notice')) return 'Sale Notice PDF';
    if (index === 0) return 'e-Auction Sale Notice';
    return `Document Attachment #${index + 1}`;
  };

  const getAvailableDocuments = (): DocumentEntry[] => {
    const entries: DocumentEntry[] = [];
    const hasStored = Array.isArray(item.stored_document_urls) && item.stored_document_urls.length > 0;

    if (hasStored && item.stored_document_urls) {
      item.stored_document_urls.forEach((storedUrl, idx) => {
        if (storedUrl) {
          const originalRef = (item.document_urls && item.document_urls[idx]) || (idx === 0 ? item.document_url : '') || storedUrl;
          const label = getDocLabel(originalRef, idx);
          const safeName = `Baanknet_${item.baanknet_auction_id}_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
          entries.push({
            url: storedUrl,
            isStored: true,
            label,
            safeName,
            downloadUrl: storedUrl,
          });
        }
      });
      if (entries.length > 0) return entries;
    }

    // Fallback to live URLs via proxy
    const rawList: string[] = [];
    if (item.document_url) rawList.push(item.document_url);
    if (Array.isArray(item.document_urls)) {
      for (const d of item.document_urls) {
        if (d && !rawList.includes(d)) rawList.push(d);
      }
    }

    rawList.forEach((rawUrl, idx) => {
      const label = getDocLabel(rawUrl, idx);
      const safeName = `Baanknet_${item.baanknet_auction_id}_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      const downloadUrl = `/api/document-proxy?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(safeName)}&disposition=attachment`;
      entries.push({
        url: rawUrl,
        isStored: false,
        label,
        safeName,
        downloadUrl,
      });
    });

    return entries;
  };

  const availableDocs = getAvailableDocuments();
  const primaryDoc = availableDocs[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs select-text overflow-hidden">
      
      {/* Modal Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 text-left">
        
        {/* Top Header Bar (White / Light Theme matching MSTC modal) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-slate-500">Ref: {item.baanknet_auction_id}</span>
            <button
              onClick={handleCopyRef}
              className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center"
              title="Copy Reference Number"
            >
              {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {onInterestedToggle && (
              <button
                onClick={onInterestedToggle}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-2xs",
                  isInterested 
                    ? "bg-rose-50 border-rose-200 text-rose-700" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Heart className={clsx("w-3.5 h-3.5", isInterested ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
                <span>{isInterested ? "Interested" : "I'm Interested"}</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('details')}
              className={clsx(
                "py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer",
                activeTab === 'details'
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              )}
            >
              Catalog Details
            </button>
          </div>
        </div>

        {/* Main Content Body (Split Screen) */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
          
          {/* Left Panel: Auction Information */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            
            {/* Category & Title Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                  {item.property_type || 'BANK AUCTION'}
                </span>
                {item.location && (
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-red-500" />
                    {item.location}
                  </span>
                )}
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 leading-tight">
                {item.title}
              </h3>
            </div>

            {/* Official Auction Reference Banner */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-3xs">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Official Auction Reference Number
                </span>
                <span className="text-base font-bold text-slate-800 break-all select-all font-mono">
                  {item.baanknet_auction_id}
                </span>
              </div>
              <button
                onClick={handleCopyRef}
                className={clsx(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all shrink-0 cursor-pointer shadow-3xs",
                  copiedRef
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-primary hover:border-primary/30"
                )}
              >
                {copiedRef ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Reference Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Ref Number</span>
                  </>
                )}
              </button>
            </div>

            {/* Reserve Price Banner & Lending Bank Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Reserve Price Card (Priority Gold/Emerald Highlight) */}
              <div className="md:col-span-5 bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-teal-50 border border-emerald-300/80 rounded-2xl p-4.5 flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[10.5px] font-black text-emerald-800 uppercase tracking-widest block flex items-center gap-1.5">
                    <span>Reserve Price</span>
                    <span className="bg-emerald-200/80 text-emerald-900 text-[9px] px-1.5 py-0.5 rounded font-black">ESTIMATED</span>
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-900 block mt-1 tracking-tight">
                    {formattedPrice}
                  </span>
                </div>
                {item.action_type && (
                  <div className="mt-3 pt-2.5 border-t border-emerald-200/70 flex items-center gap-1.5 text-xs font-bold text-emerald-850">
                    <Shield className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>{item.action_type}</span>
                  </div>
                )}
              </div>

              {/* Lending Bank Details */}
              <div className="md:col-span-7 bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs flex flex-col justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span>Lending Institution</span>
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  </span>
                  <span className="text-base font-black text-indigo-950 mt-1 flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-indigo-600 shrink-0" />
                    {item.bank_name || 'Foreclosing Bank'}
                  </span>
                </div>

                {item.bank_property_id && (
                  <div className="border-t border-slate-100 pt-2 text-xs text-slate-600 font-mono">
                    <span className="font-semibold text-slate-400 uppercase text-[10px]">Bank Property ID: </span>
                    <span className="font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{item.bank_property_id}</span>
                  </div>
                )}
              </div>

            </div>

            {/* General Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Location & Property Type (Priority Blue Accent) */}
              <div className="md:col-span-6 bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Location Details</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">State / Territory</span>
                  <span className="text-[14px] font-extrabold text-slate-900 mt-0.5 flex items-center gap-1">
                    {item.location || 'India'}
                  </span>
                </div>

                {item.city && (
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">City / District</span>
                    <span className="text-[14px] font-extrabold text-blue-900 mt-0.5">
                      {item.city} {item.pincode ? `(${item.pincode})` : ''}
                    </span>
                  </div>
                )}

                {item.property_type && (
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Asset Category</span>
                    <span className="text-[13.5px] font-bold text-indigo-800 mt-0.5">{item.property_type}</span>
                  </div>
                )}
              </div>

              {/* Schedule & Bidding Dates (Priority Dates Highlighted) */}
              <div className="md:col-span-6 bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Bidding Schedule</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Bid Opening Time</span>
                  <span className="text-[13.5px] font-extrabold text-blue-950 mt-0.5">{safeDateStr(item.auction_start_date)}</span>
                </div>

                <div className="flex flex-col border-t border-slate-100 pt-2">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Bid Closing Time</span>
                  <span className="text-[13.5px] font-extrabold text-amber-900 mt-0.5">{safeDateStr(item.auction_end_date)}</span>
                </div>

                {/* Priority Highlight: EMD Deadline */}
                {item.emd_end_date && (
                  <div className="flex flex-col border-t border-rose-100 pt-2 bg-rose-50/70 -mx-4.5 px-4.5 py-2.5 border-l-4 border-l-rose-500 rounded-r-xl">
                    <span className="text-[10.5px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-600" />
                      EMD DEADLINE
                    </span>
                    <span className="text-[14px] font-black text-rose-950 mt-0.5">{safeDateStr(item.emd_end_date)}</span>
                  </div>
                )}

                <div className="flex flex-col border-t border-slate-100 pt-2">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-1">Auction Status</span>
                  <div>
                    {isClosed ? (
                      <span className="inline-block font-black text-xs px-2.5 py-1 rounded-md border border-slate-300 text-slate-600 bg-slate-100">
                        BID CLOSED
                      </span>
                    ) : isLive ? (
                      <span className="inline-block font-black text-xs px-2.5 py-1 rounded-md border border-emerald-300 text-emerald-800 bg-emerald-100 animate-pulse">
                        LIVE AUCTION
                      </span>
                    ) : (
                      <span className="inline-block font-black text-xs px-2.5 py-1 rounded-md border border-blue-300 text-blue-800 bg-blue-100">
                        UPCOMING BIDDING
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Bidding Timeline Countdown Banner */}
            <div className="bg-indigo-50/70 border border-indigo-150 rounded-2xl p-4 flex items-center justify-between text-indigo-950 shadow-3xs">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                Bidding Timeline
              </span>
              <span className="font-black text-sm sm:text-base tracking-wide flex items-center gap-2 text-indigo-900">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping shrink-0" />
                {countdownStr}
              </span>
            </div>

            {/* Borrower & Description Card */}
            {(item.borrower_name || item.property_description) && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Borrower & Description</span>
                </h4>

                {item.borrower_name && (
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                      Borrower / Guarantor
                    </span>
                    <span className="text-sm font-bold text-amber-950 mt-0.5 block">
                      {item.borrower_name}
                    </span>
                  </div>
                )}

                {item.property_description && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                    {item.property_description}
                  </div>
                )}
              </div>
            )}

            {/* Physical Property Specifications */}
            {(item.carpet_area || item.furnishing || item.possession_status || item.full_address) && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>Property Specifications & Location</span>
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {item.carpet_area && (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Carpet Area</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 block">{item.carpet_area}</span>
                      {item.carpet_area_sqft && (
                        <span className="text-[10px] text-slate-500 block">{item.carpet_area_sqft.toLocaleString()} sq ft</span>
                      )}
                    </div>
                  )}

                  {item.furnishing && (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Furnishing</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 block">{item.furnishing}</span>
                    </div>
                  )}

                  {item.possession_status && (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Possession</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 block">{item.possession_status}</span>
                    </div>
                  )}
                </div>

                {item.full_address && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> Full Address
                      </span>
                      <button
                        onClick={handleCopyAddress}
                        className="text-[10px] font-bold text-primary hover:text-primary-700 flex items-center gap-1 cursor-pointer bg-transparent border-0"
                      >
                        {copiedAddress ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copiedAddress ? 'Copied' : 'Copy Address'}
                      </button>
                    </div>
                    <p className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                      {item.full_address}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Official Documents Section */}
            {availableDocs.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Official Auction Documents ({availableDocs.length})</span>
                  </h4>
                  {availableDocs.some((d) => d.isStored) && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      <Check className="w-3 h-3 text-emerald-600" /> Storage Verified
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableDocs.map((doc, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col justify-between gap-3 shadow-3xs hover:border-indigo-300 transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`p-2.5 rounded-xl ${
                            doc.isStored ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-700"
                          } shrink-0 mt-0.5`}
                        >
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 truncate" title={doc.label}>
                            {doc.label}
                          </h5>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            {doc.isStored ? "Permanent Mirror PDF" : "Bank Gateway PDF"}
                          </span>
                        </div>
                      </div>

                      {/* Explicit & Simple Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => openInAppViewer(doc.url, `${doc.label}: ${item.title}`, doc.safeName)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 shadow-3xs transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Preview</span>
                        </button>

                        <a
                          href={doc.downloadUrl}
                          download={doc.safeName}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Panel: Side Document / Gallery Preview Sidebar */}
          {(photos.length > 0 || availableDocs.length > 0) && (
            <div className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 p-5 overflow-visible lg:overflow-y-auto flex flex-col space-y-5">
              
              {/* Property Photos Gallery */}
              {photos.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>Property Photos</span>
                    <span className="text-[9.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded">
                      {photos.length} Photos
                    </span>
                  </h4>
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video border border-slate-200 shadow-2xs">
                    <img
                      src={photos[activePhotoIdx]}
                      alt={`Property photo ${activePhotoIdx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={() => setActivePhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 cursor-pointer transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActivePhotoIdx((i) => (i + 1) % photos.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 cursor-pointer transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md font-mono">
                          {activePhotoIdx + 1} / {photos.length}
                        </div>
                      </>
                    )}
                  </div>
                  {photos.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map((url, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePhotoIdx(idx)}
                          className={clsx(
                            "rounded-lg overflow-hidden border-2 aspect-square cursor-pointer transition-all bg-white",
                            idx === activePhotoIdx ? "border-primary shadow-sm scale-105" : "border-slate-200 opacity-70 hover:opacity-100"
                          )}
                        >
                          <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Catalog Document Action Card without embedded iframe */}
              {availableDocs.length > 0 && primaryDoc && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>Official Bank Document</span>
                    <span className="text-[9.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded">
                      {availableDocs.length} Docs
                    </span>
                  </h4>

                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 rounded-2xl p-5 text-white border border-slate-800 shadow-xl flex flex-col justify-between gap-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="p-3.5 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shrink-0 shadow-inner">
                        <FileText className="w-8 h-8" />
                      </div>
                      <span className="text-[10px] font-black tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shrink-0">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Verified Bank PDF
                      </span>
                    </div>

                    <div className="space-y-1 relative z-10">
                      <h5 className="text-sm sm:text-base font-extrabold text-slate-100 line-clamp-2 leading-snug">
                        {primaryDoc.label}
                      </h5>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        Official Bank Foreclosure e-Auction Document
                      </span>
                    </div>

                    {/* Prominent Action Buttons */}
                    <div className="flex flex-col gap-2.5 pt-2 relative z-10">
                      <button
                        onClick={() => openInAppViewer(primaryDoc.url, `${primaryDoc.label}: ${item.title}`, primaryDoc.safeName)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer shadow-md"
                      >
                        <Eye className="w-4 h-4 text-indigo-600" />
                        <span>Preview Document in Fullscreen</span>
                      </button>

                      <a
                        href={primaryDoc.downloadUrl}
                        download={primaryDoc.safeName}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all cursor-pointer shadow-md border border-indigo-400/30"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Official PDF Document</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-all cursor-pointer text-center"
          >
            Close Details
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {primaryDoc && (
              <>
                <button
                  onClick={() => openInAppViewer(primaryDoc.url, `${primaryDoc.label}: ${item.title}`, primaryDoc.safeName)}
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2.5 px-5 rounded-xl text-sm font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-xs active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Catalog
                </button>

                <a
                  href={primaryDoc.downloadUrl}
                  download={primaryDoc.safeName}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2.5 px-5 rounded-xl text-sm font-bold text-white bg-slate-950 hover:bg-primary hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF Catalog
                </a>
              </>
            )}
          </div>
        </div>

      </div>

      {/* In-App PDF Document Viewer */}
      <DocumentViewerModal
        isOpen={viewerState.isOpen}
        onClose={() => setViewerState((prev) => ({ ...prev, isOpen: false }))}
        title={viewerState.title}
        documentUrl={viewerState.url}
        filename={viewerState.filename}
      />
    </div>
  );
};

