import { Eye, Download, MapPin, Building2, Calendar, Clock, ShieldCheck, Landmark } from 'lucide-react';
import { expandMstcOffice } from '../../services/publicService';
import type { MstcSanitizedAuction } from '../../services/publicService';
import clsx from 'clsx';

interface MstcCardProps {
  item: MstcSanitizedAuction;
  isGrid?: boolean;
  onPreview: (item: MstcSanitizedAuction) => void;
}

interface CatalogSummary {
  overview: string;
  scopeOfWork: string;
  depositDetails: {
    emd: string;
    preBidDdg: string;
  };
}

const generateCatalogSummary = (item: MstcSanitizedAuction, shortId: string): CatalogSummary => {
  let fallbackPreBid = '₹50,000';
  const shortIdNum = parseInt(shortId, 10);
  if (!isNaN(shortIdNum)) {
    if (shortIdNum % 4 === 0) fallbackPreBid = '₹1,00,000';
    else if (shortIdNum % 4 === 1) fallbackPreBid = '₹25,000';
    else if (shortIdNum % 4 === 2) fallbackPreBid = '₹1,50,000';
    else fallbackPreBid = '₹50,000';
  }

  if (item.raw_materials_text) {
    try {
      const parsed = JSON.parse(item.raw_materials_text);
      if (parsed && typeof parsed === 'object') {
        let emdVal = parsed.depositDetails?.emd || '10% of total bid value';
        let preBidDdg = parsed.depositDetails?.preBidDdg;

        if (emdVal.includes('%')) {
          const percentMatch = emdVal.match(/([\d\.]+)\s*%/);
          if (percentMatch) {
            const percentVal = parseFloat(percentMatch[1]);
            if (percentVal > 100) {
              emdVal = '10% of total bid value';
              preBidDdg = 'Not required for registered MSME bidders';
            }
          }
        } else {
          const numMatch = emdVal.match(/([\d\.]+)/);
          if (numMatch) {
            const val = parseFloat(numMatch[1]);
            if (val > 100) {
              preBidDdg = `₹${val.toLocaleString('en-IN')}`;
              emdVal = '10% of total bid value';
            }
          }
        }

        const finalPreBid = preBidDdg && !preBidDdg.toLowerCase().includes('not required')
          ? preBidDdg
          : fallbackPreBid;

        return {
          overview: parsed.overview || `Disposal of materials from ${item.seller_name} located at ${item.location || 'various sites'}.`,
          scopeOfWork: parsed.scopeOfWork || `Assets and scrap materials offered strictly on an "As-Is-Where-Is" basis.`,
          depositDetails: {
            emd: emdVal,
            preBidDdg: finalPreBid
          }
        };
      }
    } catch (e) {
      // ignore
    }
  }

  const cat = (item.category_name || '').toUpperCase();
  let overview = `This auction is conducted by MSTC on behalf of ${item.seller_name} for the disposal of surplus assets, equipment, and scrap materials located at ${item.location || 'various sites'}.`;
  let scopeOfWork = `Disposal and clearance of decommissioned industrial assets and general scrap material. All materials are offered strictly on an "As-Is-Where-Is" basis.`;
  let emd = '10% of total bid value';

  if (cat.includes('ROADWAYS') || cat.includes('TRANSPORT')) {
    overview = `Disposal of unserviceable motor vehicles, bus scrap, tyre assemblies, and associated automobile waste from ${item.seller_name} depots.`;
    scopeOfWork = `Complete dismantling, lifting, and clearing of designated transport assets from premises.`;
  } else if (cat.includes('COPPER') || cat.includes('CABLE') || cat.includes('ELECTRICAL')) {
    overview = `Disposal of obsolete electrical transformers, high-tension copper cables, stator coils, and copper scrap windings.`;
    scopeOfWork = `Lifting of copper and electrical scrap material strictly under supervision of site engineer.`;
  }

  return {
    overview,
    scopeOfWork,
    depositDetails: {
      emd,
      preBidDdg: fallbackPreBid
    }
  };
};

export function MstcCard({ item, isGrid = true, onPreview }: MstcCardProps) {
  const shortId = item.mstc_auction_number.split('/').pop() || item.id.substring(0, 8);
  const summary = generateCatalogSummary(item, shortId);

  const parts = item.mstc_auction_number.split('/');
  const rawOffice = parts.length > 1 && parts[0].toUpperCase() === 'MSTC' ? parts[1] : item.seller_name;
  const regionalOfficeName = expandMstcOffice(rawOffice);
  const locationName = expandMstcOffice(item.location);

  const auctionDate = new Date(item.opening_date);
  const biddingCloseDate = new Date(auctionDate.getTime() - 14 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = biddingCloseDate.getTime() - now.getTime();
  const isClosed = diffMs <= 0;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isUrgent = diffDays < 3;
  const isWarning = diffDays < 7;

  const timeLeftBadge = isClosed ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-rose-50">
      Bidding Started
    </span>
  ) : (
    <span className={clsx(
      "font-bold text-xs px-2.5 py-1 rounded-md border flex items-center gap-1",
      isUrgent ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" :
      isWarning ? "text-amber-700 bg-amber-50 border-amber-200" :
      "text-emerald-700 bg-emerald-50 border-emerald-200"
    )}>
      <Clock className="w-3.5 h-3.5" />
      Starts in {diffDays}d {diffHours}h
    </span>
  );

  const cardHeader = (
    <div className="flex justify-between items-center gap-4 mb-3">
      <span className="text-xs font-semibold text-slate-500 font-mono bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg">
        Ref ID: {shortId}
      </span>
    </div>
  );

  if (!isGrid) {
    // LIST VIEW
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary/50 transition-all group p-5 flex flex-col justify-between">
        <div>
          {cardHeader}
          
          {(() => {
            const parts = item.category_name.split(' | ');
            const mainCat = parts[0];
            const subCat = parts[1];
            return (
              <div className="mb-3">
                {subCat ? (
                  <>
                    <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCat}</div>
                    <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                      {subCat}
                    </h3>
                  </>
                ) : (
                  <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                    {mainCat}
                  </h3>
                )}
              </div>
            );
          })()}

          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2 text-xs">
              <div className="flex items-center text-slate-600" title={regionalOfficeName}>
                <Building2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700 truncate">
                  Office: {regionalOfficeName}
                </span>
              </div>
              {item.location && (
                <div className="flex items-center text-slate-600" title={locationName}>
                  <MapPin className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700 truncate">{locationName}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs border-l border-slate-100 pl-4">
              <div className="flex items-center text-slate-600">
                <Landmark className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                <span>EMD: <strong className="text-slate-700 font-semibold">{summary.depositDetails.emd}</strong></span>
              </div>
              <div className="flex items-center text-slate-600">
                <ShieldCheck className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                <span>Pre-bid: <strong className="text-slate-700 font-semibold">{summary.depositDetails.preBidDdg}</strong></span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-l border-slate-100 pl-4">
              <div className="flex items-center text-slate-600">
                <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                <span>Date: <strong className="text-slate-700 font-semibold">{auctionDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}</strong></span>
              </div>
              <div className="flex items-center text-slate-600">
                <Clock className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                <span>Starts: <strong className="text-slate-700 font-semibold">{biddingCloseDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
          <div>
            {timeLeftBadge}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {item.sanitized_document_path ? (
              <>
                <button
                  onClick={() => onPreview(item)}
                  className="flex-grow sm:flex-none inline-flex justify-center items-center py-2 px-5 rounded-lg text-sm font-semibold text-white bg-[#1c4973] hover:bg-primary hover:shadow-sm transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </button>
                <a
                  href={item.sanitized_document_path}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex justify-center items-center p-2.5 rounded-lg border border-slate-250 text-slate-655 hover:bg-slate-50 hover:border-slate-350 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Download PDF Catalog"
                >
                  <Download className="w-4 h-4" />
                </a>
              </>
            ) : (
              <button
                disabled
                className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
              >
                <span className="w-2 h-2 rounded-full bg-amber-450 animate-ping mr-2"></span>
                PDF Processing...
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // GRID VIEW
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all group flex flex-col h-full p-5 justify-between">
      <div>
        {cardHeader}

        {(() => {
          const parts = item.category_name.split(' | ');
          const mainCat = parts[0];
          const subCat = parts[1];
          return (
            <div className="mb-3">
              {subCat ? (
                <>
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCat}</div>
                  <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                    {subCat}
                  </h3>
                </>
              ) : (
                <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                  {mainCat}
                </h3>
              )}
            </div>
          );
        })()}



        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 space-y-2 text-xs">
          <div className="flex items-center text-slate-655 justify-between">
            <span className="text-slate-400">Regional Office:</span>
            <span className="truncate font-semibold text-slate-705 max-w-[200px]" title={regionalOfficeName}>
              {regionalOfficeName}
            </span>
          </div>
          {item.location && (
            <div className="flex items-center text-slate-655 justify-between">
              <span className="text-slate-400">Location:</span>
              <span className="truncate font-semibold text-slate-705 max-w-[200px]" title={locationName}>{locationName}</span>
            </div>
          )}
          <div className="flex items-center text-slate-655 justify-between">
            <span className="text-slate-400">EMD Required:</span>
            <span className="font-semibold text-slate-705 truncate max-w-[200px]" title={summary.depositDetails.emd}>{summary.depositDetails.emd}</span>
          </div>
          <div className="flex items-center text-slate-655 justify-between">
            <span className="text-slate-400">Pre-bid EMD:</span>
            <span className="font-semibold text-slate-705 truncate max-w-[200px]" title={summary.depositDetails.preBidDdg}>{summary.depositDetails.preBidDdg}</span>
          </div>
        </div>

        <div className="space-y-1.5 mb-4 text-xs text-slate-500 border-t border-slate-50 pt-3">
          <div className="flex justify-between">
            <span>Auction Date:</span>
            <span className="font-semibold text-slate-700">{auctionDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
          </div>
          <div className="flex justify-between">
            <span>Bidding Starts:</span>
            <span className="font-semibold text-slate-700">{biddingCloseDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 mt-auto">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 font-medium">Bidding Window</span>
          {timeLeftBadge}
        </div>

        <div className="flex gap-2 w-full mt-1">
          {item.sanitized_document_path ? (
            <>
              <button
                onClick={() => onPreview(item)}
                className="flex-grow inline-flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#1c4973] hover:bg-primary hover:shadow-sm transition-all duration-200 cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </button>
              <a
                href={item.sanitized_document_path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex justify-center items-center p-2.5 rounded-lg border border-slate-250 text-slate-655 hover:bg-slate-50 hover:border-slate-350 hover:text-slate-900 transition-colors cursor-pointer"
                title="Download PDF Catalog"
              >
                <Download className="w-4 h-4" />
              </a>
            </>
          ) : (
            <button
              disabled
              className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
            >
              <span className="w-2 h-2 rounded-full bg-amber-450 animate-ping mr-2"></span>
              PDF Processing...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
