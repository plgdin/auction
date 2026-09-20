import { useState, useEffect, useMemo, memo } from 'react';
import { 
  Eye, 
  Calendar, 
  Clock, 
  Copy, 
  Check, 
  Info,
  Layers,
  MapPin,
  FileText,
  Landmark
} from 'lucide-react';
import { ButtonWithIconDemo } from '../ui/button-with-icon';
import type { GemBid } from '../../services/publicService';
import clsx from 'clsx';
import { storageService } from '../../services/storageService';
import { cleanCategoryName } from '../../utils/cleanCategory';

interface GemBidCardProps {
  item: GemBid;
  isGrid?: boolean;
  onPreview: (item: GemBid) => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseSafeDate = (dStr?: string | null): Date | null => {
  if (!dStr) return null;
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? null : d;
};

const formatDateOrdinal = (d: Date): string => {
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  const year = d.getFullYear();
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const suffix = (day < 11 || day > 13) ? (suffixes[day % 10] ?? 'th') : 'th';
  return `${day}${suffix} ${month} ${year}`;
};

const formatTimeAmpm = (d: Date): string => {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

// ─── Component ───────────────────────────────────────────────────────────────

export const GemBidCard = memo(function GemBidCard({
  item,
  isGrid = true,
  onPreview,
  isInterested = false,
  onInterestedToggle,
}: GemBidCardProps) {
  const [copied, setCopied] = useState(false);
  const [signedDisplayImage, setSignedDisplayImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [highResLoaded, setHighResLoaded] = useState(false);

  const shortId = item.bid_number || item.id?.substring(0, 8) || 'N/A';
  const cleanBidId = item.bid_number.replace(/[^a-zA-Z0-9_-]/g, '_');
  const hasDocument = Boolean(item.document_url || item.ra_document_url || (item.document_urls && item.document_urls.length > 0));

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.bid_number || item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Preview image resolution
  const rawDisplayImage = useMemo(() => {
    const raw = (item as any).preview_url || (item as any).image_url;
    if (raw && typeof raw === 'string') {
      if (
        !raw.includes('unsplash.com') &&
        !raw.includes('pexels.com') &&
        !raw.includes('pixabay.com') &&
        !raw.includes('freepik.com') &&
        !raw.includes('stock') &&
        !raw.includes('placeholder')
      ) {
        return raw;
      }
    }
    return (item.document_url || (item.document_urls && item.document_urls.length > 0)) ? `gem-previews/${cleanBidId}_0.jpg` : null;
  }, [item, cleanBidId]);

  useEffect(() => {
    let cancelled = false;
    async function resolveImage() {
      setImageLoading(true);
      setHighResLoaded(false);
      if (!rawDisplayImage) {
        setSignedDisplayImage(null);
        setImageLoading(false);
        return;
      }
      if (rawDisplayImage.startsWith('http') || rawDisplayImage.startsWith('data:')) {
        setSignedDisplayImage(rawDisplayImage);
        setImageLoading(false);
        return;
      }
      try {
        const signed = await storageService.getSignedUrls([rawDisplayImage]);
        if (!cancelled) {
          setSignedDisplayImage(signed[0] || null);
          setImageLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSignedDisplayImage(null);
          setImageLoading(false);
        }
      }
    }
    resolveImage();
    return () => {
      cancelled = true;
    };
  }, [rawDisplayImage]);

  // ── Date & status calculations ─────────────────────────────────────────────
  const startDate = parseSafeDate(item.start_date);
  const endDate = parseSafeDate(item.end_date);
  const now = new Date();

  const isClosed = (endDate && now > endDate) || item.status === 'closed' || item.status === 'ended';
  const isStarted = !isClosed && ((startDate && now >= startDate && (!endDate || now <= endDate)) || item.status === 'live');

  const diffMs = endDate ? endDate.getTime() - now.getTime() : 0;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isUrgent = diffDays >= 0 && diffDays < 3;
  const isWarning = diffDays >= 3 && diffDays < 7;

  const timeLeftBadge = isClosed ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 bg-slate-50">
      Bid Closed
    </span>
  ) : isStarted ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-rose-50 animate-pulse flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
      </span>
      Bidding Started
    </span>
  ) : startDate ? (
    <span className={clsx(
      "font-bold text-xs px-2.5 py-1 rounded-md border flex items-center gap-1",
      isUrgent ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" :
        isWarning ? "text-amber-700 bg-amber-50 border-amber-200" :
          "text-emerald-700 bg-emerald-50 border-emerald-200"
    )}>
      <Clock className="w-3.5 h-3.5" />
      Starts in {diffDays}d {diffHours}h
    </span>
  ) : (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 bg-slate-50">
      Scheduled
    </span>
  );

  const biddingPeriodStr = useMemo(() => {
    if (startDate && endDate) {
      const startDay = formatDateOrdinal(startDate);
      const endDay = formatDateOrdinal(endDate);
      if (startDay === endDay) {
        return `${startDay} • ${formatTimeAmpm(startDate)} - ${formatTimeAmpm(endDate)}`;
      }
      return `${startDay} - ${endDay}`;
    }
    if (endDate) return `Closes ${formatDateOrdinal(endDate)} ${formatTimeAmpm(endDate)}`;
    if (startDate) return `Opens ${formatDateOrdinal(startDate)}`;
    return 'See Official Tender Document';
  }, [startDate, endDate]);

  const mainCategory = cleanCategoryName(item.items || 'Procurement Tender', item.items);
  const deptHierarchy = [item.ministry, item.department, item.organisation].filter(Boolean).join(' • ') || 'Government of India Entity';
  const orgName = item.organisation || item.department || item.ministry || 'Government Department';
  const locationDisplay = (item as any).location || 'National (Pan-India)';

  // Renders authentic printed government document catalogue preview (matching MSTC document catalogue sheet from Image 2)
  const renderDocumentSheetPreview = () => (
    <div 
      onClick={() => onPreview(item)}
      className="w-full h-full bg-white p-2 border border-slate-300 rounded-xl overflow-hidden flex flex-col justify-start select-none group/doc shadow-2xs hover:border-primary transition-all duration-200 cursor-pointer"
      title="Click to view full official tender catalogue"
    >
      {/* Outer border of printed catalogue sheet */}
      <div className="w-full h-full border border-slate-800 bg-white p-2 flex flex-col justify-between">
        {/* Top Header Stamps */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
          {/* Left: EK KAAM DESH KE NAAM Badge */}
          <div className="border border-amber-600/90 bg-amber-50/70 px-1.5 py-0.5 rounded-[2px] shadow-3xs flex flex-col items-center justify-center leading-none">
            <span className="text-[6.5px] font-black tracking-tight text-slate-800">EK KAAM</span>
            <span className="text-[7px] font-black tracking-tight text-emerald-800">DESH KE NAAM</span>
          </div>

          {/* Center Logo/Emblem */}
          <div className="w-6 h-6 rounded border border-blue-900 bg-blue-950 flex items-center justify-center text-white shadow-3xs">
            <Landmark className="w-3.5 h-3.5 text-white" />
          </div>

          {/* Right: e-assuring INDIA Stamp */}
          <div className="border border-slate-700 bg-slate-50 px-1.5 py-0.5 rounded-[2px] shadow-3xs flex flex-col items-end justify-center leading-none">
            <span className="text-[6.5px] font-bold text-blue-900 tracking-tight">e-assuring</span>
            <span className="text-[7.5px] font-black text-emerald-700 tracking-tight">INDIA</span>
          </div>
        </div>

        {/* Gray Band Title */}
        <div className="bg-slate-200 border-y border-slate-800 py-1 text-center text-[9.5px] font-bold font-serif text-slate-900 uppercase tracking-wide">
          Detailed Auction Catalogue
        </div>

        {/* Structured Grid Table */}
        <div className="border border-slate-800 text-[8.5px] font-serif divide-y divide-slate-800 bg-white">
          <div className="flex divide-x divide-slate-800">
            <span className="font-bold w-24 shrink-0 px-1.5 py-0.5 text-slate-900 bg-slate-100/70">Auction Number:</span>
            <span className="px-1.5 py-0.5 text-slate-900 font-mono font-medium truncate">{shortId}</span>
          </div>
          <div className="flex divide-x divide-slate-800">
            <span className="font-bold w-24 shrink-0 px-1.5 py-0.5 text-slate-900 bg-slate-100/70">Auction Type:</span>
            <span className="px-1.5 py-0.5 text-slate-900 truncate">
              {item.ra_number ? 'Reverse Auction (RA)' : 'O-General Bid'}
            </span>
          </div>
          <div className="flex divide-x divide-slate-800">
            <span className="font-bold w-24 shrink-0 px-1.5 py-0.5 text-slate-900 bg-slate-100/70">Department:</span>
            <span className="px-1.5 py-0.5 text-slate-900 truncate">{orgName}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCardHeader = () => {
    if (isGrid) {
      return (
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg shrink-0">
                <span className="text-xs font-semibold text-slate-500 font-mono">
                  Ref ID: {shortId}
                </span>
                <button
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-primary transition-colors shrink-0 p-0.5 rounded hover:bg-slate-200/60 cursor-pointer flex items-center justify-center"
                  title="Copy reference number to clipboard"
                  aria-label="Copy reference number"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {item.ra_number && (
              <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg shadow-2xs uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                RA Active
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-start">
            {hasDocument && (
              <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
                Tender Online
              </span>
            )}
            {item.quantity && (
              <span className="bg-blue-50 border border-blue-200/60 text-blue-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
                Qty: {item.quantity} Units
              </span>
            )}
            {signedDisplayImage && (
              <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
                Images Available
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg shrink-0">
            <span className="text-xs font-semibold text-slate-500 font-mono">
              Ref ID: {shortId}
            </span>
            <button
              onClick={handleCopy}
              className="text-slate-400 hover:text-primary transition-colors shrink-0 p-0.5 rounded hover:bg-slate-200/60 cursor-pointer flex items-center justify-center"
              title="Copy reference number to clipboard"
              aria-label="Copy reference number"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {item.ra_number && (
            <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg shadow-2xs uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              RA Active
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {hasDocument && (
            <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-3xs uppercase tracking-wide text-right shrink-0">
              Tender Online
            </span>
          )}
        </div>
      </div>
    );
  };

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!isGrid) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary/50 transition-all group relative">
        <div className="p-5 flex flex-col sm:flex-row gap-5 justify-between">
          {imageLoading ? (
            <div className="w-[120px] h-[120px] rounded-xl border border-slate-100 overflow-hidden shrink-0 bg-slate-100 animate-pulse hidden sm:block"></div>
          ) : signedDisplayImage ? (
            <div className="w-[120px] h-[120px] rounded-xl border border-slate-100 overflow-hidden shrink-0 bg-slate-50 relative hidden sm:block">
              <img
                src={signedDisplayImage}
                alt={item.items}
                loading="lazy"
                decoding="async"
                onError={() => setSignedDisplayImage(null)}
                onLoad={() => setHighResLoaded(true)}
                className={clsx(
                  "w-full h-full object-cover object-top transition-all duration-500 ease-out",
                  !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                  "group-hover:scale-[1.03]"
                )}
              />
            </div>
          ) : hasDocument ? (
            <div className="w-[120px] h-[120px] shrink-0 hidden sm:block">
              {renderDocumentSheetPreview()}
            </div>
          ) : (
            <div className="w-[120px] h-[120px] rounded-xl border border-slate-200 shrink-0 bg-slate-50 flex flex-col items-center justify-center text-slate-400 select-none hidden sm:flex gap-1.5">
              <FileText className="w-6 h-6 text-slate-400" />
              <span className="text-[9px] font-medium tracking-wide text-slate-500 text-center px-1.5 leading-tight">Refer the document</span>
            </div>
          )}

          <div className="flex-1 flex flex-col justify-between">
            <div>
              {renderCardHeader()}

              <div className="mb-3">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
                <h3 
                  onClick={() => onPreview(item)}
                  className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2 cursor-pointer" 
                  title={item.items}
                >
                  {item.items}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-slate-600" title={deptHierarchy}>
                    <span className="font-semibold text-slate-700 truncate text-base">
                      Office: {orgName}
                    </span>
                  </div>
                  <div className="flex items-center text-slate-600 gap-1.5 flex-wrap" title={locationDisplay}>
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">{locationDisplay}</span>
                  </div>
                </div>

                <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                  <div className="flex items-center text-slate-700">
                    <Layers className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span>Quantity: <strong className="text-slate-700 font-semibold">{item.quantity ? `${item.quantity} Units` : '1 Lot / Job'}</strong></span>
                  </div>
                  <div className="flex items-center text-slate-700">
                    <span className="flex items-center gap-1">
                      <span>Model: <strong className="text-slate-700 font-semibold">{item.ra_number ? `RA: ${item.ra_number}` : 'Direct Bid'}</strong></span>
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                  <div className="flex items-center text-slate-700">
                    <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span>Bidding Window: <strong className="text-slate-700 font-semibold">{biddingPeriodStr}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
              <div>
                {timeLeftBadge}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => onPreview(item)}
                  className="flex-grow sm:flex-none inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </button>

                {onInterestedToggle && (
                  <ButtonWithIconDemo
                    isInterested={isInterested}
                    onInterestedToggle={onInterestedToggle}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── GRID VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all group flex flex-col h-full relative">
      <div className="flex flex-col h-full p-5 justify-between">
        <div>
          {/* Card Document Preview / Image Header (Exact MSTC Catalogue Preview Style) */}
          <div className="h-[160px] w-full overflow-hidden rounded-xl border border-slate-100 mb-4 bg-slate-50 relative">
            {imageLoading ? (
              <div className="w-full h-full bg-slate-100 animate-pulse"></div>
            ) : signedDisplayImage ? (
              <img
                src={signedDisplayImage}
                alt={item.items}
                loading="lazy"
                decoding="async"
                onError={() => setSignedDisplayImage(null)}
                onLoad={() => setHighResLoaded(true)}
                className={clsx(
                  "w-full h-full object-cover object-top transition-all duration-500 ease-out",
                  !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                  "group-hover:scale-[1.02]"
                )}
              />
            ) : hasDocument ? (
              renderDocumentSheetPreview()
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 select-none bg-slate-50/50">
                <FileText className="w-8 h-8 text-slate-300" />
                <span className="text-[11px] font-medium tracking-wide text-slate-500">Refer the document</span>
              </div>
            )}
          </div>

          {renderCardHeader()}

          <div className="mb-3">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
            <h3 
              onClick={() => onPreview(item)}
              className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2 cursor-pointer" 
              title={item.items}
            >
              {item.items}
            </h3>
          </div>

          {/* Structured Metadata Grid */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs sm:text-sm">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Procuring Entity</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={deptHierarchy}>
                {orgName}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Location</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={locationDisplay}>
                {locationDisplay}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Quantity</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm">
                {item.quantity ? `${item.quantity} Units` : '1 Lot / Job'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Model</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm">
                {item.ra_number ? `RA: ${item.ra_number}` : 'Direct Bid'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5 col-span-2">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Portal Scheme</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                  <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:block w-52 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Government of India e-Marketplace Custom Procurement Tender.
                    <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title="GeM Procurement Tender (Government of India)">
                GeM Procurement Tender (Government of India)
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mb-4 text-sm text-slate-500 border-t border-slate-50 pt-3">
            <div className="flex justify-between">
              <span>Bidding Window:</span>
              <span className="font-semibold text-slate-700">
                {biddingPeriodStr}
              </span>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 mt-auto">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-medium">Auction Status</span>
            {timeLeftBadge}
          </div>

          <div className="flex gap-2 w-full mt-1">
            <button
              onClick={() => onPreview(item)}
              className="flex-grow inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </button>

            {onInterestedToggle && (
              <ButtonWithIconDemo
                isInterested={isInterested}
                onInterestedToggle={onInterestedToggle}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
