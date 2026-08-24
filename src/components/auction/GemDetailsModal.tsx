import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, Landmark, Download, MapPin, AlignLeft, Info, Eye, Heart, Calendar, FileText, Phone, UserCheck, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import type { GemAuction } from '../../services/publicService';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { getGemItemImage } from '../../utils/gemImageResolver';
import { cleanCategoryName } from '../../utils/cleanCategory';
import { parseGemNoticeContent } from '../../utils/gemDocumentParser';
import type { GemExtractedData } from '../../utils/gemDocumentParser';
import { BidIntelligencePanel } from './BidIntelligencePanel';

interface GemDetailsModalProps {
  item: GemAuction;
  onClose: () => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export const GemDetailsModal: React.FC<GemDetailsModalProps> = ({
  item,
  onClose,
  isInterested = false,
  onInterestedToggle,
}) => {
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [countdownStr, setCountdownStr] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'details' | 'valuation'>('details');

  // In-app document preview state
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
    return parsed ? parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'As per Notice';
  };

  // Helper to extract clean description without scraped website noise
  const cleanDescription = useMemo(() => {
    if (!item.raw_description) return null;
    
    let text = item.raw_description;

    text = text
      .replace(/^\d+\)\s*Auction ID\s*:\s*\d+/gi, '')
      .replace(/Auction ID\s*:\s*\d+/gi, '')
      .replace(/Start Date\s*:\s*\d{2}\/\d{2}\/\d{4}[^\n]*/gi, '')
      .replace(/End Date\s*:\s*\d{2}\/\d{2}\/\d{4}[^\n]*/gi, '')
      .replace(/View More/gi, '')
      .replace(/Event Notice/gi, '')
      .replace(/Document/gi, '')
      .replace(/\s*-\s*/g, ' - ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!text || text.toLowerCase() === item.title.toLowerCase().trim()) {
      return null;
    }

    return text;
  }, [item.raw_description, item.title]);

  // Helper to extract clean location details if missing
  const locationDetails = useMemo(() => {
    const city = item.city || '';
    const state = item.state || (item.location !== 'India' ? item.location : '');
    const pin = item.pincode || '';

    let extractedPin = pin;
    if (!extractedPin && item.raw_description) {
      const pinMatch = item.raw_description.match(/\b\d{6}\b/);
      if (pinMatch) extractedPin = pinMatch[0];
    }

    const parts = [city, state].filter(Boolean);
    const locationStr = parts.join(', ') + (extractedPin ? ` - ${extractedPin}` : '');

    return {
      displayStr: locationStr || item.location || 'India',
      city: city || 'Not Specified',
      state: state || item.location || 'India',
      pincode: extractedPin || null,
      fullAddress: item.full_address || null
    };
  }, [item]);

  // Live Document Extracted Content State
  const [docExtraDetails, setDocExtraDetails] = useState<GemExtractedData>({
    officers: [],
  });

  // Asynchronously parse document HTML when document_url is present
  useEffect(() => {
    if (!item.document_url) return;
    let isMounted = true;

    async function fetchAndParseDoc() {
      try {
        const proxyUrl = `/api/document-proxy?url=${encodeURIComponent(item.document_url!)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) return;
        const html = await res.text();
        if (!isMounted || !html) return;

        // Parse HTML to plain text
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const docText = doc.body.textContent || '';

        const parsed = parseGemNoticeContent(docText, item.title);
        setDocExtraDetails(parsed);
      } catch {
        // Fallback gracefully to item-level parsing
      }
    }

    fetchAndParseDoc();
    return () => {
      isMounted = false;
    };
  }, [item.document_url, item.title]);

  // Combined item-level and doc-level extraction
  const parsedItemDetails = useMemo(() => {
    const rawParsed = parseGemNoticeContent(item.raw_description || '', item.title);

    // Merge doc-level details if present
    return {
      sellerAuctioneerName: docExtraDetails.sellerAuctioneerName || rawParsed.sellerAuctioneerName,
      sellerRole: docExtraDetails.sellerRole || rawParsed.sellerRole,
      ministry: item.ministry || docExtraDetails.ministry || rawParsed.ministry,
      organisation: item.organisation || docExtraDetails.organisation || rawParsed.organisation,
      department: item.department || docExtraDetails.department || rawParsed.department,
      division: docExtraDetails.division || rawParsed.division,
      referenceNo: docExtraDetails.referenceNo || rawParsed.referenceNo,
      emdAmount: docExtraDetails.emdAmount || rawParsed.emdAmount,
      quantityStr: docExtraDetails.quantityStr || rawParsed.quantityStr,
      officers: [
        ...(docExtraDetails.officers || []),
        ...(rawParsed.officers || []),
      ].filter((v, i, a) => a.findIndex((t) => t.name === v.name && t.phone === v.phone) === i),
    };
  }, [item, docExtraDetails]);

  const contactDetails = parsedItemDetails.officers;

  // Helper to structure Ministry / Department / Organisation
  const authorityDetails = useMemo(() => {
    return {
      organisation: parsedItemDetails.organisation || parsedItemDetails.department || parsedItemDetails.ministry || 'Government Authority / PSU',
      ministry: parsedItemDetails.ministry,
      department: parsedItemDetails.department,
      division: parsedItemDetails.division,
      sellerAuctioneerName: parsedItemDetails.sellerAuctioneerName,
      sellerRole: parsedItemDetails.sellerRole,
      referenceNo: parsedItemDetails.referenceNo,
    };
  }, [parsedItemDetails]);

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
    navigator.clipboard.writeText(item.gem_auction_id);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleCopyAddress = () => {
    const addr = locationDetails.fullAddress || locationDetails.displayStr;
    navigator.clipboard.writeText(addr);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleCopyPhone = (ph: string) => {
    navigator.clipboard.writeText(ph);
    setCopiedPhone(ph);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const formattedPrice = item.reserve_price_value
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(item.reserve_price_value)
    : item.reserve_price_text || 'Refer to Notice Document';

  const now = new Date();
  const startD = safeParse(item.auction_start_date);
  const endD = safeParse(item.auction_end_date);
  const isClosed = endD ? now > endD : false;
  const isLive = startD && endD ? (now >= startD && now <= endD) : false;

  const targetDocUrl =
    item.document_url ||
    `https://forwardauction.gem.gov.in/eprocure/eauction-download-document/${encodeURIComponent(item.gem_auction_id)}`;
  const defaultFilename = `GeM_Auction_${item.gem_auction_id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const proxyDownloadUrl = `/api/document-proxy?url=${encodeURIComponent(targetDocUrl)}&filename=${encodeURIComponent(defaultFilename)}&disposition=attachment`;

  const openInAppViewer = (url: string, title: string, filename: string) => {
    setViewerState({
      isOpen: true,
      title,
      url,
      filename,
    });
  };

  // Documents collection
  interface DocumentEntry {
    url: string;
    label: string;
    safeName: string;
    downloadUrl: string;
  }

  const getAvailableDocuments = (): DocumentEntry[] => {
    const entries: DocumentEntry[] = [];
    if (targetDocUrl) {
      entries.push({
        url: targetDocUrl,
        label: 'e-Auction Notice PDF',
        safeName: defaultFilename,
        downloadUrl: proxyDownloadUrl,
      });
    }

    if (Array.isArray(item.document_urls)) {
      item.document_urls.forEach((url, idx) => {
        if (url && url !== targetDocUrl && url !== item.source_url) {
          const safeName = `GeM_${item.gem_auction_id}_Attachment_${idx + 1}.pdf`;
          const downloadUrl = `/api/document-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeName)}&disposition=attachment`;
          entries.push({
            url,
            label: `Notice Attachment #${idx + 1}`,
            safeName,
            downloadUrl,
          });
        }
      });
    }
    return entries;
  };

  const availableDocs = getAvailableDocuments();
  const primaryDoc = availableDocs[0];
  const itemImage = getGemItemImage(item.title, item.category_name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs select-text overflow-hidden">
      
      {/* Modal Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 text-left">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-slate-500">Ref: {item.gem_auction_id}</span>
            <button
              onClick={handleCopyRef}
              className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center"
              title="Copy Reference ID"
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
            <button
              onClick={() => setActiveTab('valuation')}
              className={clsx(
                "py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2",
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
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <div className="max-w-5xl mx-auto">
              <BidIntelligencePanel
                itemTitle={item.title}
                reservePrice={0}
                categoryName={item.category_name}
                location={locationDetails.displayStr}
                rawDescription={item.raw_description || item.title}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
          
          {/* Left Panel: Clean Information */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            
            {/* Category & Title Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                  GeM NOTICE BOARD
                </span>
                {item.category_name && (
                  <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    {cleanCategoryName(item.category_name, item.title)}
                  </span>
                )}
                {locationDetails.displayStr && (
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-red-500" />
                    {locationDetails.displayStr}
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
                  Official GeM Auction Reference Number {authorityDetails.referenceNo ? `• ${authorityDetails.referenceNo}` : ''}
                </span>
                <span className="text-base font-bold text-slate-800 break-all select-all font-mono">
                  {item.gem_auction_id}
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

            {/* Price & Auctioneer Authority Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Reserve Price Card */}
              <div className="md:col-span-5 bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-teal-50 border border-emerald-300/80 rounded-2xl p-4.5 flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[10.5px] font-black text-emerald-800 uppercase tracking-widest block">
                    Starting / Reserve Price
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-900 block mt-1 tracking-tight">
                    {formattedPrice}
                  </span>
                </div>
              </div>

              {/* Auctioneer & Issuing Authority Overview */}
              <div className="md:col-span-7 bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs flex flex-col justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span>Auctioneer & Issuing Authority</span>
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  </span>
                  <span className="text-base font-black text-indigo-950 mt-1 flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-indigo-600 shrink-0" />
                    {authorityDetails.organisation}
                  </span>
                  {authorityDetails.sellerAuctioneerName && (
                    <span className="text-xs font-bold text-slate-600 mt-1 flex items-center gap-1.5">
                      <span>Seller / Auctioneer:</span>
                      <strong className="text-slate-900 font-extrabold">{authorityDetails.sellerAuctioneerName}</strong>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {authorityDetails.sellerRole || 'Auctioneer'}
                      </span>
                    </span>
                  )}
                </div>

                {(authorityDetails.ministry || authorityDetails.department || authorityDetails.division) && (
                  <div className="border-t border-slate-100 pt-2 text-xs text-slate-600 flex flex-wrap gap-2">
                    {authorityDetails.ministry && (
                      <span className="font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                        {authorityDetails.ministry}
                      </span>
                    )}
                    {authorityDetails.department && (
                      <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {authorityDetails.department}
                      </span>
                    )}
                    {authorityDetails.division && (
                      <span className="font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                        {authorityDetails.division}
                      </span>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Auctioneer Contact Officers & Nodal Helpline Info */}
            {contactDetails.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50/90 via-amber-50/60 to-orange-50/70 rounded-2xl p-5 border border-amber-200/80 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-amber-200/70 pb-2.5">
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4.5 h-4.5 text-amber-700 shrink-0" />
                    <span>Auctioneer Contact Officers & Helpline</span>
                  </span>
                  <span className="text-[10px] bg-amber-200 text-amber-950 font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    DIRECT CONTACT
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {contactDetails.map((contact, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl p-3.5 border border-amber-200/80 flex flex-col justify-between gap-3 shadow-3xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {contact.name}
                          </span>
                          <span className="text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase shrink-0">
                            {contact.role || 'Officer'}
                          </span>
                        </div>
                        {contact.phone && (
                          <span className="text-sm font-mono font-black text-amber-950 block mt-1">
                            {contact.phone}
                          </span>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-xs font-medium text-primary hover:underline block truncate mt-0.5"
                          >
                            {contact.email}
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-auto">
                        {contact.phone && (
                          <>
                            <a
                              href={`tel:${contact.phone.replace(/[\s-]/g, '')}`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-3xs"
                              title="Call Officer Directly"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call Officer</span>
                            </a>
                            <button
                              onClick={() => handleCopyPhone(contact.phone!)}
                              className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
                              title="Copy Phone Number"
                            >
                              {copiedPhone === contact.phone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedPhone === contact.phone ? 'Copied' : 'Copy'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document Extracted Specifications & Commercial Terms Card */}
            {(docExtraDetails.emdAmount || docExtraDetails.quantityStr) && (
              <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-blue-50/70 rounded-2xl p-4.5 border border-blue-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                  <span className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>Extracted Document Specifications</span>
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-900 font-black px-2 py-0.5 rounded">
                    DOCUMENT DATA
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {docExtraDetails.quantityStr && (
                    <div className="bg-white rounded-xl p-3 border border-blue-100">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest block">
                        Estimated Lot Quantity
                      </span>
                      <span className="text-sm font-black text-slate-900 mt-0.5 block">
                        {docExtraDetails.quantityStr}
                      </span>
                    </div>
                  )}

                  {docExtraDetails.emdAmount && (
                    <div className="bg-white rounded-xl p-3 border border-blue-100">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest block">
                        Caution / EMD Amount
                      </span>
                      <span className="text-sm font-black text-emerald-700 mt-0.5 block">
                        {docExtraDetails.emdAmount}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Necessary Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Location Specifications */}
              <div className="md:col-span-6 bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Location Specifications</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">State / Region</span>
                  <span className="text-[14px] font-extrabold text-slate-900 mt-0.5">
                    {locationDetails.state}
                  </span>
                </div>

                {locationDetails.city && locationDetails.city !== 'Not Specified' && (
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">City / District</span>
                    <span className="text-[14px] font-extrabold text-blue-900 mt-0.5">
                      {locationDetails.city} {locationDetails.pincode ? `(${locationDetails.pincode})` : ''}
                    </span>
                  </div>
                )}

                {locationDetails.fullAddress && (
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Full Address</span>
                      <button
                        onClick={handleCopyAddress}
                        className="text-[10px] font-bold text-primary flex items-center gap-1 cursor-pointer"
                      >
                        {copiedAddress ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copiedAddress ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                      {locationDetails.fullAddress}
                    </p>
                  </div>
                )}
              </div>

              {/* Bidding Schedule & Dates */}
              <div className="md:col-span-6 bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Bidding Schedule</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Bidding Starts</span>
                  <span className="text-[13.5px] font-extrabold text-blue-950 mt-0.5">{safeDateStr(item.auction_start_date)}</span>
                </div>

                <div className="flex flex-col border-t border-slate-100 pt-2">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Bidding Ends</span>
                  <span className="text-[13.5px] font-extrabold text-amber-900 mt-0.5">{safeDateStr(item.auction_end_date)}</span>
                </div>

                <div className="flex flex-col border-t border-slate-100 pt-2">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-1">Auction Status</span>
                  <div>
                    {isClosed ? (
                      <span className="inline-block font-black text-xs px-2.5 py-1 rounded-md border border-slate-300 text-slate-600 bg-slate-100">
                        AUCTION CLOSED
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

            {/* Clean Notice Summary & Details */}
            {cleanDescription && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-slate-400" /> Notice Summary & Scope
                </h4>
                <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-150 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {cleanDescription}
                </p>
              </div>
            )}

            {/* Official Notice Documents List */}
            {availableDocs.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Official Notice Documents & Attachments ({availableDocs.length})</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableDocs.map((doc, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col justify-between gap-3 shadow-3xs hover:border-indigo-300 transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 truncate" title={doc.label}>
                            {doc.label}
                          </h5>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            GeM Official PDF Document
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

          {/* Right Panel: Clean Document Download Card (No Iframe Preview) */}
          {(itemImage || availableDocs.length > 0) && (
            <div className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 p-5 overflow-visible lg:overflow-y-auto flex flex-col space-y-5">
              
              {/* GeM Item Preview Image */}
              {itemImage && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2">
                    <span>Category Reference Image</span>
                  </h4>
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video border border-slate-200 shadow-2xs">
                    <img
                      src={itemImage}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}

              {/* Sleek Document Action Card without embedded iframe */}
              {availableDocs.length > 0 && primaryDoc && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>Official Notice Document</span>
                    <span className="text-[9.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded">
                      {availableDocs.length} Docs
                    </span>
                  </h4>

                  <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 rounded-2xl p-5 border border-indigo-100 shadow-2xs flex flex-col justify-between gap-5 relative overflow-hidden">
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="p-3.5 rounded-2xl bg-indigo-100 border border-indigo-200/60 text-indigo-600 shrink-0">
                        <FileText className="w-8 h-8" />
                      </div>
                      <span className="text-[10px] font-black tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shrink-0">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Verified PDF Notice
                      </span>
                    </div>

                    <div className="space-y-1 relative z-10">
                      <h5 className="text-sm sm:text-base font-extrabold text-slate-900 line-clamp-2 leading-snug">
                        {primaryDoc.label}
                      </h5>
                      <span className="text-[11px] text-slate-500 font-mono block">
                        Official Government e-Auction Notice Document
                      </span>
                    </div>

                    {/* Prominent Action Buttons */}
                    <div className="flex flex-col gap-2.5 pt-2 relative z-10">
                      <button
                        onClick={() => openInAppViewer(primaryDoc.url, `${primaryDoc.label}: ${item.title}`, primaryDoc.safeName)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-4 h-4 text-indigo-600" />
                        <span>Preview Document in Fullscreen</span>
                      </button>

                      <a
                        href={primaryDoc.downloadUrl}
                        download={primaryDoc.safeName}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
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
        )}

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
                  View Notice in Fullscreen
                </button>

                <a
                  href={primaryDoc.downloadUrl}
                  download={primaryDoc.safeName}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2.5 px-5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Official PDF
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
