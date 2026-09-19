import { useState, useMemo, memo } from 'react';
import { 
  Eye, 
  Building2, 
  Calendar, 
  Clock, 
  Landmark, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  FileCheck2
} from 'lucide-react';
import { ButtonWithIconDemo } from '../ui/button-with-icon';
import type { GemBid } from '../../services/publicService';
import clsx from 'clsx';
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

const gemPortalUrl = (bidNumber: string): string =>
  `https://bidplus.gem.gov.in/showbidDocument/${encodeURIComponent(bidNumber)}`;

const isCdnUrl = (url?: string | null): boolean =>
  Boolean(url && url.includes('supabase.co'));

const getDocUrl = (item: GemBid): string => {
  if (isCdnUrl(item.document_url)) return item.document_url!;
  const rawUrl = item.document_url || gemPortalUrl(item.bid_number);
  const bidSafe = item.bid_number.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `/api/document-proxy?url=${encodeURIComponent(rawUrl)}&filename=GeM_Bid_${bidSafe}.pdf&disposition=attachment`;
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
  const [imgLoaded, setImgLoaded] = useState(false);
  const shortId = item.bid_number || item.id?.substring(0, 8) || 'N/A';
  const cleanBidId = item.bid_number.replace(/[^a-zA-Z0-9_-]/g, '_');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.bid_number || item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Only use authentic uploaded images/scans from Supabase Storage — never generic stock photos
  const authenticImage = useMemo(() => {
    const rawUrl = (item as any).preview_url || (item as any).image_url;
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    if (
      rawUrl.includes('unsplash.com') ||
      rawUrl.includes('pexels.com') ||
      rawUrl.includes('pixabay.com') ||
      rawUrl.includes('freepik.com') ||
      rawUrl.includes('stock') ||
      rawUrl.includes('placeholder')
    ) {
      return null;
    }
    // Only allow verified Supabase Storage assets, government portal media, or data URIs
    if (!rawUrl.includes('supabase.co') && !rawUrl.includes('gem.gov.in') && !rawUrl.startsWith('data:image/')) {
      return null;
    }
    return rawUrl;
  }, [item]);

  // ── Date & status calculations ─────────────────────────────────────────────
  const startDate = parseSafeDate(item.start_date);
  const endDate = parseSafeDate(item.end_date);
  const now = new Date();

  const isClosed = (endDate && now > endDate) || item.status === 'closed' || item.status === 'ended';
  const isStarted = !isClosed && ((startDate && now >= startDate && (!endDate || now <= endDate)) || item.status === 'live');

  const diffMs = endDate ? endDate.getTime() - now.getTime() : 0;
  const diffHoursTotal = Math.floor(diffMs / (1000 * 60 * 60));

  const isUrgent = !isClosed && isStarted && diffHoursTotal >= 0 && diffHoursTotal <= 48;

  // Status Badge Component
  const renderStatusBadge = () => {
    if (isClosed) {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-slate-200 text-slate-500 bg-slate-50">
          <Clock className="w-3 h-3 text-slate-400" />
          Closed
        </span>
      );
    }
    if (isUrgent) {
      return (
        <span className="inline-flex items-center gap-1.5 font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-rose-200 text-rose-700 bg-rose-50/90 shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          Ending in {diffHoursTotal}h
        </span>
      );
    }
    if (isStarted) {
      return (
        <span className="inline-flex items-center gap-1.5 font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50/90 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Tender
        </span>
      );
    }
    if (startDate && now < startDate) {
      const startDiffMs = startDate.getTime() - now.getTime();
      const startDays = Math.floor(startDiffMs / (1000 * 60 * 60 * 24));
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-blue-200 text-blue-700 bg-blue-50/80">
          <Calendar className="w-3 h-3 text-blue-500" />
          Starts in {startDays > 0 ? `${startDays}d` : 'today'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-slate-200 text-slate-600 bg-slate-50">
        GeM Bid
      </span>
    );
  };

  const biddingPeriodStr = useMemo(() => {
    if (!startDate && !endDate) return 'See Official Tender Document';
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

  const mainCategory = cleanCategoryName(item.category_name, item.items);
  const deptHierarchy = [item.ministry, item.department || item.department_name, item.organisation].filter(Boolean).join(' › ') || 'Govt of India';
  const fullOrgDetails = [item.ministry, item.department || item.department_name, item.organisation, (item as any).office].filter(Boolean).join(' / ');
  const docUrl = getDocUrl(item);
  const hasCachedDoc = isCdnUrl(item.document_url);

  // Shared Card Header
  const renderCardHeader = () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Bid Number Pill */}
          <div className="flex items-center gap-1 bg-slate-900 text-slate-100 px-2.5 py-1 rounded-lg shrink-0 shadow-2xs">
            <span className="text-[11px] font-bold font-mono tracking-tight text-white select-all">
              {shortId}
            </span>
            <button
              onClick={handleCopy}
              className="text-slate-400 hover:text-white transition-colors p-0.5 rounded cursor-pointer"
              title="Copy GeM Bid Number"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/25 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
            <Sparkles className="w-2.5 h-2.5 text-blue-600" />
            Procurement
          </span>

          {item.ra_number && (
            <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
              <RefreshCw className="w-2.5 h-2.5" /> RA Active
            </span>
          )}
        </div>

        <div>
          {renderStatusBadge()}
        </div>
      </div>

      {/* Feature Badges */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {hasCachedDoc ? (
          <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-3xs">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Verified Tender PDF
          </span>
        ) : item.document_url ? (
          <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-md shadow-3xs">
            <FileText className="w-3 h-3 text-slate-500" />
            Portal Notice
          </span>
        ) : null}

        {item.quantity && (
          <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-3xs">
            <Building2 className="w-2.5 h-2.5 text-blue-600" />
            {item.quantity} Units
          </span>
        )}

        {item.corrigendum_urls && item.corrigendum_urls.length > 0 && (
          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-3xs">
            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
            {item.corrigendum_urls.length} Corrigendum
          </span>
        )}
      </div>
    </div>
  );

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!isGrid) {
    return (
      <div className="group relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-primary/50 transition-all duration-300 overflow-hidden flex flex-col md:flex-row justify-between">
        {/* Scanned authentic preview only if genuine asset exists in storage */}
        {authenticImage && (
          <div 
            onClick={() => onPreview(item)}
            className="relative w-full md:w-56 lg:w-64 h-44 md:h-auto shrink-0 overflow-hidden bg-slate-900 cursor-pointer select-none border-b md:border-b-0 md:border-r border-slate-200/80"
          >
            <img
              src={authenticImage}
              alt={item.items}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              className={clsx(
                "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out",
                imgLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}

        <div className="p-5 flex-1 flex flex-col lg:flex-row gap-5 justify-between">
          <div className="flex-1 flex flex-col justify-between space-y-3 min-w-0">
            <div>
              {renderCardHeader()}

              <div className="mt-2.5">
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {mainCategory}
                </div>
                <h3 
                  onClick={() => onPreview(item)}
                  className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-2 leading-snug cursor-pointer" 
                  title={item.items}
                >
                  {item.items}
                </h3>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50/80 border border-slate-100 rounded-xl p-3">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Landmark className="w-3 h-3 text-slate-500" />
                  Procuring Entity
                </span>
                <p className="font-bold text-slate-800 truncate text-[11px]" title={fullOrgDetails}>
                  {deptHierarchy}
                </p>
              </div>

              <div className="space-y-0.5 min-w-0 sm:border-l sm:border-slate-200/60 sm:pl-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-500" />
                  Lot Quantity
                </span>
                <p className="font-bold text-slate-800 truncate text-[11px]">
                  {item.quantity ? `${item.quantity} Units` : '1 Lot / Job'}
                </p>
              </div>

              <div className="space-y-0.5 min-w-0 sm:border-l sm:border-slate-200/60 sm:pl-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 text-slate-500" />
                  Procurement Model
                </span>
                <p className="font-bold text-slate-900 truncate text-xs">
                  {item.ra_number ? `RA: ${item.ra_number}` : 'Direct Portal Bid'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Action Dock */}
          <div className="lg:w-48 shrink-0 flex flex-row lg:flex-col justify-between lg:justify-center items-center lg:items-end gap-2.5 border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-5">
            <div className="hidden lg:block text-right w-full">
              <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">Timeline</span>
              <span className="text-xs font-bold text-slate-800 block truncate" title={biddingPeriodStr}>
                {biddingPeriodStr}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full justify-end">
              <a
                href={docUrl}
                download={`GeM_Bid_${cleanBidId}.pdf`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex justify-center items-center h-9 px-3 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-all border border-slate-200 shrink-0 cursor-pointer shadow-3xs"
                title="Download Official Government Tender PDF"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
              </a>

              <button
                onClick={() => onPreview(item)}
                className="flex-1 lg:w-full inline-flex justify-center items-center h-9 px-4 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/95 shadow-md shadow-primary/20 transition-all active:scale-95 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Inspect Bid
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
  }

  // ─── GRID VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden">
      {/* Top Accent Line (Color-coded by Bid State) */}
      <div 
        className={clsx(
          "h-1.5 w-full shrink-0 transition-colors",
          isUrgent ? "bg-rose-500" : isStarted ? "bg-emerald-500" : isClosed ? "bg-slate-300" : "bg-blue-600"
        )} 
      />

      {/* Scanned authentic preview only if genuine asset exists in storage */}
      {authenticImage && (
        <div 
          onClick={() => onPreview(item)}
          className="relative h-40 w-full shrink-0 overflow-hidden bg-slate-900 cursor-pointer select-none border-b border-slate-100"
        >
          <img
            src={authenticImage}
            alt={item.items}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            className={clsx(
              "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      )}

      {/* Card Body */}
      <div className="flex flex-col flex-1 p-4 justify-between">
        <div>
          {renderCardHeader()}

          {/* Category & Title */}
          <div className="mt-3 mb-2.5">
            <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {mainCategory}
            </div>
            <h3 
              onClick={() => onPreview(item)}
              className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-2 leading-snug cursor-pointer" 
              title={item.items}
            >
              {item.items}
            </h3>
          </div>

          {/* Department & Entity Box */}
          <div className="bg-gradient-to-br from-slate-50 via-slate-50/80 to-blue-50/30 border border-slate-200/80 rounded-xl p-3 mb-3">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
              Procuring Entity & Ministry
            </span>
            <div className="text-xs font-bold text-slate-800 line-clamp-1" title={fullOrgDetails}>
              {deptHierarchy}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="bg-slate-50/90 border border-slate-100 rounded-xl p-3 mb-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-medium text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5 text-slate-400" /> Quantity
              </span>
              <span className="font-bold text-slate-800 truncate text-[11px]">
                {item.quantity ? `${item.quantity} Units` : '1 Lot / Job'}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-medium text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <FileCheck2 className="w-2.5 h-2.5 text-slate-400" /> Notice
              </span>
              <span className="font-bold text-emerald-800 truncate text-[11px]">
                {hasCachedDoc ? 'Verified Tender' : 'Portal Document'}
              </span>
            </div>

            {item.ra_number && (
              <div className="flex flex-col min-w-0 border-t border-slate-200/50 pt-1.5 col-span-2 sm:col-span-1">
                <span className="text-slate-400 font-medium text-[9px] uppercase tracking-wider mb-0.5">
                  Reverse Auction
                </span>
                <span className="font-bold text-indigo-700 text-[10px] truncate">
                  RA: {item.ra_number}
                </span>
              </div>
            )}

            {item.corrigendum_urls && item.corrigendum_urls.length > 0 && (
              <div className="flex flex-col min-w-0 border-t border-slate-200/50 pt-1.5 col-span-2 sm:col-span-1">
                <span className="text-slate-400 font-medium text-[9px] uppercase tracking-wider mb-0.5">
                  Updates
                </span>
                <span className="font-bold text-amber-700 text-[10px]">
                  {item.corrigendum_urls.length} Corrigendum
                </span>
              </div>
            )}
          </div>

          {/* Timeline Row */}
          <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-100 pt-2 mb-1">
            <span className="text-slate-400 flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3 text-slate-400" /> Window:
            </span>
            <span className="font-semibold text-slate-800 truncate text-right pl-2" title={biddingPeriodStr}>
              {biddingPeriodStr}
            </span>
          </div>
        </div>

        {/* Action Dock */}
        <div className="pt-3 border-t border-slate-100 flex items-center gap-2 mt-auto">
          <a
            href={docUrl}
            download={`GeM_Bid_${cleanBidId}.pdf`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex justify-center items-center h-9 px-2.5 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-all border border-slate-200 shrink-0 cursor-pointer shadow-3xs"
            title="Download Official Government Tender PDF"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
          </a>

          <button
            onClick={() => onPreview(item)}
            className="flex-1 inline-flex justify-center items-center h-9 px-4 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/95 shadow-md shadow-primary/20 transition-all active:scale-95 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Inspect Bid
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
  );
});


