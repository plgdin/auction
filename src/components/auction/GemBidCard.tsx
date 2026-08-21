import { useState, useMemo, memo } from 'react';
import { Eye, Building2, Calendar, Clock, Landmark, Copy, Check, Gavel, Info, Download, FileText, RefreshCw } from 'lucide-react';
import { ButtonWithIconDemo } from '../ui/button-with-icon';
import type { GemBid } from '../../services/publicService';
import { getGemItemImage } from '../../utils/gemImageResolver';
import clsx from 'clsx';

interface GemBidCardProps {
  item: GemBid;
  isGrid?: boolean;
  onPreview: (item: GemBid) => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export const GemBidCard = memo(function GemBidCard({
  item,
  isGrid = true,
  onPreview,
  isInterested = false,
  onInterestedToggle,
}: GemBidCardProps) {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [highResLoaded, setHighResLoaded] = useState(false);

  const shortId = item.bid_number || item.id?.substring(0, 8) || 'N/A';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.bid_number || item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const previewImage = getGemItemImage(item.items, item.category_name);

  // Dates & Bidding Period
  const parseSafeDate = (dStr?: string | null): Date | null => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const startDate = parseSafeDate(item.start_date);
  const endDate = parseSafeDate(item.end_date);
  const now = new Date();

  const isClosed = (endDate && now > endDate) || item.status === 'closed' || item.status === 'ended';
  const isStarted = (startDate && now >= startDate && (!endDate || now <= endDate)) || item.status === 'live';

  const diffMs = startDate ? startDate.getTime() - now.getTime() : 0;
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
      Live Bid
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
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 bg-blue-50">
      Active Bid
    </span>
  );

  const biddingPeriodStr = useMemo(() => {
    if (!startDate && !endDate) return 'See Official Tender Document';

    const formatDateOrdinal = (d: Date) => {
      try {
        const day = d.getDate();
        const month = d.toLocaleDateString(undefined, { month: 'short' });
        const year = d.getFullYear();
        let suffix = 'th';
        if (day < 11 || day > 13) {
          switch (day % 10) {
            case 1: suffix = 'st'; break;
            case 2: suffix = 'nd'; break;
            case 3: suffix = 'rd'; break;
          }
        }
        return `${day}${suffix} ${month} ${year}`;
      } catch {
        return '';
      }
    };

    const formatTimeAmpm = (d: Date) => {
      try {
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        return `${hours ? hours : 12}:${minutes} ${ampm}`;
      } catch {
        return '';
      }
    };

    if (startDate && endDate) {
      const startDay = formatDateOrdinal(startDate);
      const endDay = formatDateOrdinal(endDate);
      if (startDay === endDay) {
        return `${startDay} ${formatTimeAmpm(startDate)} - ${formatTimeAmpm(endDate)}`;
      }
      return `${startDay} - ${endDay} ${formatTimeAmpm(endDate)}`;
    } else if (endDate) {
      return `Ends on ${formatDateOrdinal(endDate)} ${formatTimeAmpm(endDate)}`;
    } else if (startDate) {
      return `Starts ${formatDateOrdinal(startDate)}`;
    }
    return 'See Official Tender Document';
  }, [startDate, endDate]);

  const deptName = item.department_name || 'Government Department / PSU';
  const mainCategory = item.category_name || 'GeM Procurement';

  const renderCardHeader = () => (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg shrink-0">
            <span className="text-xs font-semibold text-slate-500 font-mono">
              Bid ID: {shortId}
            </span>
            <button
              onClick={handleCopy}
              className="text-slate-400 hover:text-primary transition-colors shrink-0 p-0.5 rounded hover:bg-slate-200/60 cursor-pointer flex items-center justify-center"
              title="Copy GeM bid number to clipboard"
              aria-label="Copy bid number"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
            GeM Procurement
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg shadow-2xs uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            BETA
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 justify-start">
        {item.document_url && (
          <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            <FileText className="w-2.5 h-2.5" /> Bid Docs Available
          </span>
        )}
        {item.ra_number && (
          <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5" /> Reverse Auction (RA)
          </span>
        )}
        {item.corrigendum_urls && item.corrigendum_urls.length > 0 && (
          <span className="bg-purple-50 border border-purple-200/60 text-purple-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
            Corrigendum ({item.corrigendum_urls.length})
          </span>
        )}
      </div>
    </div>
  );

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!isGrid) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary/50 transition-all group relative">
        <div className="p-5 flex flex-col sm:flex-row gap-5 justify-between">
          
          {/* Thumbnail */}
          <div className="w-[120px] h-[120px] rounded-xl border border-slate-100 overflow-hidden shrink-0 bg-slate-50 relative hidden sm:block">
            {!imageError ? (
              <img
                src={previewImage}
                alt={item.items}
                loading="lazy"
                decoding="async"
                onError={() => setImageError(true)}
                onLoad={() => setHighResLoaded(true)}
                className={clsx(
                  "w-full h-full object-cover transition-all duration-500 ease-out",
                  !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                  "group-hover:scale-[1.03]"
                )}
              />
            ) : (
              <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-400 select-none gap-1.5">
                <Building2 className="w-6 h-6 text-slate-300" />
                <span className="text-[9px] font-medium tracking-wide text-slate-400 text-center px-1.5 leading-tight">No picture</span>
              </div>
            )}
          </div>

          {/* Details Content */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              {renderCardHeader()}

              <div className="mb-3">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
                <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.items}>
                  {item.items}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-slate-600" title={deptName}>
                    <Landmark className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">
                      Dept: {deptName}
                    </span>
                  </div>
                  <div className="flex items-center text-slate-600" title={item.quantity || 'As specified'}>
                    <Building2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">Qty: {item.quantity || '1 Unit / Lot'}</span>
                  </div>
                  <div className="flex items-center text-slate-600" title="GeM Procurement Tender">
                    <Gavel className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">
                      Type: Procurement Bid
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                  <div className="flex items-center text-slate-700">
                    <FileText className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="flex items-center gap-1">
                      <span>Bid Number: <strong className="text-slate-900 font-mono font-bold text-xs">{item.bid_number}</strong></span>
                      <div className="relative group/tooltip inline-block ml-0.5">
                        <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                        <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                          Official tender reference identifier on GeM BidPlus.
                          <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                        </div>
                      </div>
                    </span>
                  </div>
                  {item.ra_number && (
                    <div className="flex items-center text-slate-700">
                      <RefreshCw className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                      <span>RA Number: <strong className="text-slate-700 font-mono font-semibold text-xs">{item.ra_number}</strong></span>
                    </div>
                  )}
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
                {item.document_url && (
                  <a
                    href={item.document_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex justify-center items-center h-10 px-4 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                    title="Download GeM Bid Document PDF"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Bid PDF
                  </a>
                )}

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
          {/* Card Image Header */}
          <div className="h-[160px] w-full overflow-hidden rounded-xl border border-slate-100 mb-4 bg-slate-50 relative">
            {!imageError ? (
              <img
                src={previewImage}
                alt={item.items}
                loading="lazy"
                decoding="async"
                onError={() => setImageError(true)}
                onLoad={() => setHighResLoaded(true)}
                className={clsx(
                  "w-full h-full object-cover transition-all duration-500 ease-out",
                  !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                  "group-hover:scale-[1.02]"
                )}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 select-none bg-slate-50/50">
                <Building2 className="w-8 h-8 text-slate-300" />
                <span className="text-[11px] font-medium tracking-wide">No pictures available</span>
              </div>
            )}
          </div>

          {renderCardHeader()}

          <div className="mb-3">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
            <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.items}>
              {item.items}
            </h3>
          </div>

          {/* Structured Meta Grid */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs sm:text-sm">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Department / Buyer</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={deptName}>
                {deptName}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Quantity</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={item.quantity || 'As specified'}>
                {item.quantity || '1 Unit / Lot'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Bid Number</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                  <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Official Bid Number on GeM.
                    <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-bold text-slate-900 truncate font-mono text-xs" title={item.bid_number}>
                {item.bid_number}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">RA Number</span>
              <span className="font-semibold text-slate-700 truncate text-xs font-mono" title={item.ra_number || 'Direct Bidding'}>
                {item.ra_number || 'Direct Bidding'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5 col-span-2">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Portal Scheme</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                  <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:block w-52 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Official Government e-Marketplace (GeM BidPlus / BidNext) procurement notice and reverse auction.
                    <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm">
                GeM Procurement & Reverse Auction
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
            <span className="text-xs text-slate-400 font-medium">Bidding Window</span>
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

            {item.document_url && (
              <a
                href={item.document_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex justify-center items-center h-10 px-3.5 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer shrink-0"
                title="Download GeM Bid Document PDF"
              >
                <Download className="w-4 h-4" />
              </a>
            )}

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
