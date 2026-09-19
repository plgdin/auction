import { useState, useMemo, memo } from 'react';
import { Eye, Building2, Calendar, Clock, Landmark, Copy, Check, Info, Download, FileText, RefreshCw } from 'lucide-react';
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

/** Official GeM BidPlus page for a given bid number. */
const gemPortalUrl = (bidNumber: string): string =>
  `https://bidplus.gem.gov.in/showbidDocument/${encodeURIComponent(bidNumber)}`;

const isCdnUrl = (url?: string | null): boolean =>
  Boolean(url && url.includes('supabase.co'));

/** Returns the download URL — prefers our CDN copy, falls back to GeM portal. */
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
  const shortId = item.bid_number || item.id?.substring(0, 8) || 'N/A';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.bid_number || item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Date & status computation ──────────────────────────────────────────────
  const startDate = parseSafeDate(item.start_date);
  const endDate = parseSafeDate(item.end_date);
  const now = new Date();

  const isClosed = (endDate && now > endDate) || item.status === 'closed' || item.status === 'ended';
  const isStarted = !isClosed && ((startDate && now >= startDate && (!endDate || now <= endDate)) || item.status === 'live');

  const diffMs = startDate ? startDate.getTime() - now.getTime() : 0;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isUrgent = diffDays >= 0 && diffDays < 3;
  const isWarning = diffDays >= 3 && diffDays < 7;

  const timeLeftBadge = isClosed ? (
    <span className="font-bold text-[10px] px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 bg-slate-50">
      Bid Closed
    </span>
  ) : isStarted ? (
    <span className="font-bold text-[10px] px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-rose-50 animate-pulse flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
      </span>
      Live Bid
    </span>
  ) : startDate ? (
    <span className={clsx(
      "font-bold text-[10px] px-2.5 py-1 rounded-md border flex items-center gap-1",
      isUrgent ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" :
        isWarning ? "text-amber-700 bg-amber-50 border-amber-200" :
          "text-emerald-700 bg-emerald-50 border-emerald-200"
    )}>
      <Clock className="w-3 h-3" />
      Starts in {diffDays}d {diffHours}h
    </span>
  ) : (
    <span className="font-bold text-[10px] px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 bg-blue-50">
      Active Bid
    </span>
  );

  const biddingPeriodStr = useMemo(() => {
    if (!startDate && !endDate) return 'See Official Tender Document';

    if (startDate && endDate) {
      const startDay = formatDateOrdinal(startDate);
      const endDay = formatDateOrdinal(endDate);
      if (startDay === endDay) {
        return `${startDay} ${formatTimeAmpm(startDate)} - ${formatTimeAmpm(endDate)}`;
      }
      return `${startDay} - ${endDay} ${formatTimeAmpm(endDate)}`;
    }
    if (endDate) return `Ends on ${formatDateOrdinal(endDate)} ${formatTimeAmpm(endDate)}`;
    if (startDate) return `Starts ${formatDateOrdinal(startDate)}`;
    return 'See Official Tender Document';
  }, [startDate, endDate]);

  const deptHierarchy = [item.ministry, item.organisation || item.department_name].filter(Boolean).join(' • ') || 'Government Department / PSU';
  const fullOrgDetails = [item.ministry, item.department_name, item.organisation, item.full_address].filter(Boolean).join('\n');
  const mainCategory = cleanCategoryName(item.category_name, item.items);
  const docUrl = getDocUrl(item);
  const hasCachedDoc = isCdnUrl(item.document_url);

  // ── Card Header (shared) ───────────────────────────────────────────────────
  const renderCardHeader = () => (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 bg-slate-900 text-white px-2.5 py-1 rounded-lg shrink-0 shadow-3xs">
            <span className="text-[10px] font-bold font-mono tracking-tight">
              {shortId}
            </span>
            <button
              onClick={handleCopy}
              className="text-slate-400 hover:text-white transition-colors shrink-0 p-0.5 rounded cursor-pointer flex items-center justify-center"
              title="Copy GeM bid number"
              aria-label="Copy bid number"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
            GeM Procurement
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 justify-start">
        {hasCachedDoc ? (
          <span className="bg-emerald-50 border border-emerald-300 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            <FileText className="w-2.5 h-2.5 text-emerald-600" /> Official PDF (Verified)
          </span>
        ) : item.document_url ? (
          <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            <FileText className="w-2.5 h-2.5" /> Bid Docs Available
          </span>
        ) : null}
        {item.ra_number && (
          <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5" /> RA: {item.ra_number}
          </span>
        )}
        {item.corrigendum_urls && item.corrigendum_urls.length > 0 && (
          <span className="bg-purple-50 border border-purple-200/60 text-purple-700 text-[9px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
            Corrigendum ({item.corrigendum_urls.length})
          </span>
        )}
      </div>
    </div>
  );

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!isGrid) {
    return (
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden hover:shadow-md hover:border-primary/60 transition-all group relative">
        <div className="p-5 flex flex-col sm:flex-row gap-5 justify-between">

          {/* Details Content */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              {renderCardHeader()}

              <div className="mb-3">
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
                <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2 leading-snug" title={item.items}>
                  {item.items}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center text-slate-600" title={fullOrgDetails}>
                    <Landmark className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate">{deptHierarchy}</span>
                  </div>
                  <div className="flex items-center text-slate-600">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate">Quantity: <strong className="text-slate-900">{item.quantity || '1 Unit / Lot'}</strong></span>
                  </div>
                </div>

                <div className="space-y-1.5 border-l border-slate-100 pl-3">
                  <div className="flex items-center text-slate-700">
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                    <span className="flex items-center gap-1">
                      <span>Bid: <strong className="text-slate-900 font-mono font-bold text-[10px]">{item.bid_number}</strong></span>
                    </span>
                  </div>
                  {item.ra_number && (
                    <div className="flex items-center text-slate-700">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                      <span>RA: <strong className="text-slate-700 font-mono font-semibold text-[10px]">{item.ra_number}</strong></span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 border-l border-slate-100 pl-3">
                  <div className="flex items-center text-slate-700">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700">{biddingPeriodStr}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto">
              <div>{timeLeftBadge}</div>

              <div className="flex gap-2 w-full sm:w-auto">
                <a
                  href={docUrl}
                  download={`GeM_Bid_${item.bid_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex justify-center items-center h-9 px-3.5 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer gap-1.5 border border-slate-200"
                  title="Download Official Government Bid PDF"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  <span>Official PDF</span>
                </a>

                <button
                  onClick={() => onPreview(item)}
                  className="flex-grow sm:flex-none inline-flex justify-center items-center h-9 px-4 rounded-full text-xs font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-xs transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
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
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden hover:shadow-lg hover:border-primary/60 transition-all group flex flex-col h-full relative">
      <div className="flex flex-col h-full p-4 justify-between">
        <div>
          {renderCardHeader()}

          <div className="mb-3">
            <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
            <h3 className="text-base font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2 leading-snug" title={item.items}>
              {item.items}
            </h3>
          </div>

          {/* Meta Grid */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Organisation</span>
              <span className="font-semibold text-slate-700 truncate text-[11px]" title={fullOrgDetails}>
                {deptHierarchy}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Quantity</span>
              <span className="font-semibold text-slate-700 truncate text-[11px]">
                {item.quantity || '1 Unit / Lot'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2">
              <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Bid Number</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-2.5 h-2.5 text-slate-400 hover:text-blue-500 transition-colors cursor-help shrink-0" />
                  <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-44 p-2 bg-slate-900 text-white text-[9px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Official Bid Number on GeM.
                    <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-bold text-slate-900 truncate font-mono text-[10px]" title={item.bid_number}>
                {item.bid_number}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2">
              <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">RA Number</span>
              <span className="font-semibold text-slate-700 truncate text-[10px] font-mono">
                {item.ra_number || 'Direct Bidding'}
              </span>
            </div>
          </div>

          <div className="space-y-1 mb-3 text-xs text-slate-500 border-t border-slate-50 pt-2.5">
            <div className="flex justify-between">
              <span className="text-[10px]">Bidding Window:</span>
              <span className="font-semibold text-slate-700 text-[10px]">
                {biddingPeriodStr}
              </span>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5 mt-auto">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-medium">Status</span>
            {timeLeftBadge}
          </div>

          <div className="flex gap-2 w-full">
            <a
              href={docUrl}
              download={`GeM_Bid_${item.bid_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex justify-center items-center h-9 px-3 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer border border-slate-200 shrink-0"
              title="Download Official Government Bid PDF"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
            </a>

            <button
              onClick={() => onPreview(item)}
              className="flex-grow inline-flex justify-center items-center h-9 px-4 rounded-full text-xs font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-xs transition-all duration-200 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              View Details
            </button>

            <ButtonWithIconDemo
              isInterested={isInterested}
              onInterestedToggle={onInterestedToggle}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
