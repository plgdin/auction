import React, { useState, useEffect } from 'react';
import {
  X, Copy, Check, Calendar, Landmark, Heart, Clock, FileDown, Eye, Image, Ruler,
  ChevronLeft, ChevronRight, Shield, User, FileText, CreditCard, Scale, Building,
  Compass, MapPin, ExternalLink, Mail, Phone, Tag, DollarSign, AlertCircle, Award,
  FileCode, Layers, Gavel, Radio, TrendingUp
} from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedCersai, setCopiedCersai] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedIfsc, setCopiedIfsc] = useState(false);
  const [copiedCin, setCopiedCin] = useState(false);
  const [countdownStr, setCountdownStr] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

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
          .filter(url => {
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
    return parsed ? parsed.toLocaleString() : 'Not available';
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

  const handleCopyId = () => {
    navigator.clipboard.writeText(item.baanknet_auction_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(displayFullAddress);
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

  // Determine property status
  const now = new Date();
  const start = safeParse(item.auction_start_date);
  const end = safeParse(item.auction_end_date);
  const isLive = start && end ? (now >= start && now <= end) : false;

  // Helper to gather all downloadable PDF document URLs (preferring permanent Supabase Storage mirrors)
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
  const isBank = (s?: string) => !s || s.toLowerCase().includes('bank') || s.toLowerCase().includes('showing') || s.toLowerCase().includes('lender');
  
  // Extract clean IBC and raw fields if data was concatenated
  const rawTextBlob = `${item.title || ''} ${item.property_description || ''} ${item.raw_description || ''}`;
  const ibcClassMatch = rawTextBlob.match(/Asset\s*Classification\s*:?\s*([A-Za-z0-9\s&,/-]+?)(?=Fixed|Asset|Location|IP|Liquidator|Reserve|EMD|Price|Contact|$)/i);
  const ibcLocMatch = rawTextBlob.match(/(?:Fixed\s*Asset\s*Location|Asset\s*Location|Location)\s*:?\s*([A-Za-z0-9\s&,/-]+?)(?=IP|Liquidator|RP|Reserve|EMD|Price|Contact|Classification|$)/i);
  const ibcIpMatch = rawTextBlob.match(/(?:IP\s*Name|Liquidator\s*Name|Liquidator|RP\s*Name|IP)\s*:?\s*([A-Za-z0-9\s.,-]+?)(?=Contact|Email|Phone|Reserve|EMD|Price|Asset|$)/i);
  const ibcClassification = ibcClassMatch ? ibcClassMatch[1].replace(/Contact\s*Us/i, '').trim() : '';
  const ibcLocation = ibcLocMatch ? ibcLocMatch[1].replace(/Contact\s*Us/i, '').trim() : '';
  const ibcIpName = ibcIpMatch ? ibcIpMatch[1].replace(/Contact\s*Us/i, '').trim() : '';

  const cleanCity = !isBank(item.city) ? item.city : (ibcLocation.split(',')[1]?.trim() || '');
  const cleanState = !isBank(item.state) ? item.state : (!isBank(item.location) ? item.location : (ibcLocation.split(',')[0]?.trim() || ''));
  const cleanLocationStr = [cleanCity, cleanState].filter(Boolean).join(', ') || ibcLocation || 'India';

  const displayTitle = React.useMemo(() => {
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

  const displayAuctionId = React.useMemo(() => {
    const raw = item.baanknet_auction_id || '';
    const num = raw.match(/\d+/)?.[0];
    return num || raw.replace(/Asset.*$/i, '') || raw;
  }, [item.baanknet_auction_id]);

  const displayPropertyId = React.useMemo(() => {
    const raw = item.bank_property_id || '';
    const num = raw.match(/\d+/)?.[0];
    return num || raw.replace(/Asset.*$/i, '') || displayAuctionId;
  }, [item.bank_property_id, displayAuctionId]);

  const displayFullAddress = React.useMemo(() => {
    if (item.full_address && item.full_address.trim().length > 3 && !item.full_address.includes('Asset Classification')) {
      return item.full_address;
    }
    if (ibcLocation) return ibcLocation;
    if (cleanLocationStr && cleanLocationStr !== 'India') return cleanLocationStr;
    return 'Address details not provided. Please refer to the official bank listing portal.';
  }, [item.full_address, ibcLocation, cleanLocationStr]);

  const displayContactPerson = item.contact_person || ibcIpName || undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal Backdrop click listener */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-start shrink-0 text-left">
          <div className="space-y-2 max-w-[85%]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                BETA
              </span>
              <span className="bg-primary/20 text-primary-200 border border-primary/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                {ibcClassification || item.property_type || 'Bank Foreclosure'}
              </span>
              {isLive && (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live Auction
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-snug">{displayTitle}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
              <span>Auction ID: {displayAuctionId}</span>
              {displayPropertyId && <span>Property ID: {displayPropertyId}</span>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1 text-left">
          
          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reserve Price</span>
              <span className="text-xl font-black text-slate-950 block mt-1">{formattedPrice}</span>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">EMD Amount</span>
              <span className="text-base font-extrabold text-slate-900 block mt-1">
                {item.emd_amount_text || (item.emd_amount_value ? `₹ ${item.emd_amount_value.toLocaleString('en-IN')}` : 'Refer Notice')}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bid Increment</span>
              <span className="text-sm font-bold text-indigo-700 block mt-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                {item.bid_increment_text || (item.bid_increment_amount ? `₹ ${item.bid_increment_amount.toLocaleString('en-IN')}` : 'As per Bank Terms')}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Title Nature</span>
              <span className="text-sm font-bold text-emerald-700 block mt-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                {item.title_type || 'Bank Verified Asset'}
              </span>
            </div>
          </div>

          {/* Lending Institution & Branch */}
          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lending Institution / Creditor</span>
              <span className="text-base font-bold text-slate-950 block mt-0.5 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-slate-500 shrink-0" />
                {item.bank_name || 'Foreclosing Bank'}
              </span>
            </div>
            {item.branch_name && (
              <div className="md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dealing Branch</span>
                <span className="text-xs font-semibold text-slate-800 flex items-center md:justify-end gap-1 mt-0.5">
                  <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {item.branch_name}
                </span>
              </div>
            )}
          </div>

          {/* Legal Due Diligence, CERSAI & Encumbrances */}
          {(item.cersai_id || item.encumbrances_text || item.title_type) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Scale className="w-4 h-4 text-slate-400" /> Legal & Due Diligence Metadata
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {item.cersai_id && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CERSAI Security Interest ID</span>
                      <span className="text-xs font-mono font-bold text-slate-900 mt-1 block truncate" title={item.cersai_id}>
                        {item.cersai_id}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.cersai_id!);
                        setCopiedCersai(true);
                        setTimeout(() => setCopiedCersai(false), 2000);
                      }}
                      className="mt-2 text-[10px] font-bold text-primary hover:text-primary-700 flex items-center gap-1 cursor-pointer self-start"
                    >
                      {copiedCersai ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedCersai ? 'Copied' : 'Copy CERSAI ID'}
                    </button>
                  </div>
                )}
                {item.title_type && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ownership / Title Type</span>
                    <span className="text-sm font-bold text-slate-900 mt-1 block">{item.title_type}</span>
                  </div>
                )}
                {item.outstanding_dues_text && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Total Outstanding Dues</span>
                    <span className="text-sm font-bold text-rose-950 mt-1 block">{item.outstanding_dues_text}</span>
                  </div>
                )}
              </div>
              {item.encumbrances_text && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-950 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-amber-900">Encumbrance / Statutory Dues Disclosure:</span>
                    <span>{item.encumbrances_text}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EMD Remittance & Payment Details */}
          {(item.emd_account_number || item.emd_account_ifsc || item.tender_fee_text) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" /> EMD Payment & Remittance Instructions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {item.emd_account_number && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nodal Bank Account</span>
                      <span className="text-xs font-mono font-bold text-slate-900 mt-1 block truncate">
                        {item.emd_account_number}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.emd_account_number!);
                        setCopiedAccount(true);
                        setTimeout(() => setCopiedAccount(false), 2000);
                      }}
                      className="mt-2 text-[10px] font-bold text-primary hover:text-primary-700 flex items-center gap-1 cursor-pointer self-start"
                    >
                      {copiedAccount ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedAccount ? 'Copied' : 'Copy A/C No'}
                    </button>
                  </div>
                )}
                {item.emd_account_ifsc && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RTGS/NEFT IFSC Code</span>
                      <span className="text-xs font-mono font-bold text-slate-900 mt-1 block">
                        {item.emd_account_ifsc}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.emd_account_ifsc!);
                        setCopiedIfsc(true);
                        setTimeout(() => setCopiedIfsc(false), 2000);
                      }}
                      className="mt-2 text-[10px] font-bold text-primary hover:text-primary-700 flex items-center gap-1 cursor-pointer self-start"
                    >
                      {copiedIfsc ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedIfsc ? 'Copied' : 'Copy IFSC'}
                    </button>
                  </div>
                )}
                {item.tender_fee_text && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tender Processing Fee</span>
                    <span className="text-sm font-bold text-slate-900 mt-1 block">{item.tender_fee_text}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* IBC / Insolvency Section (if IBC auction) */}
          {/* Corporate Insolvency (IBC / NCLT) Intelligence Section */}
          {(item.action_type === 'IBC' || item.corporate_debtor_name || item.nclt_bench || item.liquidator_reg_no || displayContactPerson) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" /> Corporate Insolvency (IBC / NCLT) Intelligence
              </h3>
              <div className="bg-indigo-50/50 border border-indigo-150 rounded-2xl p-4.5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">Authority & Process</span>
                  <p className="font-bold text-indigo-950 mt-0.5">Insolvency & Bankruptcy Code (IBC 2016)</p>
                </div>
                {displayContactPerson && (
                  <div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">Insolvency Professional / Liquidator</span>
                    <p className="font-bold text-indigo-950 mt-0.5">{displayContactPerson}</p>
                  </div>
                )}
                {item.corporate_debtor_name && (
                  <div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">Corporate Debtor</span>
                    <p className="font-bold text-slate-900 mt-0.5">{item.corporate_debtor_name}</p>
                  </div>
                )}
                {item.corporate_debtor_cin && (
                  <div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">Company CIN</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-slate-900">{item.corporate_debtor_cin}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.corporate_debtor_cin!);
                          setCopiedCin(true);
                          setTimeout(() => setCopiedCin(false), 2000);
                        }}
                        className="text-primary hover:text-primary-700 cursor-pointer p-0.5"
                        title="Copy CIN"
                      >
                        {copiedCin ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                )}
                {item.nclt_bench && (
                  <div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">NCLT Bench & Case</span>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {item.nclt_bench} {item.nclt_case_no ? `(${item.nclt_case_no})` : ''}
                    </p>
                  </div>
                )}
                {item.liquidator_reg_no && (
                  <div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">Liquidator / IP Reg. No</span>
                    <p className="font-mono text-slate-800 mt-0.5">{item.liquidator_reg_no}</p>
                  </div>
                )}
                {item.liquidator_email && (
                  <div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">Liquidator Email</span>
                    <a href={`mailto:${item.liquidator_email}`} className="text-primary hover:underline font-medium mt-0.5 block truncate">
                      {item.liquidator_email}
                    </a>
                  </div>
                )}
                {item.process_memo_url && (
                  <div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">Process Memo / Document</span>
                    <a href={item.process_memo_url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold mt-0.5 block truncate">
                      View Process Document ↗
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Authorized Officer & Bank Contacts */}
          {(displayContactPerson || item.officer_designation || item.officer_email || item.contact_phone) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" /> Authorized Officer & Contact Details
              </h3>
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {displayContactPerson && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Officer / Contact Person</span>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">{displayContactPerson}</p>
                  </div>
                )}
                {(item.officer_designation || (item.action_type === 'IBC' ? 'Insolvency Professional / Liquidator' : undefined)) && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Designation</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">{item.officer_designation || 'Insolvency Professional / Liquidator'}</p>
                  </div>
                )}
                {item.contact_phone && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone / Mobile</span>
                    <a href={`tel:${item.contact_phone}`} className="text-xs font-bold text-primary hover:underline mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-primary shrink-0" />
                      {item.contact_phone}
                    </a>
                  </div>
                )}
                {item.officer_email && (
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Email</span>
                    <a href={`mailto:${item.officer_email}`} className="text-xs font-bold text-primary hover:underline mt-0.5 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-primary shrink-0" />
                      {item.officer_email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Four Boundaries & Map Coordinates */}
          {(item.boundaries || item.latitude || item.map_url) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-slate-400" /> Property Boundaries & Spatial Coordinates
                </h3>
                {(item.map_url || (item.latitude && item.longitude)) && (
                  <a
                    href={item.map_url || `https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-700"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Open in Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {item.boundaries && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {item.boundaries.north && (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">North By</span>
                      <span className="text-xs font-semibold text-slate-900 mt-0.5 block">{item.boundaries.north}</span>
                    </div>
                  )}
                  {item.boundaries.south && (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">South By</span>
                      <span className="text-xs font-semibold text-slate-900 mt-0.5 block">{item.boundaries.south}</span>
                    </div>
                  )}
                  {item.boundaries.east && (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">East By</span>
                      <span className="text-xs font-semibold text-slate-900 mt-0.5 block">{item.boundaries.east}</span>
                    </div>
                  )}
                  {item.boundaries.west && (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">West By</span>
                      <span className="text-xs font-semibold text-slate-900 mt-0.5 block">{item.boundaries.west}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Photo Gallery */}
          {photos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Image className="w-4 h-4 text-slate-400" /> Property Photos ({photos.length})
              </h3>
              <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-video">
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
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setActivePhotoIdx((i) => (i + 1) % photos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 cursor-pointer transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                      {activePhotoIdx + 1} / {photos.length}
                    </div>
                  </>
                )}
              </div>
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePhotoIdx(idx)}
                      className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                        idx === activePhotoIdx ? 'border-primary shadow-md scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Property Physical Details */}
          {(item.carpet_area || item.furnishing || item.possession_status || item.action_type) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-slate-400" /> Property Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {item.carpet_area && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Carpet Area</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{item.carpet_area}</span>
                    {item.carpet_area_sqft && (
                      <span className="text-[10px] text-slate-500">{item.carpet_area_sqft.toLocaleString()} sq ft</span>
                    )}
                  </div>
                )}
                {item.furnishing && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Furnishing</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{item.furnishing}</span>
                  </div>
                )}
                {item.possession_status && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Possession</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{item.possession_status}</span>
                  </div>
                )}
                {item.action_type && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Action Type</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-indigo-500" />
                      {item.action_type}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Borrower & Description */}
          {(item.borrower_name || item.property_description) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" /> Borrower & Description
              </h3>
              {item.borrower_name && (
                <div className="bg-amber-50 border border-amber-150 rounded-xl p-4">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Borrower / Guarantor</span>
                  <span className="text-sm font-bold text-amber-900 mt-0.5 block">{item.borrower_name}</span>
                </div>
              )}
              {item.property_description && (
                <p className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                  {item.property_description}
                </p>
              )}
            </div>
          )}

          {/* Location & Address Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Location & Asset Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">State / Territory</span>
                  <p className="font-semibold text-slate-850 mt-0.5">{cleanState || 'India'}</p>
                </div>
                {cleanCity && (
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">City / District</span>
                    <p className="font-semibold text-slate-850 mt-0.5">{cleanCity} {item.pincode ? `(${item.pincode})` : ''}</p>
                  </div>
                )}
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Address</span>
                  <button
                    onClick={handleCopyAddress}
                    className="text-[10px] font-bold text-primary hover:text-primary-700 flex items-center gap-1 cursor-pointer bg-transparent border-0"
                  >
                    {copiedAddress ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copiedAddress ? 'Copied' : 'Copy Address'}
                  </button>
                </div>
                <p className="bg-slate-50 border border-slate-150 rounded-xl p-4 mt-2 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                  {displayFullAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Official Auction Documents & Notices Section */}
          {availableDocs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" /> Documents & Official Notices ({availableDocs.length})
                </h3>
                {availableDocs.some((d) => d.isStored) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Verified Storage Mirror
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                          {doc.isStored ? "Supabase Storage (High Speed)" : "Live Gateway Proxy"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openInAppViewer(doc.url, `${doc.label}: ${item.title}`, doc.safeName)}
                        className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        title={doc.isStored ? "Preview Cached PDF in App" : "Preview in App"}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={doc.downloadUrl}
                        download={doc.safeName}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          doc.isStored
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
                        }`}
                        title={doc.isStored ? "Fast Download from Supabase Storage" : "Download PDF"}
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bidding Window & Dates */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Bidding Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-150 rounded-xl p-4 flex items-center gap-3 bg-slate-50/50">
                <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="text-xs">
                  <span className="block font-bold text-slate-400 uppercase tracking-wider">Bidding Opens</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {safeDateStr(item.auction_start_date)}
                  </span>
                </div>
              </div>
              
              <div className="border border-slate-150 rounded-xl p-4 flex items-center gap-3 bg-slate-50/50">
                <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="text-xs">
                  <span className="block font-bold text-slate-400 uppercase tracking-wider">Bidding Closes</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {safeDateStr(item.auction_end_date)}
                  </span>
                </div>
              </div>
            </div>

            {/* Inspection & EMD dates (only shown when scraped from detail pages) */}
            {(item.inspection_start_date || item.emd_end_date) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                {item.inspection_start_date && (
                  <div className="border border-emerald-150 rounded-xl p-3 bg-emerald-50/50">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Inspection Start</span>
                    <span className="font-bold text-emerald-900 text-xs mt-0.5 block">
                      {safeDateStr(item.inspection_start_date)}
                    </span>
                  </div>
                )}
                {item.inspection_end_date && (
                  <div className="border border-emerald-150 rounded-xl p-3 bg-emerald-50/50">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Inspection End</span>
                    <span className="font-bold text-emerald-900 text-xs mt-0.5 block">
                      {safeDateStr(item.inspection_end_date)}
                    </span>
                  </div>
                )}
                {item.emd_end_date && (
                  <div className="border border-rose-150 rounded-xl p-3 bg-rose-50/50">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">EMD Deadline</span>
                    <span className="font-bold text-rose-900 text-xs mt-0.5 block">
                      {safeDateStr(item.emd_end_date)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Countdown Banner */}
            <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-4.5 flex items-center justify-between text-indigo-900 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                Bidding Timeline
              </span>
              <span className="font-black text-sm md:text-base tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping shrink-0" />
                {countdownStr}
              </span>
            </div>

            {/* Live Bidding & Official Participation Protocol */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white rounded-2xl p-5 border border-indigo-900/50 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    <Gavel className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                      Official Bank e-Auction Participation
                    </h4>
                    <span className="text-[11px] text-slate-300">
                      {isLive ? '🟢 Live bidding room open on bank portal' : 'Scheduled e-Auction under Bank / SARFAESI rules'}
                    </span>
                  </div>
                </div>

                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    Enter Bank Auction Room
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3.5 text-xs">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Opening Reserve</span>
                  <span className="font-extrabold text-amber-300 text-sm mt-0.5 block">{formattedPrice}</span>
                </div>

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Min. Increment Step</span>
                  <span className="font-extrabold text-indigo-300 text-sm mt-0.5 block">
                    {item.bid_increment_text || (item.bid_increment_amount ? `₹ ${item.bid_increment_amount.toLocaleString('en-IN')}` : 'As per Bank Terms')}
                  </span>
                </div>

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">EMD Deposit Req.</span>
                  <span className="font-extrabold text-emerald-300 text-sm mt-0.5 block">
                    {item.emd_amount_text || (item.emd_amount_value ? `₹ ${item.emd_amount_value.toLocaleString('en-IN')}` : '10% of Reserve')}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-3.5 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                🔒 <strong>Bidding Protocol:</strong> Live bids are placed securely inside the bank's designated e-Auction room. Ensure you have submitted your KYC, EMD deposit, and received approved bidder credentials before bidding closes.
              </p>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-150 flex flex-wrap items-center justify-between gap-4 shrink-0 text-left">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-450" />}
              {copied ? 'Copied ID' : 'Copy Auction ID'}
            </button>
            
            {onInterestedToggle && (
              <button
                onClick={onInterestedToggle}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-rose-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Heart className={`w-3.5 h-3.5 ${isInterested ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                {isInterested ? 'Saved to Watchlist' : 'Save to Watchlist'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                Bank Portal ↗
              </a>
            )}

            {availableDocs.length > 0 ? (
              availableDocs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <button
                    onClick={() => openInAppViewer(doc.url, `${doc.label}: ${item.title}`, doc.safeName)}
                    className="inline-flex items-center gap-1 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                    title={doc.isStored ? "Preview Cached PDF in App" : "Preview in App"}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={doc.downloadUrl}
                    download={doc.safeName}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 ${
                      doc.isStored
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    } rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer`}
                    title={doc.isStored ? "Download Verified PDF (Fast Storage Mirror)" : "Download PDF"}
                  >
                    <FileDown className="w-4 h-4" />
                    {doc.label}
                    {doc.isStored && (
                      <span className="ml-1 text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded font-black tracking-wide">
                        CACHED
                      </span>
                    )}
                  </a>
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-400 font-mono italic">
                Notice document verified & processed in database
              </span>
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
