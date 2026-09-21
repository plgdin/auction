import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Landmark, 
  Download, 
  MapPin, 
  AlignLeft, 
  Eye, 
  Heart, 
  Calendar, 
  FileText, 
  Phone, 
  UserCheck, 
  ShieldCheck, 
  Clock,
  Sparkles,
  Building2,
  ExternalLink,
  Layers,
  Package,
  RefreshCw
} from 'lucide-react';
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

const isCdnUrl = (url?: string | null): boolean =>
  Boolean(url && url.includes('supabase.co'));

const gemPortalUrl = (bidNumber: string): string =>
  `https://bidplus.gem.gov.in/showbidDocument/${encodeURIComponent(bidNumber)}`;

export interface ParsedLotItem {
  id: number | string;
  name: string;
  quantity?: string;
}

export const parseLotItems = (raw?: string | null): ParsedLotItem[] => {
  if (!raw || !raw.trim()) return [];
  const text = raw.trim();

  const extractQuantity = (itemStr: string): { name: string; quantity?: string } => {
    // Check for [Qty: 120], (Qty: 120), (120 Units), [120 Units], - 120 Units, etc.
    const qtyMatch = itemStr.match(/[\[\(](?:qty:?\s*|quantity:?\s*)?(\d+[\s\w]*)[\]\)]/i)
      || itemStr.match(/(?:[-–—:]\s*)(\d+\s*(?:units?|nos?|pcs?|sets?|lots?|kg|litres?|mtrs?))/i);

    if (qtyMatch) {
      const cleanName = itemStr.replace(qtyMatch[0], '').trim().replace(/[-–—,:]$/, '').trim();
      return { name: cleanName, quantity: qtyMatch[1].trim() };
    }
    return { name: itemStr };
  };

  // Pattern 1: Split at comma followed by digit and space/dot/dash, e.g. "1 DG Set,2 DG Set,3 DG Set"
  const numberedSplit = text.split(/,\s*(?=\d+[\s.-])/g);
  if (numberedSplit.length > 1) {
    return numberedSplit.map((s, idx) => {
      const match = s.match(/^(\d+)[\s.-]*(.+)$/);
      const rawName = (match ? match[2] : s).trim();
      const { name, quantity } = extractQuantity(rawName);
      return {
        id: match ? parseInt(match[1], 10) || idx + 1 : idx + 1,
        name,
        quantity,
      };
    });
  }

  // Pattern 2: Comma or newline or semicolon separated items
  const chunks = text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  if (chunks.length > 1) {
    return chunks.map((s, idx) => {
      const match = s.match(/^(\d+)[\s.-]*(.+)$/);
      const rawName = (match ? match[2] : s).trim();
      const { name, quantity } = extractQuantity(rawName);
      return {
        id: match ? parseInt(match[1], 10) || idx + 1 : idx + 1,
        name,
        quantity,
      };
    });
  }

  const { name, quantity } = extractQuantity(text);
  return [{ id: 1, name, quantity }];
};

export const extractDeliveryAddress = (desc?: string | null): string | null => {
  if (!desc) return null;
  const match = desc.match(/(?:ACTUAL DELIVERY[^\n:]*[:\n]+|following address[:\n]+)([\s\S]*?)(?=(?:\n\n|\n[A-Z0-9.\s]+:|\nBUYER|\nOPTION|\nCONSIGN|\nCONFLICT|\n■|\.|\z))/i);
  if (match) {
    const lines = match[1].split('\n').map(l => l.trim()).filter(l => l && l !== '.');
    if (lines.length > 0) {
      return lines.join(', ');
    }
  }
  return null;
};

const renderFormattedDescription = (desc: string) => {
  const sections = desc.split(/\n\s*\n/);
  return (
    <div className="space-y-3">
      {sections.map((sec, sIdx) => {
        const lines = sec.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;

        const firstLine = lines[0];
        const isHeader = firstLine.startsWith('■') 
          || /^[A-Z\s&-]{4,}:?$/.test(firstLine) 
          || firstLine.includes('OFFICIAL') 
          || firstLine.includes('BREAKDOWN') 
          || firstLine.includes('TERMS') 
          || firstLine.includes('LOCATION') 
          || firstLine.includes('GRIEVANCE') 
          || firstLine.includes('REDRESSAL');

        return (
          <div key={sIdx} className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
            {lines.map((line, lIdx) => {
              if (lIdx === 0 && isHeader) {
                return (
                  <h6 key={lIdx} className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5 pb-1.5 border-b border-slate-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                    {line.replace(/^[■\s]+/, '')}
                  </h6>
                );
              }

              const isBullet = line.startsWith('•') || /^\d+\./.test(line);
              return (
                <div key={lIdx} className={clsx("text-xs text-slate-700 leading-relaxed", isBullet ? "pl-2 py-0.5" : "py-0.5")}>
                  {isBullet ? (
                    <span className="flex items-start gap-1.5">
                      <span className="text-primary font-bold shrink-0">{line.match(/^(\d+\.|•)/)?.[0] || '•'}</span>
                      <span>{line.replace(/^(\d+\.|•)\s*/, '')}</span>
                    </span>
                  ) : (
                    line
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ─── Document Entry Builder ──────────────────────────────────────────────────

interface DocumentEntry {
  url: string;
  label: string;
  safeName: string;
  downloadUrl: string;
  isCached: boolean;
  type: 'primary' | 'ra' | 'corrigendum' | 'attachment';
}

function buildDocumentEntries(item: GemBid): DocumentEntry[] {
  const entries: DocumentEntry[] = [];
  const bidSafe = item.bid_number.replace(/[^a-zA-Z0-9_-]/g, '_');
  const processedUrls = new Set<string>();

  const addEntry = (url: string, baseLabel: string, filenamePrefix: string, type: DocumentEntry['type']) => {
    if (!url || processedUrls.has(url)) return;
    processedUrls.add(url);

    const cached = isCdnUrl(url);
    const safeName = `${filenamePrefix}.pdf`;
    
    const viewUrl = cached
      ? url
      : `/api/document-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeName)}&disposition=inline`;
    
    const downloadUrl = cached
      ? url
      : `/api/document-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeName)}&disposition=attachment`;

    entries.push({
      url: viewUrl,
      label: cached ? `${baseLabel} (Verified PDF)` : `${baseLabel} (PDF)`,
      safeName,
      downloadUrl,
      isCached: cached,
      type
    });
  };

  // Primary bid document
  const rawUrl = item.document_url || gemPortalUrl(item.bid_number);
  addEntry(rawUrl, 'Official GeM Bid Document', `GeM_Bid_${bidSafe}`, 'primary');

  // Reverse Auction Document
  if (item.ra_document_url) {
    addEntry(item.ra_document_url, `Reverse Auction: ${item.ra_number || 'Document'}`, `GeM_RA_${bidSafe}`, 'ra');
  }

  // Corrigendums
  if (Array.isArray(item.corrigendum_urls)) {
    item.corrigendum_urls.forEach((cUrl, idx) => {
      addEntry(cUrl, `Corrigendum Notice #${idx + 1}`, `GeM_Corr_${idx + 1}_${bidSafe}`, 'corrigendum');
    });
  }

  // Fallback for attachments
  if (Array.isArray(item.document_urls)) {
    item.document_urls.forEach((url, idx) => {
      addEntry(url, `Bid Attachment #${idx + 1}`, `GeM_Attachment_${idx + 1}_${bidSafe}`, 'attachment');
    });
  }

  return entries;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const GemBidDetailsModal: React.FC<GemBidDetailsModalProps> = ({
  item: initialItem,
  onClose,
  isInterested = false,
  onInterestedToggle,
}) => {
  const [item, setItem] = useState<GemBid>(initialItem);
  const [isExtracting, setIsExtracting] = useState(false);

  // Sync state if initialItem changes
  useEffect(() => {
    setItem(initialItem);
  }, [initialItem]);

  // Auto-enrich specifications and items from tender PDF if truncated
  useEffect(() => {
    const hasEllipsis = Boolean(item.items && item.items.includes('...'));
    const isSnippetDesc = Boolean(
      !item.raw_description ||
      item.raw_description.includes('Items:') ||
      item.raw_description.length < 150
    );

    if ((hasEllipsis || isSnippetDesc) && !isExtracting) {
      setIsExtracting(true);
      fetch(`/api/gem-bid-extract?bid_number=${encodeURIComponent(item.bid_number)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.items) {
            setItem(prev => ({
              ...prev,
              items: data.items,
              category_name: data.category_name || prev.category_name,
              department_name: data.department_name || prev.department_name,
              raw_description: data.raw_description || prev.raw_description,
              city: data.address ? (data.address.includes('Visakhapatnam') ? 'Visakhapatnam' : data.address.includes('Roorkee') ? 'Roorkee' : prev.city) : prev.city,
              state: data.address ? (data.address.includes('Andhra') ? 'Andhra Pradesh' : data.address.includes('Uttarakhand') ? 'Uttarakhand' : prev.state) : prev.state
            }));
          }
        })
        .catch(err => {
          console.warn('Bid extraction background sync error:', err);
        })
        .finally(() => {
          setIsExtracting(false);
        });
    }
  }, [item.bid_number]);

  const [copiedBid, setCopiedBid] = useState(false);
  const [copiedRa, setCopiedRa] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [countdownStr, setCountdownStr] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'valuation'>('details');

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

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !viewerState.isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, viewerState.isOpen]);

  // Extract contact numbers
  const contactDetails = useMemo(() => {
    const combinedText = `${item.items || ''} ${item.department_name || ''} ${item.organisation || ''}`;
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
  }, [item.items, item.department_name, item.organisation]);

  // Countdown timer calculation
  useEffect(() => {
    const startD = safeParse(item.start_date);
    const endD = safeParse(item.end_date);

    if (!startD && !endD) {
      setCountdownStr('Submission Schedule Pending');
      return;
    }

    const tick = () => {
      const now = Date.now();
      const startMs = startD ? startD.getTime() : 0;
      const endMs = endD ? endD.getTime() : 0;

      if (endD && now > endMs) {
        setCountdownStr('Bid Submission Window Closed');
      } else if (startD && endD && now >= startMs && now <= endMs) {
        const diff = endMs - now;
        const d = Math.floor(diff / 86_400_000);
        const h = Math.floor((diff % 86_400_000) / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        if (d > 0) {
          setCountdownStr(`Closes in: ${d}d ${h}h ${m}m ${s}s`);
        } else {
          setCountdownStr(`Closes in: ${h}h ${m}m ${s}s`);
        }
      } else if (startD && now < startMs) {
        const diff = startMs - now;
        const d = Math.floor(diff / 86_400_000);
        const h = Math.floor((diff % 86_400_000) / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        setCountdownStr(`Opens in: ${d}d ${h}h ${m}m`);
      } else {
        setCountdownStr('Schedule as per Notice');
      }
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [item.start_date, item.end_date]);

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

  const now = new Date();
  const startD = safeParse(item.start_date);
  const endD = safeParse(item.end_date);
  const isClosed = endD ? now > endD : false;
  const isLive = startD && endD ? now >= startD && now <= endD : false;

  const parsedLots = useMemo(() => {
    return parseLotItems(item.items);
  }, [item.items]);

  const extractedAddress = useMemo(() => {
    return extractDeliveryAddress(item.raw_description);
  }, [item.raw_description]);

  const availableDocs = buildDocumentEntries(item);
  const primaryDoc = availableDocs[0];

  const openViewer = (doc: DocumentEntry) => {
    setViewerState({ 
      isOpen: true, 
      title: `${doc.label}: ${item.items || item.bid_number}`, 
      url: doc.url, 
      filename: doc.safeName 
    });
  };

  const statusBadge = isClosed ? (
    <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
      Closed
    </span>
  ) : isLive ? (
    <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-3xs">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      Live Tender
    </span>
  ) : (
    <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
      Upcoming
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md select-text overflow-hidden animate-in fade-in duration-200">
      {/* Clickable Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl border border-slate-200/80 flex flex-col max-h-[92vh] text-left z-10">

        {/* ═══ Top Header Bar ═══ */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            {/* Bid Number Pill */}
            <div className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-xl shadow-2xs">
              <span className="text-[11px] font-bold font-mono tracking-tight" title={item.bid_number}>
                {item.bid_number}
              </span>
              <button
                onClick={handleCopyBid}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Copy Bid Number"
              >
                {copiedBid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {statusBadge}

            {item.ra_number && (
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-xl">
                <span className="text-[11px] font-bold text-indigo-700 font-mono">
                  RA: {item.ra_number}
                </span>
                <button
                  onClick={handleCopyRa}
                  className="p-0.5 rounded text-indigo-400 hover:text-indigo-700 transition-colors cursor-pointer"
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
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Heart className={clsx("w-3.5 h-3.5", isInterested ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
                <span className="hidden sm:inline">{isInterested ? "Bookmarked" : "Bookmark"}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              title="Close Modal"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══ Segmented Tab Navigation ═══ */}
        <div className="px-6 bg-white border-b border-slate-200 flex items-center gap-8 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('details')}
            className={clsx(
              "py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              activeTab === 'details' ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-700"
            )}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            Procurement Specifications
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={clsx(
              "py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              activeTab === 'documents' ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-700"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            Official Documents
            <span className="text-[10px] font-extrabold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-md">
              {availableDocs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('valuation')}
            className={clsx(
              "py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2",
              activeTab === 'valuation' ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-700"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Bid Intelligence
            <span className="text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-md tracking-normal uppercase shrink-0">Beta</span>
          </button>
        </div>

        {/* ═══ Main Content View ═══ */}
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
        ) : activeTab === 'documents' ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/60 space-y-4">
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-3xs">
                <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Government e-Marketplace Official Tender Files
                </h4>
                <p className="text-xs text-slate-500">
                  Direct verified PDF documents synced from the official GeM portal. Click to preview within the platform or download directly.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between gap-4 shadow-xs hover:shadow-md hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={clsx(
                        "p-3 rounded-xl shrink-0",
                        doc.type === 'primary' ? "bg-primary/10 text-primary" :
                        doc.type === 'ra' ? "bg-indigo-100 text-indigo-700" :
                        doc.type === 'corrigendum' ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                      )}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={clsx(
                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                            doc.type === 'primary' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            doc.type === 'ra' ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                            doc.type === 'corrigendum' ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-slate-100 text-slate-600"
                          )}>
                            {doc.type === 'primary' ? 'Main Tender PDF' : doc.type.toUpperCase()}
                          </span>
                          {doc.isCached && (
                            <span className="text-[9px] text-emerald-700 font-semibold flex items-center gap-0.5">
                              <ShieldCheck className="w-3 h-3" /> Storage Verified
                            </span>
                          )}
                        </div>
                        <h5 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug" title={doc.label}>
                          {doc.label}
                        </h5>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => openViewer(doc)}
                        className="flex-1 inline-flex justify-center items-center h-9 px-3 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5 text-primary" />
                        Preview Document
                      </button>

                      <a
                        href={doc.downloadUrl}
                        download={doc.safeName}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex justify-center items-center h-9 px-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 transition-all cursor-pointer shadow-3xs"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
            {/* ── Left Details Panel ── */}
            <div className="flex-1 p-5 sm:p-6 space-y-5 overflow-y-auto">
              {/* Title & Procurement Category */}
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    GeM Procurement
                  </span>
                  {item.category_name && (
                    <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                      {cleanCategoryName(item.category_name, item.items)}
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-950 leading-snug">
                  {item.items || `GeM Bid Notice #${item.bid_number}`}
                </h3>
              </div>

              {/* Countdown & Schedule Banner */}
              <div className={clsx(
                "rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs",
                isClosed
                  ? "bg-slate-100 border border-slate-200 text-slate-600"
                  : isLive
                    ? "bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 text-emerald-950"
                    : "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-950"
              )}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-current shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-75 block">
                      Tender Submission Window
                    </span>
                    <span className="font-extrabold text-sm sm:text-base tracking-tight block">
                      {countdownStr}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-semibold sm:text-right">
                  <span className="text-[10px] uppercase tracking-wider opacity-60 block">Closing Timestamp</span>
                  <span>{safeDateStr(item.end_date)}</span>
                </div>
              </div>

              {/* High-level Procurement Entity Cards */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                {/* Procuring Entity */}
                <div className="md:col-span-8 bg-white rounded-2xl p-4 border border-slate-200/90 shadow-3xs space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />
                    Procuring Entity & Ministry
                  </span>
                  <span className="text-[15px] font-black text-slate-900 block leading-snug">
                    {item.department_name || item.department || 'Government Department / Authority'}
                  </span>
                  {(item.ministry || item.organisation) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {item.ministry && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200/70">
                          Ministry: {item.ministry}
                        </span>
                      )}
                      {item.organisation && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200/70">
                          Org: {item.organisation}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div className="md:col-span-4 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/70 border border-indigo-200/80 rounded-2xl p-4 shadow-3xs flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-1 mb-1">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    Required Lot
                  </span>
                  <span className="text-2xl font-black text-indigo-950 tracking-tight block">
                    {item.quantity ? `${item.quantity} Units` : '1 Unit / Lot'}
                  </span>
                </div>
              </div>

              {/* Schedule & Location Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-3xs space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    Schedule Timestamps
                  </span>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Opening Date:</span>
                      <span className="font-bold text-slate-800">{safeDateStr(item.start_date)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1">
                      <span className="text-slate-400">Submission End:</span>
                      <span className="font-bold text-amber-900">{safeDateStr(item.end_date)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-3xs space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    Delivery Location & Jurisdiction
                  </span>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">State / Region:</span>
                      <span className="font-bold text-slate-800">{item.state || (extractedAddress && extractedAddress.includes('UTTRAKHAND') ? 'Uttarakhand' : 'Pan-India')}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1">
                      <span className="text-slate-400">City / District:</span>
                      <span className="font-bold text-slate-800">{item.city || (extractedAddress && extractedAddress.includes('ROORKEE') ? 'Roorkee' : 'Refer to Notice')}</span>
                    </div>
                    {extractedAddress && (
                      <div className="border-t border-slate-100 pt-2 mt-1.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-1">Official Delivery Depot:</span>
                        <div className="text-[11px] font-bold text-slate-800 leading-snug bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          {extractedAddress}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Officers */}
              {contactDetails.length > 0 && (
                <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/80 shadow-3xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      Procurement Authority Contacts
                    </span>
                    <span className="text-[9px] bg-amber-200/60 text-amber-950 font-black px-2 py-0.5 rounded-md">
                      VERIFIED DIRECT
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {contactDetails.map((contact, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-xl p-3 border border-amber-200/60 flex items-center justify-between gap-2 shadow-3xs"
                      >
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-slate-900 block truncate">{contact.name}</span>
                          {contact.phone && (
                            <span className="text-xs font-mono font-black text-amber-900 block mt-0.5">{contact.phone}</span>
                          )}
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={`tel:${contact.phone.replace(/[\s-]/g, '')}`}
                              className="p-2 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors cursor-pointer"
                              title="Direct Phone Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleCopyPhone(contact.phone!)}
                              className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                              title="Copy Number"
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

              {/* ── Lot Inventory & Item Scope ── */}
              {item.items && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                  {/* Section Title */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 flex-wrap">
                          <span>Lot Inventory & Equipment Scope</span>
                          {parsedLots.length > 1 && (
                            <span className="bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full lowercase tracking-normal">
                              {parsedLots.length} items listed
                            </span>
                          )}
                          {isExtracting && (
                            <span className="bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full lowercase tracking-normal flex items-center gap-1 animate-pulse">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              extracting full lot from tender pdf...
                            </span>
                          )}
                        </h4>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Itemized breakdown of equipment and goods required in this procurement tender
                        </span>
                      </div>
                    </div>

                    {item.quantity && (
                      <span className="bg-blue-50 border border-blue-200 text-blue-800 text-xs font-black px-3 py-1 rounded-xl">
                        Total Quantity: {item.quantity} Units
                      </span>
                    )}
                  </div>

                  {/* At-a-Glance Procurement Essentials Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lot Composition</span>
                      <span className="text-xs font-black text-slate-900 mt-0.5">
                        {parsedLots.length > 1 ? `${parsedLots.length} Itemized Lots` : 'Single Item Lot'}
                      </span>
                    </div>

                    <div className="flex flex-col border-l border-slate-200 pl-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required Volume</span>
                      <span className="text-xs font-black text-indigo-900 mt-0.5">
                        {item.quantity ? `${item.quantity} Units` : '1 Job / Schedule'}
                      </span>
                    </div>

                    <div className="flex flex-col border-l border-slate-200 pl-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Procurement Model</span>
                      <span className="text-xs font-black text-emerald-800 mt-0.5">
                        {item.ra_number ? 'Reverse Auction (RA)' : 'Open Tender Bid'}
                      </span>
                    </div>

                    <div className="flex flex-col border-l border-slate-200 pl-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination</span>
                      <span className="text-xs font-black text-slate-900 mt-0.5 truncate" title={extractedAddress || item.location || item.state || 'National'}>
                        {extractedAddress ? (
                          extractedAddress.includes('ROORKEE') ? 'Roorkee, Uttarakhand' : extractedAddress.split(',')[0]
                        ) : item.city ? `${item.city}, ${item.state || ''}` : item.state || 'Pan-India Delivery'}
                      </span>
                    </div>
                  </div>

                  {/* Itemized Table or Cards */}
                  {parsedLots.length > 1 ? (
                    <div className="overflow-hidden border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <th className="py-2.5 px-3 w-16 text-center">Item #</th>
                            <th className="py-2.5 px-4">Item Name / Lot Description</th>
                            <th className="py-2.5 px-4 w-36 text-right">Scope / Allocation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {parsedLots.map((lot, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 text-center">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-extrabold border border-slate-200 font-mono">
                                  #{lot.id}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                    {lot.name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={clsx(
                                  "text-[11px] font-bold px-2.5 py-1 rounded-md border inline-block whitespace-nowrap",
                                  lot.quantity
                                    ? "text-indigo-900 bg-indigo-50/90 border-indigo-200"
                                    : "text-slate-600 bg-slate-50 border-slate-100"
                                )}>
                                  {lot.quantity ? (lot.quantity.toLowerCase().includes('unit') ? lot.quantity : `${lot.quantity} Units`) : "As per Bid Notice"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 flex items-start gap-3">
                      <Package className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Scope Description</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">
                          {item.items}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Extended Technical Description / Raw Specs */}
                  {item.raw_description && item.raw_description !== item.items && (
                    <div className="border-t border-slate-100 pt-4 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <AlignLeft className="w-3.5 h-3.5 text-primary" />
                          Detailed Technical Specifications & Criteria
                        </span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md">
                          Verified Document Extract
                        </span>
                      </div>
                      {renderFormattedDescription(item.raw_description)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Right Document & Actions Panel ── */}
            <div className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/70 p-5 flex flex-col space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-3xs space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-primary tracking-wider block">Official Document</span>
                    <h5 className="text-sm font-bold text-slate-900 leading-snug">
                      {primaryDoc?.label || 'Government Tender Notice'}
                    </h5>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {primaryDoc?.isCached ? 'Downloaded & archived in cloud storage' : 'Direct GeM portal PDF link'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {primaryDoc && (
                    <>
                      <button
                        onClick={() => openViewer(primaryDoc)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-primary" />
                        In-App PDF Preview
                      </button>

                      <a
                        href={primaryDoc.downloadUrl}
                        download={primaryDoc.safeName}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/95 transition-all cursor-pointer shadow-xs"
                      >
                        <Download className="w-4 h-4" />
                        Download Official Tender PDF
                      </a>
                    </>
                  )}

                  <a
                    href={gemPortalUrl(item.bid_number)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    <span>Open on GeM BidPlus Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Document Manifest List */}
              {availableDocs.length > 1 && (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-3xs space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Additional Notices ({availableDocs.length - 1})
                  </span>
                  <div className="space-y-2">
                    {availableDocs.slice(1).map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-bold text-slate-800 truncate" title={doc.label}>
                          {doc.label}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openViewer(doc)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-primary transition-colors cursor-pointer"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={doc.downloadUrl}
                            download={doc.safeName}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
                            title="Download"
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
          </div>
        )}

        {/* ═══ Bottom Modal Footer ═══ */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            Close Overview
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {primaryDoc && (
              <>
                <button
                  onClick={() => openViewer(primaryDoc)}
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-4 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 shadow-3xs transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Quick View PDF
                </button>

                <a
                  href={primaryDoc.downloadUrl}
                  download={primaryDoc.isCached ? primaryDoc.safeName : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-4 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/95 shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download Tender PDF
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* In-App PDF Previewer Modal */}
      <DocumentViewerModal
        isOpen={viewerState.isOpen}
        onClose={() => setViewerState((prev) => ({ ...prev, isOpen: false }))}
        title={viewerState.title}
        documentUrl={viewerState.url}
        filename={viewerState.filename}
        badge="Verified GeM Tender"
        subtitle={item.bid_number}
      />
    </div>
  );
};
