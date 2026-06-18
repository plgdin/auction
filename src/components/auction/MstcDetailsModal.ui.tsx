import React, { useState } from 'react';
import { X, Copy, Check, Download, Heart, FilePlus } from 'lucide-react';
import type { MstcSanitizedAuction } from '../../services/publicService';
import { expandMstcOffice } from '../../services/publicService';
import { generateCatalogSummary, parsePdfDateTime, calculateLotValue } from '../../utils/mstcHelpers';
import clsx from 'clsx';
import { useQuoteStore } from '../../store/quoteStore';
import { toast } from 'react-hot-toast';
import { marketPriceService } from '../../services/marketPriceService';

interface MstcDetailsModalProps {
  item: MstcSanitizedAuction;
  onClose: () => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export const MstcDetailsModal: React.FC<MstcDetailsModalProps> = ({
  item,
  onClose,
  isInterested = false,
  onInterestedToggle
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const summary = generateCatalogSummary(item);
  const shortId = item.mstc_auction_number.split('/').pop() || item.id.substring(0, 8);
  const regionalOfficeName = expandMstcOffice(
    item.mstc_auction_number.split('/')[0].toUpperCase() === 'MSTC'
      ? item.mstc_auction_number.split('/')[1]
      : item.seller_name
  );
  const locationName = expandMstcOffice(item.location || '');

  // Parse start and close dates
  const parsedStartDate = summary.auctionStartTime ? parsePdfDateTime(summary.auctionStartTime) : null;
  const auctionDate = parsedStartDate || new Date(item.opening_date);
  const parsedCloseDate = summary.auctionCloseTime ? parsePdfDateTime(summary.auctionCloseTime) : null;
  const now = new Date();
  const diffMs = auctionDate.getTime() - now.getTime();
  const isStarted = diffMs <= 0;
  const isClosed = parsedCloseDate ? (now.getTime() > parsedCloseDate.getTime()) : false;

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const isUrgent = diffDays < 3;
  const isWarning = diffDays < 7;

  const addItemToActiveQuote = useQuoteStore(state => state.addItemToActiveQuote);

  const handleAddItemToQuote = (row: any) => {
    const qty = parseFloat(row.qty.replace(/,/g, '')) || 1;
    let price = 0;
    const priceMatch = (row.marketPrice || '').match(/Ôé╣([\d,]+)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/,/g, ''));
    }
    
    let taxRate = 18;
    const taxMatch = (row.taxRate || '').match(/(\d+)%/);
    if (taxMatch) {
      taxRate = parseInt(taxMatch[1], 10);
    }

    addItemToActiveQuote({
      description: row.description,
      qty,
      unit: row.unit || 'Units',
      price,
      taxRate
    });

    toast.success(`Added "${row.description}" to quote`);
  };

  const handleAddAllItemsToQuote = () => {
    if (!summary.items || summary.items.length === 0) return;
    
    summary.items.forEach(row => {
      const qty = parseFloat(row.qty.replace(/,/g, '')) || 1;
      let price = 0;
      const priceMatch = (row.marketPrice || '').match(/Ôé╣([\d,]+)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(/,/g, ''));
      }
      
      let taxRate = 18;
      const taxMatch = (row.taxRate || '').match(/(\d+)%/);
      if (taxMatch) {
        taxRate = parseInt(taxMatch[1], 10);
      }

      addItemToActiveQuote({
        description: row.description,
        qty,
        unit: row.unit || 'Units',
        price,
        taxRate
      });
    });

    toast.success(`Added all ${summary.items.length} items to quote`);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-xs p-4 sm:p-6 md:p-8 animate-fade-in">
        <div className="relative w-full max-w-7xl h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-205 animate-scale-up animate-duration-200">
          
          {/* Modal Header */}
          <div className="px-6 py-4.5 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <span className="text-base font-bold text-slate-500 font-mono">
                Ref: {shortId}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shortId);
                  setCopiedRef(true);
                  setTimeout(() => setCopiedRef(false), 2000);
                }}
                className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center"
                title="Copy Reference ID"
              >
                {copiedRef ? (
                  <Check className="w-3.5 h-3.5 text-emerald-605" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              {onInterestedToggle && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInterestedToggle();
                  }}
                  className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-rose-500 cursor-pointer flex items-center justify-center ml-1"
                  title={isInterested ? "Remove from interested list" : "Add to interested list"}
                >
                  <Heart className={clsx("w-3.5 h-3.5", isInterested ? "fill-rose-500 text-rose-500" : "")} />
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-5.5 h-5.5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
            {/* Left Side: Details Scrollable */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/25">

              {/* Category & Auction Ref Title */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Category / Item Type</h4>
                {(() => {
                  const parts = item.category_name.split(' | ');
                  const mainCat = parts[0];
                  const subCat = parts[1];
                  return (
                    <div className="flex flex-col gap-0.5">
                      {subCat ? (
                        <>
                          <span className="text-sm font-bold text-primary uppercase tracking-wider">{mainCat}</span>
                          <h3 className="text-3xl font-black text-slate-950 leading-tight">{subCat}</h3>
                        </>
                      ) : (
                        <h3 className="text-3xl font-black text-slate-955 leading-tight">{mainCat}</h3>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Auction Reference Banner */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-3xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Official Auction Reference Number</span>
                  <span className="font-mono text-base font-bold text-slate-800 break-all select-all">{item.mstc_auction_number}</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(item.mstc_auction_number);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={clsx(
                    "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all shrink-0 cursor-pointer shadow-3xs",
                    copied
                      ? "bg-emerald-50 border-emerald-250 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-707 hover:bg-slate-50 hover:text-primary hover:border-primary/30"
                  )}
                >
                  {copied ? (
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

              {/* General Parameters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Seller & Location Details */}
                <div className="md:col-span-6 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Regional Office</span>
                    <span className="text-[13.5px] font-bold text-slate-800 leading-snug mt-0.5">
                      {regionalOfficeName}
                    </span>
                  </div>
                  {item.location && (
                    <div className="flex flex-col border-t border-slate-100 pt-2">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Location / State</span>
                      <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">{locationName}</span>
                    </div>
                  )}
                </div>

                {/* Dates & Countdown */}
                <div className="md:col-span-6 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Auction Date</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                      {parsedStartDate ? auctionDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : auctionDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Inspection Date Range</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                      {summary.inspectionSchedule || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Status</span>
                    <div>
                      {(() => {
                        if (isClosed) {
                          return <span className="inline-block font-bold text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 bg-slate-50">Bidding Closed</span>;
                        }
                        if (isStarted) {
                          return <span className="inline-block font-bold text-xs px-2.5 py-1 rounded border border-rose-200 text-rose-700 bg-rose-50 animate-pulse">Bidding Started</span>;
                        }
                        return (
                          <span className={clsx(
                            "inline-block font-bold text-xs px-2.5 py-1 rounded border",
                            isUrgent ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" :
                            isWarning ? "text-amber-700 bg-amber-50 border-amber-200" :
                            "text-emerald-700 bg-emerald-50 border-emerald-200"
                          )}>
                            {diffDays > 0 ? `Starts in ${diffDays}d ${diffHours}h` : `Starts in ${diffHours}h ${diffMins}m`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Identified Materials & Lots */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2.5 gap-2">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
                    <span>Identified Inventory & Materials</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-sans font-medium normal-case">
                      {summary.items.length} lots identified
                    </span>
                  </h4>
                  {summary.items.length > 0 && (
                    <button
                      onClick={handleAddAllItemsToQuote}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 bg-primary/5 border border-primary/20 rounded-lg transition-colors cursor-pointer"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                      Add All to Quote
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-150 bg-white">
                  <table className="w-full text-left border-collapse text-[13.5px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-650 border-b border-slate-250 font-mono">
                        <th className="py-3 px-3.5 font-bold w-12 text-center">Lot</th>
                        <th className="py-3 px-3.5 font-bold">Material Description</th>
                        <th className="py-3 px-3.5 font-bold text-right">Quantity</th>
                        <th className="py-3 px-3.5 font-bold text-center">Market Price</th>
                        <th className="py-3 px-3.5 font-bold text-center w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-105 text-slate-700">
                      {summary.items.map((row) => (
                        <tr key={row.sr} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400">{row.sr}</td>
                          <td className="py-3 px-3.5 font-bold text-slate-900">{row.description}</td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-950 font-bold">{row.qty} {row.unit}</td>
                          <td className="py-3 px-3.5 text-center font-mono text-xs text-emerald-600 font-bold bg-emerald-50/50">{row.marketPrice}</td>
                          <td className="py-2.5 px-3.5 text-center">
                            <button
                              onClick={() => handleAddItemToQuote(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-primary hover:bg-slate-100 border border-slate-200 hover:border-primary/30 rounded-md transition-colors cursor-pointer"
                              title="Add to Quote"
                            >
                              <FilePlus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Eligibility, Compliance & Financial Terms */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Compliance Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2.5">
                    Buyer Eligibility & Compliance
                  </h4>
                  <ul className="list-disc pl-5 space-y-2 text-[13.5px] text-slate-705">
                    {summary.eligibility.map((el, i) => (
                      <li key={i} className="leading-relaxed">{el}</li>
                    ))}
                  </ul>
                </div>

                {/* Financial Charges Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2.5">
                    Financial Terms & Service Fees
                  </h4>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 text-[11px] uppercase font-mono tracking-wider">EMD Details</span>
                      <span className="font-bold text-slate-850 text-[13.5px]">
                        {summary.depositDetails.emd}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 text-[11px] uppercase font-mono tracking-wider">Pre-bid EMD</span>
                      <span className="font-bold text-slate-850 text-[13.5px]">
                        {summary.depositDetails.preBidDdg}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Market Intelligence & ROI Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2.5 flex items-center justify-between">
                    <span>Market Analysis & ROI</span>
                  </h4>
                  {(() => {
                    let totalTurnover = 0;
                    let metalCount = 0;
                    let vehicleCount = 0;
                    let ewasteCount = 0;
                    summary.items.forEach(lot => {
                      const val = calculateLotValue(lot.qty, lot.unit, lot.marketPrice || '2500');
                      totalTurnover += val;
                      const desc = (lot.description || '').toLowerCase();
                      if (desc.includes('steel') || desc.includes('iron') || desc.includes('copper') || desc.includes('metal') || desc.includes('brass')) {
                        metalCount++;
                      } else if (desc.includes('vehicle') || desc.includes('car') || desc.includes('bus') || desc.includes('truck') || desc.includes('motorcycle')) {
                        vehicleCount++;
                      } else if (desc.includes('computer') || desc.includes('laptop') || desc.includes('battery') || desc.includes('e-waste') || desc.includes('electronic')) {
                        ewasteCount++;
                      }
                    });

                    // Determine dynamic multiplier based on dominant commodity type
                    let closingBidMultiplier = marketPriceService.getCommodityMultiplier('default');
                    const totalItems = summary.items.length || 1;
                    if (metalCount / totalItems > 0.5) {
                      closingBidMultiplier = marketPriceService.getCommodityMultiplier('steel_iron_ferrous');
                    } else if (vehicleCount / totalItems > 0.5) {
                      closingBidMultiplier = marketPriceService.getCommodityMultiplier('vehicle');
                    } else if (ewasteCount / totalItems > 0.5) {
                      closingBidMultiplier = marketPriceService.getCommodityMultiplier('e_waste');
                    }

                    const predictedClosingBid = totalTurnover * closingBidMultiplier;
                    const projectedProfit = totalTurnover - predictedClosingBid;
                    const roi = predictedClosingBid > 0 ? (projectedProfit / predictedClosingBid) * 100 : 0;

                    return (
                      <div className="space-y-3 text-[13.5px] text-slate-705">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Projected Turnover</span>
                          <span className="font-bold text-slate-900">
                            ₹{totalTurnover.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Predicted Closing Bid</span>
                          <span className="font-bold text-indigo-650">
                            ₹{predictedClosingBid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Projected Profit</span>
                          <span className="font-bold text-emerald-605">
                            ₹{projectedProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pb-1">
                          <span className="text-slate-500 font-semibold">Projected ROI</span>
                          <span className="font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                            +{roi.toFixed(1)}% ROI
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Key Contact Personnel */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3.5">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2.5">
                  Key Contact Personnel
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summary.keyContacts.map((contact, i) => (
                    <div key={i} className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-xl space-y-1.5">
                      <span className="text-[10.5px] font-mono text-primary font-bold uppercase tracking-wider">{contact.role}</span>
                      <h4 className="text-[13.5px] font-black text-slate-900">{contact.name}</h4>
                      <p className="text-xs text-slate-605 font-mono break-all mt-0.5">{contact.email}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Side: Image/Preview Panel */}
            {(() => {
              const hasOtherMedia = item.raw_materials_text && summary.extracted_images && summary.extracted_images.length > 0;
              const displayImage = summary.preview_image_url || (hasOtherMedia ? summary.extracted_images![0] : null);

              return (
                <div className="w-full md:w-[440px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50 p-5 overflow-y-auto flex flex-col space-y-5">
                  {/* Image Gallery */}
                  {(() => {
                    const imageUrls = (summary.extracted_images || []).filter(
                      (url: string) => !url.toLowerCase().endsWith('.pdf')
                    );
                    if (imageUrls.length === 0) return null;
                    return (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150 pb-2 flex items-center justify-between">
                          <span>Auction Images</span>
                          <span className="text-[9.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded font-mono">{imageUrls.length} Photos</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {imageUrls.map((url: string, idx: number) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setLightboxImage(url)}
                              className="relative rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-white group cursor-zoom-in aspect-square"
                            >
                              <img
                                src={url}
                                alt={`Auction image ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-250"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {displayImage ? (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150 pb-2">
                        Catalog Document Preview
                      </h4>
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xs bg-white group p-1.5">
                        <button
                          type="button"
                          onClick={() => setLightboxImage(displayImage)}
                          className="block w-full text-left cursor-zoom-in relative focus:outline-none"
                        >
                          <img
                            src={displayImage}
                            alt="PDF Catalog Preview"
                            className="w-full h-auto object-cover rounded-xl group-hover:scale-[1.01] transition-transform duration-250"
                          />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full py-12 flex flex-col items-center justify-center text-slate-400 gap-2 select-none bg-white rounded-2xl border border-slate-200 shadow-2xs">
                      <svg className="w-10 h-10 text-slate-355" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      <span className="text-xs font-semibold tracking-wide">No preview available</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-150 bg-slate-50/50 flex flex-col sm:flex-row gap-3 sm:justify-end items-center">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-[15px] font-bold text-slate-650 hover:text-slate-850 hover:bg-slate-200 transition-all cursor-pointer text-center"
            >
              Close Details
            </button>
            <a
              href={item.sanitized_document_path || '#'}
              download
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto inline-flex justify-center items-center py-3 px-7 rounded-xl text-[15px] font-bold text-white bg-slate-950 hover:bg-primary hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF Catalog
            </a>
          </div>

        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-955/90 backdrop-blur-md p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer z-10"
            title="Close image"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Large Catalog Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg border border-white/10 shadow-2xl select-none animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
