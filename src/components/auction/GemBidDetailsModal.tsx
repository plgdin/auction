import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, Landmark, Download, MapPin, AlignLeft, Eye, Heart, Calendar, FileText, Phone, UserCheck, ShieldCheck, ExternalLink, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { GemBid } from '../../services/publicService';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { cleanCategoryName } from '../../utils/cleanCategory';
import { BidIntelligencePanel } from './BidIntelligencePanel';
import { isValidIndianPhoneNumber } from '../../utils/gemDocumentParser';

interface GemBidDetailsModalProps {
  item: GemBid;
  onClose: () => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeParse = (d?: string | null): Date | null => {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const safeDateStr = (d?: string | null): string => {
  const parsed = safeParse(d);
  return parsed
    ? parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not Available';
};

/** True when the URL points to our Supabase CDN (already cached). */
const isCdnUrl = (url?: string | null): boolean =>
  Boolean(url && url.includes('supabase.co'));

/** Official GeM BidPlus page for a given bid number. */
const gemPortalUrl = (bidNumber: string): string =>
  `https://bidplus.gem.gov.in/showbidDocument/${encodeURIComponent(bidNumber)}`;

// ─── Document entry builder ──────────────────────────────────────────────────

interface DocumentEntry {
  url: string;
  label: string;
  safeName: string;
  /** URL for direct download (CDN if cached, otherwise GeM portal). */
  downloadUrl: string;
  /** True when we have a verified copy in Supabase Storage. */
  isCached: boolean;
}

function buildDocumentEntries(item: GemBid): DocumentEntry[] {
  const entries: DocumentEntry[] = [];
  const bidSafe = item.bid_number.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Primary bid document
  const rawUrl = item.document_url || gemPortalUrl(item.bid_number);
  const cached = isCdnUrl(item.document_url);
  const viewUrl = cached
    ? item.document_url!
    : `/api/document-proxy?url=${encodeURIComponent(rawUrl)}&filename=GeM_Bid_${bidSafe}.pdf&disposition=inline`;
  const downloadUrl = cached
    ? item.document_url!
    : `/api/document-proxy?url=${encodeURIComponent(rawUrl)}&filename=GeM_Bid_${bidSafe}.pdf&disposition=attachment`;

  entries.push({
    url: viewUrl,
    label: cached ? 'Official GeM Bid Document (Verified PDF)' : 'Official GeM Bid Document (PDF)',
    safeName: `GeM_Bid_${bidSafe}.pdf`,
    downloadUrl,
    isCached: cached,
  });

  // Additional attachments
  if (Array.isArray(item.document_urls)) {
    item.document_urls.forEach((url, idx) => {
      if (!url || url === rawUrl || (cached && url === item.document_url)) return;
      const docCached = isCdnUrl(url);
      const safeName = `GeM_Bid_${bidSafe}_Attachment_${idx + 1}.pdf`;
      const attViewUrl = docCached
        ? url
        : `/api/document-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeName)}&disposition=inline`;
      const attDownloadUrl = docCached
        ? url
        : `/api/document-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeName)}&disposition=attachment`;
      entries.push({
        url: attViewUrl,
        label: `Bid Attachment #${idx + 1}`,
        safeName,
        downloadUrl: attDownloadUrl,
        isCached: docCached,
      });
    });
  }

  return entries;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const GemBidDetailsModal: React.FC<GemBidDetailsModalProps> = ({
  item,
  onClose,
  isInterested = false,
  onInterestedToggle,
}) => {
  const [copiedBid, setCopiedBid] = useState(false);
  const [copiedRa, setCopiedRa] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [countdownStr, setCountdownStr] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'details' | 'valuation'>('details');

  // In-app document viewer — only for Supabase-cached PDFs
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
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !viewerState.isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, viewerState.isOpen]);

  // ── Contact details extraction ─────────────────────────────────────────────
  const contactDetails = useMemo(() => {
    const combinedText = `${item.items || ''} ${item.department_name || ''}`;
    const contacts: { name: string; phone?: string }[] = [];
    const phoneMatches = Array.from(
      new Set(combinedText.match(/\b[6-9]\d{9}\b|\b\d{5}\s*\d{5}\b|\b\d{3,5}[-\s]\d{6,8}\b/g) || [])
    );
    phoneMatches.forEach((ph) => {
      if (isValidIndianPhoneNumber(ph)) {
        contacts.push({ name: 'Procurement Officer / Department Helpline', phone: ph });
      }
    });
    return contacts;
  }, [item.items, item.department_name]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    const startD = safeParse(item.start_date);
    const endD = safeParse(item.end_date);

    if (!startD && !endD) {
      setCountdownStr('Schedule Pending');
      return;
    }

    const tick = () => {
      const now = Date.now();
      const startMs = startD ? startD.getTime() : 0;
      const endMs = endD ? endD.getTime() : 0;

      if (endD && now > endMs) {
        setCountdownStr('Bid Submission Closed');
      } else if (startD && endD && now >= startMs && now <= endMs) {
        const diff = endMs - now;
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setCountdownStr(`Bidding Ends in: ${h}h ${m}m ${s}s`);
      } else if (startD && now < startMs) {
        const diff = startMs - now;
        const d = Math.floor(diff / 86_400_000);
        const h = Math.floor((diff % 86_400_000) / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        setCountdownStr(`Starts in: ${d}d ${h}h ${m}m`);
      } else {
        setCountdownStr('Schedule Pending');
      }
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [item.start_date, item.end_date]);

  // ── Copy handlers ──────────────────────────────────────────────────────────
  const handleCopyBid = () => {
    navigator.clipboard.writeText(item.bid_number);
    setCopiedBid(true);
    setTimeout(() => setCopiedBid(false), 2000);
  };

  const handleCopyRa = () => {
    if (!item.ra_number) return;
    navigator.clipboard.writeText(item.ra_number);
    setCopiedRa(true);
    setTimeout(() => setCopiedRa(false), 2000);
  };

  const handleCopyPhone = (ph: string) => {
    navigator.clipboard.writeText(ph);
    setCopiedPhone(ph);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const now = new Date();
  const startD = safeParse(item.start_date);
  const endD = safeParse(item.end_date);
  const isClosed = endD ? now > endD : false;
  const isLive = startD && endD ? now >= startD && now <= endD : false;

  const availableDocs = buildDocumentEntries(item);
  const primaryDoc = availableDocs[0];

  const openViewer = (doc: DocumentEntry) => {
    setViewerState({ isOpen: true, title: `${doc.label}: ${item.items || item.bid_number}`, url: doc.url, filename: doc.safeName });
  };

  // ── Status badge ───────────────────────────────────────────────────────────
  const statusBadge = isClosed ? (
    <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
      Ended
    </span>
  ) : isLive ? (
    <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Live Now
    </span>
  ) : (
    <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
      Upcoming
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs select-text overflow-hidden">

      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 text-left">

        {/* ═══ Top Header Bar ═══ */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            {/* Bid Number */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/60 px-3 py-1.5 rounded-lg">
              <span className="text-[11px] font-bold text-slate-500 font-mono truncate max-w-[200px]" title={item.bid_number}>
                {item.bid_number}
              </span>
              <button
                onClick={handleCopyBid}
                className="p-0.5 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Copy Bid Number"
              >
                {copiedBid ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {statusBadge}

            {item.ra_number && (
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-indigo-600 font-mono">RA: {item.ra_number}</span>
                <button
                  onClick={handleCopyRa}
                  className="p-0.5 rounded hover:bg-indigo-100 transition-colors text-indigo-400 hover:text-indigo-700 cursor-pointer"
                  title="Copy RA Number"
                >
                  {copiedRa ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onInterestedToggle && (
              <button
                onClick={onInterestedToggle}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-2xs",
                  isInterested
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                <Heart className={clsx("w-3.5 h-3.5", isInterested ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
                <span className="hidden sm:inline">{isInterested ? "Interested" : "I'm Interested"}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══ Tab Navigation ═══ */}
        <div className="px-6 bg-white border-b border-slate-200 flex items-center shrink-0">
          <button
            onClick={() => setActiveTab('details')}
            className={clsx(
              "py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer mr-6",
              activeTab === 'details' ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-700"
            )}
          >
            Catalog Details
          </button>
          <button
            onClick={() => setActiveTab('valuation')}
            className={clsx(
              "py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2",
              activeTab === 'valuation' ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-700"
            )}
          >
            <span>Bid Intelligence</span>
            <span className="text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-md tracking-normal uppercase shrink-0">Beta</span>
          </button>
        </div>

        {/* ═══ Main Content Body ═══ */}
        {activeTab === 'valuation' ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <div className="max-w-5xl mx-auto">
              <BidIntelligencePanel
                itemTitle={item.items || item.bid_number}
                reservePrice={0}
                categoryName={item.category_name}
                quantity={item.quantity ? parseInt(item.quantity.replace(/[^\d]/g, ''), 10) : undefined}
                rawDescription={item.items || item.bid_number}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">

            {/* ─── Left Panel: Bid Information ─── */}
            <div className="flex-1 p-5 sm:p-6 space-y-5 overflow-y-auto">

              {/* Title + Category */}
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    GeM Procurement Bid
                  </span>
                  {item.category_name && (
                    <span className="bg-primary/8 text-primary border border-primary/15 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                      {cleanCategoryName(item.category_name, item.items)}
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-950 leading-snug">
                  {item.items || `GeM Bid Notice #${item.bid_number}`}
                </h3>
              </div>

              {/* ── Countdown Banner ── */}
              <div className={clsx(
                "rounded-xl p-3.5 flex items-center justify-between shadow-3xs",
                isClosed
                  ? "bg-slate-50 border border-slate-200 text-slate-600"
                  : isLive
                    ? "bg-emerald-50/70 border border-emerald-200 text-emerald-900"
                    : "bg-indigo-50/70 border border-indigo-200 text-indigo-900"
              )}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Bidding Timeline
                </span>
                <span className="font-black text-sm tracking-wide flex items-center gap-2">
                  {!isClosed && <span className="w-1.5 h-1.5 bg-current rounded-full animate-ping shrink-0 opacity-60" />}
                  {countdownStr}
                </span>
              </div>

              {/* ── Info Cards Grid ── */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">

                {/* Department */}
                <div className="md:col-span-7 bg-white rounded-xl p-4 border border-slate-200 shadow-3xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <Landmark className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    Procuring Department / Authority
                  </span>
                  <span className="text-[15px] font-black text-slate-900 block leading-snug">
                    {item.department_name || item.department || 'Government Authority'}
                  </span>
                  {(item.ministry || item.organisation) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {item.ministry && (
                        <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          Ministry: {item.ministry}
                        </span>
                      )}
                      {item.organisation && (
                        <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          Org: {item.organisation}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div className="md:col-span-5 bg-gradient-to-br from-indigo-50 via-indigo-50/60 to-blue-50 border border-indigo-200/70 rounded-xl p-4 shadow-3xs">
                  <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block mb-1">
                    Quantity Required
                  </span>
                  <span className="text-2xl font-black text-indigo-950 block tracking-tight">
                    {item.quantity ? `${item.quantity} Units` : 'Lot Procurement'}
                  </span>
                </div>
              </div>

              {/* ── Schedule & Location Row ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

                {/* Bidding Schedule */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-3xs space-y-2.5">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Bid Submission Timeline</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Start Date</span>
                    <span className="text-[13px] font-extrabold text-slate-900">{safeDateStr(item.start_date)}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">End Date</span>
                    <span className="text-[13px] font-extrabold text-amber-900">{safeDateStr(item.end_date)}</span>
                  </div>
                </div>

                {/* Location & Category */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-3xs space-y-2.5">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Location & Category</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Region</span>
                    <span className="text-[13px] font-extrabold text-slate-900">
                      {item.state || item.city || 'India (Pan-National)'}
                    </span>
                  </div>
                  {item.category_name && (
                    <div className="border-t border-slate-100 pt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Procurement Category</span>
                      <span className="text-[13px] font-bold text-indigo-800">{item.category_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Contact Officers ── */}
              {contactDetails.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50/80 via-amber-50/50 to-orange-50/60 rounded-xl p-4 border border-amber-200/70 shadow-3xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-200/50 pb-2">
                    <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      Procurement Officer & Helpline
                    </span>
                    <span className="text-[9px] bg-amber-200/60 text-amber-950 font-black px-2 py-0.5 rounded">
                      DIRECT
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {contactDetails.map((contact, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-lg p-3 border border-amber-200/60 flex items-center justify-between gap-2 shadow-3xs"
                      >
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-slate-900 block truncate">{contact.name}</span>
                          {contact.phone && (
                            <span className="text-[11px] font-mono font-extrabold text-amber-900 block mt-0.5">{contact.phone}</span>
                          )}
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={`tel:${contact.phone.replace(/[\s-]/g, '')}`}
                              className="p-1.5 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors cursor-pointer"
                              title="Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleCopyPhone(contact.phone!)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                              title="Copy Phone"
                            >
                              {copiedPhone === contact.phone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Items & Scope ── */}
              {item.items && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-3xs">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5" /> Items & Procurement Scope
                  </h4>
                  <p className="text-xs text-slate-700 bg-slate-50/80 p-3.5 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-wrap">
                    {item.items}
                  </p>
                </div>
              )}

              {/* ── Official Documents List ── */}
              {availableDocs.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-3xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      Official GeM Bid Documents ({availableDocs.length})
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availableDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 flex flex-col justify-between gap-2.5 hover:border-indigo-300 transition-all"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-[11px] font-bold text-slate-900 truncate" title={doc.label}>
                              {doc.label}
                            </h5>
                            <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                              {doc.isCached ? 'Verified PDF • Supabase CDN' : 'Official GeM BidPlus Portal'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => openViewer(doc)}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 shadow-3xs transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" />
                            <span>Preview</span>
                          </button>

                          <a
                            href={doc.downloadUrl}
                            download={doc.safeName}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary/90 shadow-2xs transition-all cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Right Panel: Document Card + Image ─── */}
            {availableDocs.length > 0 && (
              <div className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/80 p-5 overflow-visible lg:overflow-y-auto flex flex-col space-y-5">

                {/* Official Document Action Card */}
                {primaryDoc && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
                      <span>Official Bid Document</span>
                      {primaryDoc.isCached && (
                        <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <ShieldCheck className="w-2.5 h-2.5" /> Verified
                        </span>
                      )}
                    </h4>

                    <div className="bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 rounded-xl p-4 border border-indigo-100 shadow-2xs space-y-4">
                      {/* Icon + Label */}
                      <div className="flex items-start gap-3">
                        <div className="p-3 rounded-xl bg-indigo-100 border border-indigo-200/50 text-indigo-600 shrink-0">
                          <FileText className="w-7 h-7" />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <h5 className="text-sm font-extrabold text-slate-900 line-clamp-2 leading-snug">
                            {primaryDoc.label}
                          </h5>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {primaryDoc.isCached
                              ? 'Downloaded & verified from GeM BidPlus'
                              : 'Official Government e-Marketplace document'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => openViewer(primaryDoc)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 active:scale-[0.98] transition-all cursor-pointer shadow-3xs"
                        >
                          <Eye className="w-4 h-4 text-primary" />
                          Preview Document
                        </button>

                        <a
                          href={primaryDoc.downloadUrl}
                          download={primaryDoc.safeName}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                        >
                          <Download className="w-4 h-4" />
                          Download Official PDF
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ Footer ═══ */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-all cursor-pointer text-center"
          >
            Close
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {primaryDoc && (
              <>
                <button
                  onClick={() => openViewer(primaryDoc)}
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-4 rounded-xl text-sm font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Document
                </button>

                <a
                  href={primaryDoc.downloadUrl}
                  download={primaryDoc.isCached ? primaryDoc.safeName : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* In-App PDF Viewer — only for Supabase-cached PDFs */}
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
