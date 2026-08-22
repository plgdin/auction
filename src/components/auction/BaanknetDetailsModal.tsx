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
        
        {/* Top Header Bar */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Ref: {item.baanknet_auction_id}</span>
            <button
              onClick={handleCopyRef}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md cursor-pointer"
              title="Copy Reference Number"
            >
              {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {onInterestedToggle && (
              <button
                onClick={onInterestedToggle}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border",
                  isInterested 
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30" 
                    : "bg-white/10 text-slate-300 border-white/15 hover:bg-white/20"
                )}
              >
                <Heart className={clsx("w-3.5 h-3.5", isInterested && "fill-rose-400 text-rose-400")} />
                <span>{isInterested ? "Interested" : "I'm Interested"}</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                {item.property_type ? `BANK AUCTION | ${item.property_type}` : 'BANK AUCTION'}
              </h4>
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
              
              {/* Reserve Price Card */}
              <div className="md:col-span-5 bg-emerald-50/50 border border-emerald-200/70 rounded-2xl p-4.5 flex flex-col justify-between">
                <div>
                  <span className="text-[10.5px] font-bold text-emerald-700 uppercase tracking-widest block">
                    Reserve Price
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-950 block mt-1">
                    {formattedPrice}
                  </span>
                </div>
                {item.action_type && (
                  <div className="mt-3 pt-2.5 border-t border-emerald-200/50 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                    <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
                  <span className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-indigo-600 shrink-0" />
                    {item.bank_name || 'Foreclosing Bank'}
                  </span>
                </div>

                {item.bank_property_id && (
                  <div className="border-t border-slate-100 pt-2 text-xs text-slate-600 font-mono">
                    <span className="font-semibold text-slate-400 uppercase text-[10px]">Bank Property ID: </span>
                    <span className="font-bold text-slate-800">{item.bank_property_id}</span>
                  </div>
                )}
              </div>

            </div>

            {/* General Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Location & Property Type */}
              <div className="md:col-span-6 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">State / Territory</span>
                  <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">{item.location || 'India'}</span>
                </div>

                {item.city && (
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">City / District</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                      {item.city} {item.pincode ? `(${item.pincode})` : ''}
                    </span>
                  </div>
                )}

                {item.property_type && (
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Asset Category</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">{item.property_type}</span>
                  </div>
                )}
              </div>

              {/* Schedule & Bidding Dates */}
              <div className="md:col-span-6 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Bid Opening Time</span>
                  <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">{safeDateStr(item.auction_start_date)}</span>
                </div>

                <div className="flex flex-col border-t border-slate-100 pt-2">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Bid Closing Time</span>
                  <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">{safeDateStr(item.auction_end_date)}</span>
                </div>

                {item.emd_end_date && (
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">EMD Deadline</span>
                    <span className="text-[13.5px] font-bold text-rose-700 mt-0.5">{safeDateStr(item.emd_end_date)}</span>
                  </div>
                )}

                <div className="flex flex-col border-t border-slate-100 pt-2">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</span>
                  <div>
                    {isClosed ? (
                      <span className="inline-block font-bold text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 bg-slate-50">
                        Bid Closed
                      </span>
                    ) : isLive ? (
                      <span className="inline-block font-bold text-xs px-2.5 py-1 rounded border border-emerald-200 text-emerald-700 bg-emerald-50 animate-pulse">
                        Live Auction
                      </span>
                    ) : (
                      <span className="inline-block font-bold text-xs px-2.5 py-1 rounded border border-blue-200 text-blue-700 bg-blue-50">
                        Upcoming Bidding
                      </span>
                    )}
                  </div>
                </div>
              </div>

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
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
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
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`p-2 rounded-lg ${
                            doc.isStored ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
                          } shrink-0`}
                        >
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate block" title={doc.label}>
                            {doc.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {doc.isStored ? "Permanent Mirror" : "Gateway Proxy"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openInAppViewer(doc.url, `${doc.label}: ${item.title}`, doc.safeName)}
                          className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                          title="Preview in App"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={doc.downloadUrl}
                          download={doc.safeName}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Panel: Side Document / Gallery Preview Sidebar */}
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

            {/* Catalog Document Preview */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                <span>Catalog Document Preview</span>
                {availableDocs.length > 0 && (
                  <span className="text-[9.5px] bg-slate-100 text-slate-700 border border-slate-300 font-bold px-2 py-0.5 rounded">
                    {availableDocs.length} Docs
                  </span>
                )}
              </h4>

              {primaryDoc ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-slate-900 truncate">{primaryDoc.label}</h5>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">PDF Document File</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={() => openInAppViewer(primaryDoc.url, `${primaryDoc.label}: ${item.title}`, primaryDoc.safeName)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-slate-600" />
                      <span>View Full Document</span>
                    </button>
                    <a
                      href={primaryDoc.downloadUrl}
                      download={primaryDoc.safeName}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-primary transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PDF</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-400 gap-2 select-none bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  <FileText className="w-10 h-10 text-slate-300" />
                  <span className="text-xs font-semibold tracking-wide">Notice document processed in database</span>
                </div>
              )}
            </div>

          </div>

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

