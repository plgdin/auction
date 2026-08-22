import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Copy, Check, Calendar, Landmark, Heart, Clock, Download, FileDown, Eye, Image, Ruler,
  ChevronLeft, ChevronRight, Shield, User, FileText, CreditCard, Scale, Building,
  Compass, MapPin, ExternalLink, Mail, Phone, Tag, DollarSign, AlertCircle, Award,
  FileCode, Layers, Gavel, Radio, TrendingUp, Info, Building2, ShieldCheck, Car, Gauge, Fuel, Wrench
} from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../../lib/supabase';
import type { BaanknetAuction } from '../../services/publicService';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { BidIntelligencePanel } from './BidIntelligencePanel';

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
  const [copiedCersai, setCopiedCersai] = useState(false);
  const [countdownStr, setCountdownStr] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'details' | 'valuation'>('details');

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
      if (e.key === 'Escape' && !viewerState.isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, viewerState.isOpen]);

  // Safe date parser
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

  const isBankOrGeneric = (s?: string) => {
    if (!s) return true;
    const lower = s.toLowerCase().trim();
    return (
      lower === 'india' ||
      lower.includes('bank') ||
      lower.includes('showing') ||
      lower.includes('lender') ||
      lower.includes('result') ||
      lower.includes('filter')
    );
  };
  
  // Extract clean IBC and raw fields if data was concatenated
  const rawTextBlob = `${item.title || ''} ${item.property_description || ''} ${item.raw_description || ''}`;
  const ibcClassMatch = rawTextBlob.match(/Asset\s*Classification\s*:?\s*([A-Za-z0-9\s&,/-]+?)(?=Fixed|Asset|Location|IP|Liquidator|Reserve|EMD|Price|Contact|$)/i);
  const ibcLocMatch = rawTextBlob.match(/(?:Fixed\s*Asset\s*Location|Asset\s*Location|Location)\s*:?\s*([A-Za-z0-9\s&,/-]+?)(?=IP|Liquidator|RP|Reserve|EMD|Price|Contact|Classification|$)/i);
  const ibcIpMatch = rawTextBlob.match(/(?:IP\s*Name|Liquidator\s*Name|Liquidator|RP\s*Name|IP)\s*:?\s*([A-Za-z0-9\s.,-]+?)(?=Contact|Email|Phone|Reserve|EMD|Price|Asset|$)/i);
  const ibcClassification = ibcClassMatch ? ibcClassMatch[1].replace(/Contact\s*Us/i, '').trim() : '';
  const ibcLocation = ibcLocMatch ? ibcLocMatch[1].replace(/Contact\s*Us/i, '').trim() : '';
  const ibcIpName = ibcIpMatch ? ibcIpMatch[1].replace(/Contact\s*Us/i, '').trim() : '';

  // Extract location from title (e.g. "... for sale in East Singhbhum, Jharkhand")
  const titleLocation = useMemo(() => {
    if (!item.title) return { city: '', state: '' };
    const match = item.title.match(/(?:for\s*sale\s*in|in|at)\s+([A-Za-z\s.-]+?),\s*([A-Za-z\s.-]+?)(?:$|\s*\(|\s*-)/i);
    if (match) {
      return { city: match[1].trim(), state: match[2].trim() };
    }
    const singleMatch = item.title.match(/for\s*sale\s*in\s+([A-Za-z\s.-]+)$/i);
    if (singleMatch) {
      const parts = singleMatch[1].split(',').map(s => s.trim());
      return { city: parts[0] || '', state: parts[1] || '' };
    }
    return { city: '', state: '' };
  }, [item.title]);

  const cleanCity = !isBankOrGeneric(item.city) 
    ? item.city! 
    : (titleLocation.city || (ibcLocation.split(',')[1]?.trim() || ''));

  const cleanState = !isBankOrGeneric(item.state) 
    ? item.state! 
    : (titleLocation.state || (!isBankOrGeneric(item.location) ? item.location! : (ibcLocation.split(',')[0]?.trim() || '')));

  const cleanLocationStr = [cleanCity, cleanState].filter(Boolean).join(', ') || ibcLocation || 'India';

  const isVehicle = useMemo(() => {
    const pType = (item.property_type || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    return (
      item.auction_module === 'vehicle' ||
      pType.includes('vehicle') ||
      pType.includes('car') ||
      pType.includes('truck') ||
      pType.includes('bus') ||
      pType.includes('wheeler') ||
      pType.includes('commercial') ||
      title.includes('truck') ||
      title.includes('car') ||
      title.includes('bus') ||
      title.includes('ashok leyland') ||
      title.includes('tata') ||
      title.includes('mahindra') ||
      title.includes('maruti') ||
      title.includes('hyundai')
    );
  }, [item.property_type, item.title, item.auction_module]);

  // Extract vehicle attributes from title & description
  const vehicleSpecs = useMemo(() => {
    if (!isVehicle) return null;
    const year = item.title?.match(/\b(20[0-2]\d|19\d\d)\b/)?.[0] || undefined;
    const regNo = rawTextBlob.match(/\b([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{4})\b/i)?.[0] || undefined;
    const fuel = rawTextBlob.match(/Fuel\s*Type\s*:?\s*(Diesel|Petrol|CNG|Electric|LPG|Hybrid)/i)?.[1] || undefined;
    const odo = rawTextBlob.match(/Odometer\s*:?\s*([\d,.]+\s*(?:km|kms)?)/i)?.[1] || undefined;
    const trans = rawTextBlob.match(/Transmission\s*:?\s*(Manual|Automatic)/i)?.[1] || undefined;
    
    let makeModel = '';
    if (item.title) {
      const cleaned = item.title
        .replace(/^(?:19\d\d|20\d\d)\s*/i, '')
        .replace(/\s*for\s*sale\s*in.*$/i, '')
        .trim();
      if (cleaned) makeModel = cleaned;
    }

    return {
      year,
      makeModel: makeModel || item.property_type,
      regNo,
      fuel,
      odo,
      trans,
    };
  }, [isVehicle, item.title, rawTextBlob, item.property_type]);

  const displayTitle = useMemo(() => {
    if (
      !item.title ||
      /showing\s+\d+/i.test(item.title) ||
      item.title.includes('10000+') ||
      item.title.toLowerCase().includes('results found') ||
      item.title.toLowerCase().includes('search results') ||
      item.title.includes('Asset Classification') ||
      item.title.includes('Asset ID') ||
      item.title.includes('IP Name') ||
      item.title === 'Bank Auction Property' ||
      item.title === 'IBC Auction Asset'
    ) {
      if (ibcClassification) {
        const loc = cleanCity ? ` in ${cleanCity}, ${cleanState}` : (cleanLocationStr && cleanLocationStr !== 'India' ? ` in ${cleanLocationStr}` : '');
        return `${ibcClassification}${loc}`;
      }
      const area = item.carpet_area ? `${item.carpet_area} ` : '';
      const pType = item.property_type && item.property_type !== 'Bank Foreclosure Property' ? item.property_type : 'Bank Foreclosure Property';
      const loc = cleanCity ? ` in ${cleanCity}` : (cleanState ? ` in ${cleanState}` : '');
      return `${area}${pType}${loc}` || 'Bank Foreclosure Asset';
    }
    return item.title;
  }, [item.title, item.carpet_area, item.property_type, cleanCity, cleanState, ibcClassification, cleanLocationStr]);

  const displayAuctionId = useMemo(() => {
    const raw = item.baanknet_auction_id || '';
    const num = raw.match(/\d+/)?.[0];
    return num || raw.replace(/Asset.*$/i, '') || raw;
  }, [item.baanknet_auction_id]);

  const displayPropertyId = useMemo(() => {
    const raw = item.bank_property_id || '';
    const num = raw.match(/\d+/)?.[0];
    return num || raw.replace(/Asset.*$/i, '') || displayAuctionId;
  }, [item.bank_property_id, displayAuctionId]);

  const displayFullAddress = useMemo(() => {
    if (item.full_address && item.full_address.trim().length > 3 && !item.full_address.includes('Asset Classification') && item.full_address.trim().toLowerCase() !== 'india') {
      return item.full_address;
    }
    if (ibcLocation) return ibcLocation;
    if (cleanLocationStr && cleanLocationStr.toLowerCase() !== 'india') return cleanLocationStr;
    return 'Address details not provided. Please refer to the official bank listing portal.';
  }, [item.full_address, ibcLocation, cleanLocationStr]);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(displayFullAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const displayContactPerson = item.contact_person || ibcIpName || undefined;

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
      <div className="relative bg-white rounded-2xl sm:rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 text-left">
        
        {/* Top Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-sm sm:text-base font-bold text-slate-500">Ref: {item.baanknet_auction_id}</span>
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
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-2xs",
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
        <div className="px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => setActiveTab('details')}
              className={clsx(
                "py-2.5 sm:py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer",
                activeTab === 'details'
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              )}
            >
              Catalog Details
            </button>
            <button
              onClick={() => setActiveTab('valuation')}
              className={clsx(
                "py-2.5 sm:py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-1.5",
                activeTab === 'valuation'
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              )}
            >
              <span>Bid Intelligence</span>
              <span className="text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-md tracking-normal uppercase shrink-0">Beta</span>
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        {activeTab === 'valuation' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
            <div className="max-w-4xl mx-auto">
              <BidIntelligencePanel
                itemTitle={displayTitle}
                reservePrice={item.reserve_price_value || 0}
                categoryName={item.property_type || item.category_name}
                location={cleanLocationStr}
                rawDescription={item.property_description || item.raw_description}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row min-h-0">
            
            {/* Left Panel: Auction Information */}
            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5 min-w-0">
              
              {/* Category & Title Header */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {ibcClassification || item.property_type || 'Bank Foreclosure'}
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-600" />
                    Verified Bank Auction
                  </span>
                  {isLive && (
                    <span className="bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live Auction
                    </span>
                  )}
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {displayTitle}
                </h2>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono mt-1.5">
                  <span>Auction ID: {displayAuctionId}</span>
                  {displayPropertyId && <span>Property ID: {displayPropertyId}</span>}
                </div>
              </div>

              {/* 4-Stat Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reserve Price</span>
                  <span className="text-base sm:text-lg font-black text-slate-950 block mt-0.5">{formattedPrice}</span>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">EMD Amount</span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 block mt-0.5 truncate">
                    {item.emd_amount_text || (item.emd_amount_value ? `₹ ${item.emd_amount_value.toLocaleString('en-IN')}` : 'Refer Notice')}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bid Increment</span>
                  <span className="text-xs font-bold text-indigo-700 block mt-0.5 truncate flex items-center gap-1">
                    <Layers className="w-3 h-3 shrink-0" />
                    {item.bid_increment_text || (item.bid_increment_amount ? `₹ ${item.bid_increment_amount.toLocaleString('en-IN')}` : 'As per Bank Terms')}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Title Nature</span>
                  <span className="text-xs font-bold text-emerald-700 block mt-0.5 truncate flex items-center gap-1">
                    <Award className="w-3 h-3 shrink-0" />
                    {item.title_type || 'Bank Verified Asset'}
                  </span>
                </div>
              </div>

              {/* Lending Institution & Branch */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lending Institution / Creditor</span>
                  <span className="text-sm font-bold text-slate-950 block mt-0.5 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-slate-500 shrink-0" />
                    {item.bank_name || 'Foreclosing Bank'}
                  </span>
                </div>
                {item.branch_name && (
                  <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dealing Branch</span>
                    <span className="text-xs font-semibold text-slate-800 flex items-center sm:justify-end gap-1 mt-0.5">
                      <Building className="w-3 h-3 text-slate-400 shrink-0" />
                      {item.branch_name}
                    </span>
                  </div>
                )}
              </div>

              {/* Photo Gallery Carousel */}
              {photos.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="relative bg-slate-950 rounded-xl overflow-hidden h-52 sm:h-64 w-full flex items-center justify-center border border-slate-200 shadow-inner">
                    <img
                      src={photos[activePhotoIdx]}
                      alt={`${item.title} photo ${activePhotoIdx + 1}`}
                      className="w-full h-full object-contain p-1"
                    />
                    
                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={() => setActivePhotoIdx((prev) => (prev === 0 ? photos.length - 1 : prev - 1))}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all cursor-pointer shadow-md"
                          title="Previous photo"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActivePhotoIdx((prev) => (prev === photos.length - 1 ? 0 : prev + 1))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all cursor-pointer shadow-md"
                          title="Next photo"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        
                        <div className="absolute bottom-2.5 right-2.5 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1">
                          <Image className="w-3 h-3" />
                          <span>{activePhotoIdx + 1} / {photos.length}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {photos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {photos.map((url, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`relative shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                            activePhotoIdx === idx ? 'border-primary shadow-xs ring-2 ring-primary/20' : 'border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400 text-xs">
                  <Image className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                  <span>No photographic assets attached to this catalog record.</span>
                </div>
              )}

              {/* Asset Specifications: Vehicle vs Real Estate */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> {isVehicle ? 'Vehicle & Automobile Specifications' : 'Asset & Property Specifications'}
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* Vehicle Specific Cards */}
                  {isVehicle && vehicleSpecs && (
                    <>
                      {vehicleSpecs.makeModel && (
                        <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100 col-span-2">
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Make & Model</span>
                          <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                            <Car className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{vehicleSpecs.makeModel}</span>
                          </span>
                        </div>
                      )}

                      {vehicleSpecs.year && (
                        <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Model / Mfg Year</span>
                          <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            {vehicleSpecs.year}
                          </span>
                        </div>
                      )}

                      {vehicleSpecs.regNo && (
                        <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Registration No.</span>
                          <span className="text-xs font-mono font-bold text-indigo-700 mt-0.5 truncate block">{vehicleSpecs.regNo}</span>
                        </div>
                      )}

                      {vehicleSpecs.fuel && (
                        <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Fuel Type</span>
                          <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                            <Fuel className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            {vehicleSpecs.fuel}
                          </span>
                        </div>
                      )}

                      {vehicleSpecs.odo && (
                        <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Odometer</span>
                          <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                            <Gauge className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            {vehicleSpecs.odo}
                          </span>
                        </div>
                      )}

                      {vehicleSpecs.trans && (
                        <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Transmission</span>
                          <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                            <Wrench className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            {vehicleSpecs.trans}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Real Estate Specific Cards */}
                  {!isVehicle && item.carpet_area && (
                    <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Carpet / Built-up Area</span>
                      <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                        <Ruler className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {item.carpet_area}
                      </span>
                    </div>
                  )}

                  {!isVehicle && item.possession_status && (
                    <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Possession Status</span>
                      <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {item.possession_status}
                      </span>
                    </div>
                  )}

                  {!isVehicle && item.action_type && (
                    <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Legal Action Type</span>
                      <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {item.action_type}
                      </span>
                    </div>
                  )}

                  {!isVehicle && item.furnishing && (
                    <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Furnishing</span>
                      <span className="text-xs font-bold text-slate-900 mt-0.5 truncate">{item.furnishing}</span>
                    </div>
                  )}

                  {/* Clean City & State Cards */}
                  {cleanCity && (
                    <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">District / City</span>
                      <span className="text-xs font-bold text-slate-900 mt-0.5 truncate">{cleanCity}</span>
                    </div>
                  )}

                  {cleanState && (
                    <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">State</span>
                      <span className="text-xs font-bold text-slate-900 mt-0.5 truncate">{cleanState}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verified Location & Full Cadastral Address */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Asset Location & Address
                  </h3>
                  <button
                    onClick={handleCopyAddress}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAddress ? 'Copied' : 'Copy Address'}</span>
                  </button>
                </div>
                
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 sm:p-3.5">
                  <p className="text-xs text-slate-800 leading-relaxed font-mono">
                    {displayFullAddress}
                  </p>
                </div>
              </div>

              {/* Live Bidding & Official Participation Protocol */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white rounded-xl p-4 sm:p-4.5 border border-indigo-900/50 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                      <Gavel className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5">
                        Official Bank e-Auction Participation
                      </h4>
                      <span className="text-[10px] text-slate-300">
                        {isLive ? '🟢 Live bidding room open on bank portal' : 'Scheduled e-Auction under Bank / SARFAESI rules'}
                      </span>
                    </div>
                  </div>

                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                    >
                      Enter Bank Auction Room
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 text-xs">
                  <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                    <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Opening Reserve</span>
                    <span className="font-extrabold text-amber-300 text-xs sm:text-sm mt-0.5 block">{formattedPrice}</span>
                  </div>

                  <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                    <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Min. Increment Step</span>
                    <span className="font-extrabold text-indigo-300 text-xs sm:text-sm mt-0.5 block truncate">
                      {item.bid_increment_text || (item.bid_increment_amount ? `₹ ${item.bid_increment_amount.toLocaleString('en-IN')}` : 'As per Bank Terms')}
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                    <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">EMD Deposit Req.</span>
                    <span className="font-extrabold text-emerald-300 text-xs sm:text-sm mt-0.5 block truncate">
                      {item.emd_amount_text || (item.emd_amount_value ? `₹ ${item.emd_amount_value.toLocaleString('en-IN')}` : '10% of Reserve')}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 mt-2.5 leading-relaxed bg-white/5 p-2.5 rounded-lg border border-white/5">
                  🔒 <strong>Bidding Protocol:</strong> Live bids are placed securely inside the bank's designated e-Auction room. Ensure you have submitted your KYC, EMD deposit, and received approved bidder credentials before bidding closes.
                </p>
              </div>

              {/* Legal Due Diligence, CERSAI & Encumbrances */}
              {(item.cersai_id || item.encumbrances_text || item.title_type) && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-slate-400" /> Legal & Due Diligence Metadata
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {item.cersai_id && (
                      <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">CERSAI Security ID</span>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="font-mono font-bold text-xs text-slate-900 truncate">{item.cersai_id}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.cersai_id || '');
                              setCopiedCersai(true);
                              setTimeout(() => setCopiedCersai(false), 2000);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Copy CERSAI ID"
                          >
                            {copiedCersai ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {item.title_type && (
                      <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Title / Ownership</span>
                        <span className="font-semibold text-xs text-slate-900 block mt-0.5">{item.title_type}</span>
                      </div>
                    )}

                    {item.encumbrances_text && (
                      <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 col-span-1 md:col-span-3">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Known Encumbrances</span>
                        <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{item.encumbrances_text}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Nodal Officer & Dealing Contact */}
              {(displayContactPerson || item.contact_phone || item.officer_email) && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Nodal & Dealing Officer Details
                  </h3>
                  
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 sm:p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {displayContactPerson && (
                      <div>
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Dealing Officer</span>
                        <span className="text-xs font-bold text-slate-900 block mt-0.5 truncate">{displayContactPerson}</span>
                      </div>
                    )}

                    {item.contact_phone && (
                      <div>
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Contact Phone</span>
                        <a href={`tel:${item.contact_phone}`} className="text-xs font-bold text-indigo-600 hover:underline block mt-0.5 truncate">
                          {item.contact_phone}
                        </a>
                      </div>
                    )}

                    {item.officer_email && (
                      <div>
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Officer Email</span>
                        <a href={`mailto:${item.officer_email}`} className="text-xs font-bold text-indigo-600 hover:underline block mt-0.5 truncate">
                          {item.officer_email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Right Panel: Price, Dates & Documents */}
            <div className="w-full lg:w-80 lg:shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 p-4 sm:p-5 space-y-4 sm:space-y-5 bg-slate-50/50">
              
              {/* Price & Schedule Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reserve Price</span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                    {formattedPrice}
                  </div>
                </div>

                {/* Countdown Timer */}
                <div className="bg-slate-900 text-white rounded-lg p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Status</span>
                  </div>
                  <span className="text-xs font-bold text-amber-400 font-mono">{countdownStr}</span>
                </div>

                {/* Auction Dates */}
                <div className="space-y-2 pt-1.5 border-t border-slate-100 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Auction Start:</span>
                    <span className="font-bold text-slate-800">{safeDateStr(item.auction_start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Auction End:</span>
                    <span className="font-bold text-slate-800">{safeDateStr(item.auction_end_date)}</span>
                  </div>
                  {item.emd_end_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">EMD Submission:</span>
                      <span className="font-bold text-amber-700">{safeDateStr(item.emd_end_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Official Bank Document Card */}
              {availableDocs.length > 0 && primaryDoc ? (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                    <span>Official Bank Document</span>
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-1.5 py-0.5 rounded">
                      {availableDocs.length} Docs
                    </span>
                  </h4>

                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 rounded-xl p-4 text-white border border-slate-800 shadow-md flex flex-col justify-between gap-3.5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
                    
                    <div className="flex items-start justify-between gap-2 relative z-10">
                      <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="text-[9.5px] font-black tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Verified PDF
                      </span>
                    </div>

                    <div className="space-y-0.5 relative z-10">
                      <h5 className="text-xs sm:text-sm font-extrabold text-slate-100 line-clamp-2 leading-snug">
                        {primaryDoc.label}
                      </h5>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        Official Bank Foreclosure e-Auction Document
                      </span>
                    </div>

                    {/* Prominent Action Buttons */}
                    <div className="flex flex-col gap-2 pt-1 relative z-10">
                      <button
                        onClick={() => openInAppViewer(primaryDoc.url, `${primaryDoc.label}: ${item.title}`, primaryDoc.safeName)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Preview Document</span>
                      </button>

                      <a
                        href={primaryDoc.downloadUrl}
                        download={primaryDoc.safeName}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all cursor-pointer shadow-xs border border-indigo-400/30"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF Document</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Bank Sale Notice & Tender</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed">
                    Official tender documents, vehicle inspection notes, and EMD guidelines are available directly inside the bank's auction portal.
                  </p>
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer shadow-2xs border border-slate-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                      <span>View on Bank Portal ↗</span>
                    </a>
                  )}
                </div>
              )}

            </div>

          </div>
        )}

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-all cursor-pointer text-center"
          >
            Close Details
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-4 rounded-xl text-xs sm:text-sm font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-xs active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                Bank Portal ↗
              </a>
            )}

            {primaryDoc && (
              <>
                <button
                  onClick={() => openInAppViewer(primaryDoc.url, `${primaryDoc.label}: ${item.title}`, primaryDoc.safeName)}
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-4 rounded-xl text-xs sm:text-sm font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-xs active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  View Catalog
                </button>

                <a
                  href={primaryDoc.downloadUrl}
                  download={primaryDoc.safeName}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-slate-950 hover:bg-primary hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download PDF
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
