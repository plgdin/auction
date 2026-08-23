import { useState, useMemo, memo } from 'react';
import { Eye, MapPin, Building2, Calendar, Clock, Landmark, Copy, Check, Shield, Ruler, Info, Download } from 'lucide-react';
import { ButtonWithIconDemo } from '../ui/button-with-icon';
import type { BaanknetAuction } from '../../services/publicService';
import clsx from 'clsx';
import { useAppStore } from '../../store/appStore';
import { formatPrice, formatPriceString } from '../../utils/currency';

interface BaanknetCardProps {
  item: BaanknetAuction;
  isGrid?: boolean;
  onPreview: (item: BaanknetAuction) => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export const BaanknetCard = memo(function BaanknetCard({
  item,
  isGrid = true,
  onPreview,
  isInterested = false,
  onInterestedToggle,
}: BaanknetCardProps) {
  const { currency } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [highResLoaded, setHighResLoaded] = useState(false);

  const shortId = (item.baanknet_auction_id?.match(/\d+/)?.[0] || item.baanknet_auction_id || item.id?.substring(0, 8) || 'N/A').replace(/Asset.*$/i, '');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(shortId || item.baanknet_auction_id || item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Real property thumbnail if available from bank listing
  const displayImage = item.thumbnail_url || null;

  // Price formatting
  const formattedPrice = item.reserve_price_value
    ? formatPrice(item.reserve_price_value, currency)
    : (item.reserve_price_text ? formatPriceString(item.reserve_price_text, currency) : 'No Reserve Price');

  // Dates & Bidding Period
  const parseSafeDate = (dStr?: string | null): Date | null => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const startDate = parseSafeDate(item.auction_start_date);
  const endDate = parseSafeDate(item.auction_end_date);
  const now = new Date();

  const isClosed = (endDate && now > endDate) || item.auction_status === 'closed';
  const isStarted = (startDate && now >= startDate && (!endDate || now <= endDate)) || item.auction_status === 'live';

  const diffMs = startDate ? startDate.getTime() - now.getTime() : 0;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isUrgent = diffDays >= 0 && diffDays < 3;
  const isWarning = diffDays >= 3 && diffDays < 7;

  const timeLeftBadge = isClosed ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 bg-slate-50">
      Auction Closed
    </span>
  ) : isStarted ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-rose-50 animate-pulse flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
      </span>
      Live Bidding
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
      Upcoming Auction
    </span>
  );

  const biddingPeriodStr = useMemo(() => {
    if (!startDate && !endDate) return 'Contact Bank for Schedule';

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
      return `${startDay} - ${endDay}`;
    } else if (endDate) {
      return `Ends on ${formatDateOrdinal(endDate)} ${formatTimeAmpm(endDate)}`;
    } else if (startDate) {
      return `Starts ${formatDateOrdinal(startDate)}`;
    }
    return 'Contact Bank for Schedule';
  }, [startDate, endDate]);

  const rawTextBlob = `${item.title || ''} ${item.property_description || ''} ${item.raw_description || ''}`;
  const ibcClassMatch = rawTextBlob.match(/Asset\s*Classification\s*:?\s*([A-Za-z0-9\s&,/-]+?)(?=Fixed|Asset|Location|IP|Liquidator|Reserve|EMD|Price|Contact|$)/i);
  const ibcLocMatch = rawTextBlob.match(/(?:Fixed\s*Asset\s*Location|Asset\s*Location|Location)\s*:?\s*([A-Za-z0-9\s&,/-]+?)(?=IP|Liquidator|RP|Reserve|EMD|Price|Contact|Classification|$)/i);
  const ibcClassification = ibcClassMatch ? ibcClassMatch[1].replace(/Contact\s*Us/i, '').trim() : '';
  const ibcLocation = ibcLocMatch ? ibcLocMatch[1].replace(/Contact\s*Us/i, '').trim() : '';

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
        const isBank = (s?: string) => !s || s.toLowerCase().includes('bank') || s.toLowerCase().includes('showing');
        const loc = !isBank(item.city) ? ` in ${item.city}` : (ibcLocation ? ` in ${ibcLocation}` : '');
        return `${ibcClassification}${loc}`;
      }
      const area = item.carpet_area ? `${item.carpet_area} ` : '';
      const pType = item.property_type && item.property_type !== 'Bank Foreclosure Property' ? item.property_type : 'Bank Foreclosure Property';
      const isBank = (s?: string) => !s || s.toLowerCase().includes('bank') || s.toLowerCase().includes('showing');
      const loc = !isBank(item.city) ? ` in ${item.city}` : (!isBank(item.state) ? ` in ${item.state}` : '');
      return `${area}${pType}${loc}` || 'Bank Foreclosure Asset';
    }
    return item.title;
  }, [item.title, item.carpet_area, item.property_type, item.city, item.state, ibcClassification, ibcLocation]);

  const locationDisplay = useMemo(() => {
    const isBankOrGeneric = (s?: string) => {
      if (!s) return true;
      const lower = s.toLowerCase().trim();
      return lower === 'india' || lower.includes('bank') || lower.includes('showing') || lower.includes('lender') || lower.includes('result');
    };

    let titleCity = '';
    let titleState = '';
    if (item.title) {
      const match = item.title.match(/(?:for\s*sale\s*in|in|at)\s+([A-Za-z\s.-]+?),\s*([A-Za-z\s.-]+?)(?:$|\s*\(|\s*-)/i);
      if (match) {
        titleCity = match[1].trim();
        titleState = match[2].trim();
      } else {
        const single = item.title.match(/for\s*sale\s*in\s+([A-Za-z\s.-]+)$/i);
        if (single) {
          const parts = single[1].split(',').map(s => s.trim());
          titleCity = parts[0] || '';
          titleState = parts[1] || '';
        }
      }
    }

    const validCity = !isBankOrGeneric(item.city) ? item.city : titleCity;
    const validState = !isBankOrGeneric(item.state) ? item.state : (titleState || (!isBankOrGeneric(item.location) ? item.location : ''));
    const parts = [validCity, validState].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    if (ibcLocation) return ibcLocation;
    if (item.full_address && !isBankOrGeneric(item.full_address) && !item.full_address.includes('Asset Classification')) {
      return item.full_address.length > 35 ? `${item.full_address.slice(0, 35)}...` : item.full_address;
    }
    return 'India';
  }, [item.city, item.state, item.location, item.full_address, item.title, ibcLocation]);

  const mainCategory = item.property_type || 'Bank Property';

  const isArchived = Boolean(
    (item.stored_document_urls && item.stored_document_urls.length > 0) ||
    item.documents_archived
  );
  const primaryDocUrl = (item.stored_document_urls && item.stored_document_urls.length > 0)
    ? item.stored_document_urls[0]
    : (item.document_url || (item.document_urls && item.document_urls[0]));

  const downloadHref = primaryDocUrl
    ? (isArchived
        ? primaryDocUrl
        : `/api/document-proxy?url=${encodeURIComponent(primaryDocUrl)}&filename=Baanknet_Notice_${encodeURIComponent(item.baanknet_auction_id)}.pdf&disposition=attachment`)
    : undefined;

  const renderCardHeader = () => (
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
              title="Copy auction reference ID to clipboard"
              aria-label="Copy reference ID"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-md border tracking-wider shrink-0 uppercase text-indigo-700 bg-indigo-50 border-indigo-200">
            BaankNet Bank Auction
          </span>
          {item.bank_name && (
            <span className="text-[11px] font-bold text-slate-700 truncate max-w-[200px]" title={item.bank_name}>
              {item.bank_name}
            </span>
          )}
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
        {primaryDocUrl && (
          <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1 ${
            isArchived
              ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
              : "bg-slate-100 border border-slate-200 text-slate-700"
          }`}>
            {isArchived ? "Verified PDF" : "Notice PDF Available"}
          </span>
        )}
        {(item.emd_amount_text || item.emd_amount_value) && (
          <span className="bg-amber-50 border border-amber-200/80 text-amber-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            EMD: {item.emd_amount_text || `₹ ${item.emd_amount_value?.toLocaleString('en-IN')}`}
          </span>
        )}
        {item.title_type && (
          <span className="bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            {item.title_type}
          </span>
        )}
        {item.carpet_area && (
          <span className="bg-sky-50 border border-sky-200/60 text-sky-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            <Ruler className="w-2.5 h-2.5" /> {item.carpet_area}
          </span>
        )}
        {item.action_type && (
          <span className="bg-violet-50 border border-violet-200/60 text-violet-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> {item.action_type}
          </span>
        )}
        {item.cersai_id && (
          <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[9px] sm:text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
            CERSAI: {item.cersai_id.slice(0, 10)}...
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
            {displayImage && !imageError ? (
              <img
                src={displayImage}
                alt={item.title}
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
                <span className="text-[9px] font-medium tracking-wide text-slate-400 text-center px-1.5 leading-tight">No pictures available</span>
              </div>
            )}
          </div>

          {/* Details Content */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              {renderCardHeader()}

              <div className="mb-3">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
                <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={displayTitle}>
                  {displayTitle}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-slate-600" title={item.bank_name || 'Bank Auction'}>
                    <Landmark className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">
                      Bank: {item.bank_name || 'Public Sector Bank'}
                    </span>
                  </div>
                  <div className="flex items-center text-slate-600" title={locationDisplay}>
                    <MapPin className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">{locationDisplay}</span>
                  </div>
                  <div className="flex items-center text-slate-600" title={item.action_type || 'SARFAESI e-Auction'}>
                    <Shield className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">
                      Type: {item.action_type || 'SARFAESI e-Auction'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                  <div className="flex items-center text-slate-700">
                    <Building2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="flex items-center gap-1">
                      <span>Reserve Price: <strong className="text-slate-900 font-bold">{formattedPrice}</strong></span>
                      <div className="relative group/tooltip inline-block ml-0.5">
                        <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                        <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                          Minimum reserve price set by the lending bank.
                          <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                        </div>
                      </div>
                    </span>
                  </div>
                  <div className="flex items-center text-slate-700">
                    <Ruler className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span>Area: <strong className="text-slate-700 font-semibold">{item.carpet_area || 'As per tender document'}</strong></span>
                  </div>
                </div>

                <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                  <div className="flex items-center text-slate-700">
                    <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span>Bidding Window: <strong className="text-slate-700 font-semibold">{biddingPeriodStr}</strong></span>
                  </div>
                  {item.borrower_name && (
                    <div className="flex items-center text-slate-700">
                      <span className="text-slate-400 text-xs mr-2 shrink-0">Borrower:</span>
                      <span className="font-semibold text-slate-700 truncate">{item.borrower_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
              <div>
                {timeLeftBadge}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {downloadHref && (
                  <a
                    href={downloadHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`inline-flex justify-center items-center h-10 px-4 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                      isArchived
                        ? "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs"
                        : "text-slate-700 bg-slate-100 hover:bg-slate-200"
                    }`}
                    title={isArchived ? "Download Verified PDF (High-Speed Storage Mirror)" : "Download Auction Notice PDF"}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Notice PDF
                    {isArchived && (
                      <span className="ml-1.5 text-[9px] font-black bg-emerald-200/70 text-emerald-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                        CACHED
                      </span>
                    )}
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
            {displayImage && !imageError ? (
              <img
                src={displayImage}
                alt={item.title}
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
            <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={displayTitle}>
              {displayTitle}
            </h3>
          </div>

          {/* Structured Meta Grid */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs sm:text-sm">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Bank / Lender</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={item.bank_name || 'Bank Auction'}>
                {item.bank_name || 'Public Sector Bank'}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Location</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={locationDisplay}>
                {locationDisplay}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Reserve Price</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                  <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Starting reserve price for this property auction.
                    <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-bold text-slate-900 truncate text-xs sm:text-sm" title={formattedPrice}>
                {formattedPrice}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Carpet Area</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={item.carpet_area || 'As per catalog'}>
                {item.carpet_area || 'As per notice'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5 col-span-2">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Auction Framework</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                  <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:block w-52 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Legal framework under which the property is auctioned (e.g. SARFAESI, DRT, IBC).
                    <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={item.action_type || 'SARFAESI E-Auction'}>
                {item.action_type || 'SARFAESI e-Auction'}
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
            {item.borrower_name && (
              <div className="flex justify-between text-xs">
                <span>Borrower:</span>
                <span className="font-semibold text-slate-700 truncate max-w-[200px]">{item.borrower_name}</span>
              </div>
            )}
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
