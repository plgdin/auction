import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Download, Heart, FilePlus, Mail, Phone, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { MstcSanitizedAuction } from '../../services/publicService';
import { expandMstcOffice } from '../../services/publicService';
import { generateCatalogSummary, parsePdfDateTime, calculateLotValue } from '../../utils/mstcHelpers';
import clsx from 'clsx';
import { useQuoteStore } from '../../store/quoteStore';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { storageService } from '../../services/storageService';
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
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  useEffect(() => {
    if (!lightboxImage) {
      setZoomLevel(1);
    }
  }, [lightboxImage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [lightboxImage, onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1 || !wrapperRef.current) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: wrapperRef.current.scrollLeft,
      scrollTop: wrapperRef.current.scrollTop
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1 || !wrapperRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    wrapperRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    wrapperRef.current.scrollTop = dragStart.current.scrollTop - dy;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };
  const { isAuthenticated } = useAuthStore();
  const [downloading, setDownloading] = useState(false);

  const [signedImages, setSignedImages] = useState<{
    displayImage: string | null;
    imageUrls: string[];
    catalogPages: string[];
    actualPhotos: string[];
    urlMap: Record<string, string>;
  }>({
    displayImage: null,
    imageUrls: [],
    catalogPages: [],
    actualPhotos: [],
    urlMap: {}
  });
  const [imagesLoading, setImagesLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    let isMounted = true;
    
    async function resolvePreviewUrls() {
      setImagesLoading(true);
      
      const summary = generateCatalogSummary(item);
      const rawExtImages = summary.extracted_images || [];
      const rawPreviewUrl = summary.preview_image_url;
      
      // Determine actual photos & catalog pages
      const rawActualPhotos = rawExtImages.filter(
        (url: string) => !url.toLowerCase().includes('_catalog_page_') && !url.toLowerCase().includes('_page_') && !url.toLowerCase().includes('mstc-previews/') && !url.toLowerCase().endsWith('.pdf')
      );
      
      let rawCatalogPages = rawExtImages.filter(
        (url: string) => (url.toLowerCase().includes('_catalog_page_') || url.toLowerCase().includes('_page_') || url.toLowerCase().includes('mstc-previews/')) && !url.toLowerCase().endsWith('.pdf')
      );

      const fallbackPreview = item.sanitized_document_path ? `mstc-previews/${item.id}.jpg` : null;
      if (rawCatalogPages.length === 0 && fallbackPreview) {
        rawCatalogPages = [fallbackPreview];
      }
      
      const rawDisplayImage = rawActualPhotos.length > 0
        ? rawActualPhotos[0]
        : (rawPreviewUrl || (rawCatalogPages.length > 0 ? rawCatalogPages[0] : null));

      // Gather all unique paths to sign
      const pathsToSign: string[] = [];
      if (rawDisplayImage) pathsToSign.push(rawDisplayImage);
      rawActualPhotos.forEach(p => { if (!pathsToSign.includes(p)) pathsToSign.push(p); });
      rawCatalogPages.forEach(p => { if (!pathsToSign.includes(p)) pathsToSign.push(p); });
      
      const rawItems = summary.items || [];
      rawItems.forEach((row: any) => {
        const rowImages = row.images || [];
        rowImages.forEach((img: string) => {
          if (!pathsToSign.includes(img)) pathsToSign.push(img);
        });
      });
      
      if (pathsToSign.length === 0) {
        if (isMounted) {
          setSignedImages({ displayImage: null, imageUrls: [], catalogPages: [], actualPhotos: [], urlMap: {} });
          setImagesLoading(false);
        }
        return;
      }
      
      try {
        const signedUrls = await storageService.getSignedUrls(pathsToSign);
        
        // Map signed URLs back to their categories
        const signedMap: Record<string, string> = {};
        pathsToSign.forEach((path, idx) => {
          signedMap[path] = signedUrls[idx] || path;
        });
        
        const resolvedDisplayImage = rawDisplayImage ? (signedMap[rawDisplayImage] || null) : null;
        const resolvedActualPhotos = rawActualPhotos.map(p => signedMap[p]).filter(Boolean);
        const resolvedCatalogPages = rawCatalogPages.map(p => signedMap[p]).filter(Boolean);
        
        if (isMounted) {
          setSignedImages({
            displayImage: resolvedDisplayImage,
            imageUrls: resolvedActualPhotos,
            catalogPages: resolvedCatalogPages,
            actualPhotos: resolvedActualPhotos,
            urlMap: signedMap
          });
        }
      } catch (err) {
        console.error('Failed to resolve preview images to signed URLs:', err);
      } finally {
        if (isMounted) {
          setImagesLoading(false);
        }
      }
    }
    
    resolvePreviewUrls();
    
    return () => {
      isMounted = false;
    };
  }, [item]);

  const handleDownloadPdf = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to download the catalog PDF.');
      return;
    }

    if (!item.sanitized_document_path) {
      toast.error('No document path available.');
      return;
    }

    setDownloading(true);
    try {
      const storagePath = storageService.extractStoragePath(item.sanitized_document_path);
      const cleanAuctionNum = item.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');
      const filename = `${cleanAuctionNum}_catalog.pdf`;
      
      const success = await storageService.downloadPrivateFile('auction_documents', storagePath, filename);
      if (success) {
        toast.success('Catalog PDF downloaded successfully.');
      } else {
        toast.error('Failed to download the catalog PDF. Please try again.');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('An error occurred during catalog download.');
    } finally {
      setDownloading(false);
    }
  };

  const summary = generateCatalogSummary(item);
  const auctionNumber = item?.mstc_auction_number || '';
  const shortId = auctionNumber.split('/').pop() || item?.id?.substring(0, 8) || 'N/A';
  const parts = auctionNumber.split('/');
  const regionalOfficeName = expandMstcOffice(
    parts.length > 1 && parts[0].toUpperCase() === 'MSTC'
      ? parts[1]
      : item?.seller_name || ''
  );
  const locationName = expandMstcOffice(item?.location || '');

  // Parse start and close dates
  const parsedStartDate = summary.auctionStartTime ? parsePdfDateTime(summary.auctionStartTime) : null;
  const auctionDate = parsedStartDate || new Date(item?.opening_date || Date.now());
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
              <span className="text-base font-bold text-slate-500 ">
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
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ">Category / Item Type</h4>
                {(() => {
                  const parts = (item?.category_name || '').split(' | ');
                  const mainCat = parts[0] || 'Unknown';
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ">Official Auction Reference Number</span>
                  <span className=" text-base font-bold text-slate-800 break-all select-all">{item.mstc_auction_number}</span>
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
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest ">Seller Name</span>
                    <span className="text-[13.5px] font-bold text-slate-800 leading-snug mt-0.5">
                      {item.seller_name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest ">Regional Office</span>
                    <span className="text-[13.5px] font-bold text-slate-800 leading-snug mt-0.5">
                      {regionalOfficeName}
                    </span>
                  </div>
                  {item.location && (
                    <div className="flex flex-col border-t border-slate-100 pt-2">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest ">Location / State</span>
                      <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">{locationName}</span>
                    </div>
                  )}
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest ">Auction Type</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                      {summary.auctionType || 'O-General'}
                    </span>
                  </div>
                </div>

                {/* Dates & Countdown */}
                <div className="md:col-span-6 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest ">Bid Opening Time</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                      {parsedStartDate ? auctionDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : auctionDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest ">Bid Closing Time</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                      {parsedCloseDate ? parsedCloseDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : new Date(item?.closing_date || Date.now()).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest ">Inspection Date Range</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                      {summary.inspectionSchedule || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest  mb-1">Status</span>
                    <div>
                      {(() => {
                        if (isClosed) {
                          return <span className="inline-block font-bold text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 bg-slate-50">Bid Closed</span>;
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
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider  flex items-center gap-2">
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
                      <tr className="bg-slate-50 text-slate-650 border-b border-slate-250 ">
                        <th className="py-3 px-3.5 font-bold w-12 text-center">Lot</th>
                        <th className="py-3 px-3.5 font-bold">Material Description</th>
                        <th className="py-3 px-3.5 font-bold text-right">Quantity</th>
                        <th className="py-3 px-3.5 font-bold text-center">Market Price</th>
                        <th className="py-3 px-3.5 font-bold text-center w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-105 text-slate-700">
                      {summary.items.map((row) => (
                        <tr key={row.sr} className="hover:bg-slate-50/50 align-top">
                          <td className="py-3 px-3.5 text-center  font-bold text-slate-400">{row.sr}</td>
                          <td className="py-3 px-3.5 text-slate-900">
                            <div className="font-bold">{row.description}</div>
                            {(row.pcbGroup || row.productType) && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {row.pcbGroup && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                    PCB Group: {row.pcbGroup}
                                  </span>
                                )}
                                {row.productType && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-100">
                                    Type: {row.productType}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Lot Images */}
                            {(() => {
                              const rawRowImages = (row.images || []).filter((img: string) => !img.toLowerCase().endsWith('.pdf'));
                              
                              // Separate actual photos from catalog pages
                              const rowActualPhotos = rawRowImages.filter(
                                (img: string) => !img.toLowerCase().includes('_catalog_page_') && !img.toLowerCase().includes('_page_') && !img.toLowerCase().includes('mstc-previews/')
                              );
                              const rowCatalogPages = rawRowImages.filter(
                                (img: string) => img.toLowerCase().includes('_catalog_page_') || img.toLowerCase().includes('_page_') || img.toLowerCase().includes('mstc-previews/')
                              );
                              
                              const rowSortedImages = [...rowActualPhotos, ...rowCatalogPages];
                              if (rowSortedImages.length === 0) return null;
                              
                              return (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {rowSortedImages.map((img: string, i: number) => {
                                    const resolvedUrl = signedImages.urlMap[img] || img;
                                    return (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => setLightboxImage(resolvedUrl)}
                                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white hover:scale-105 transition-transform cursor-zoom-in shrink-0 shadow-2xs group"
                                      >
                                        <img
                                          src={resolvedUrl}
                                          alt={`Lot image ${i + 1}`}
                                          className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
                                          onError={(e) => {
                                            const parent = e.currentTarget.parentElement;
                                            if (parent) {
                                              parent.style.display = 'none';
                                            }
                                          }}
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-3.5 text-right  text-slate-955 font-bold">{row.qty} {row.unit}</td>
                          <td className="py-3 px-3.5 text-center  text-xs text-emerald-600 font-bold bg-emerald-50/50">{row.marketPrice}</td>
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
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2.5">
                    MSTC eAuctions Compliance & Documents
                  </h4>
                  <div className="space-y-2">
                    {summary.complianceInfo?.requiredDocuments && summary.complianceInfo.requiredDocuments.length > 0 ? (
                      summary.complianceInfo.requiredDocuments.map((doc, idx) => (
                        <div key={idx} className="flex gap-2 items-start p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="mt-0.5 shrink-0">
                            {doc.type === 'mandatory' ? (
                              <span className="text-emerald-600 text-sm font-bold">✓</span>
                            ) : (
                              <span className="text-amber-500 text-sm font-bold">⚠</span>
                            )}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-850 flex items-center gap-1.5 flex-wrap">
                              <span>{doc.name}</span>
                              {doc.type === 'conditional' && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0.2 rounded font-semibold uppercase tracking-wider">
                                  Conditional
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-normal mt-0.5">{doc.description}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <ul className="list-disc pl-5 space-y-2 text-[13.5px] text-slate-705">
                        {summary.eligibility.map((el, i) => (
                          <li key={i} className="leading-relaxed">{el}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Financial Charges Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2.5">
                    Financial Terms & Service Fees
                  </h4>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 text-[11px] uppercase tracking-wider">EMD Details</span>
                      <span className="font-bold text-slate-850 text-[13.5px]">
                        {summary.depositDetails.emd}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 text-[11px] uppercase tracking-wider">Pre-bid EMD</span>
                      <span className="font-bold text-slate-850 text-[13.5px]">
                        {summary.depositDetails.preBidDdg}
                      </span>
                    </div>
                    {summary.complianceInfo?.gstStatus && (
                      <div className="flex flex-col gap-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-slate-500 text-[11px] uppercase tracking-wider">GST Tax Scheme</span>
                        <div className="mt-1 flex flex-col gap-1">
                          <span className="font-bold text-slate-850 text-[13.5px] flex items-center gap-1.5">
                            {summary.complianceInfo.gstStatus.type}
                            {summary.complianceInfo.gstStatus.isRcm && (
                              <span className="bg-red-100 text-red-800 text-[9px] px-1 py-0.2 rounded font-semibold uppercase tracking-wider">
                                RCM
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-500 leading-normal">
                            {summary.complianceInfo.gstStatus.description}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Market Intelligence & ROI Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider  border-b border-slate-100 pb-2.5 flex items-center justify-between">
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
                          <span className=" font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                            +{roi.toFixed(1)}% ROI
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Key Contact Personnel */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-5">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider  border-b border-slate-100 pb-2.5">
                  Key Contact Personnel
                </h4>

                {(() => {
                  const mstcContacts = summary.keyContacts.filter(c => 
                    c.role.toLowerCase().includes('mstc') || c.role.toLowerCase().includes('auction officer')
                  );
                  const sellerContacts = summary.keyContacts.filter(c => 
                    !c.role.toLowerCase().includes('mstc') && !c.role.toLowerCase().includes('auction officer')
                  );

                  return (
                    <div className="space-y-4">
                      {mstcContacts.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest  bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                              MSTC Auction Officers
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {mstcContacts.map((contact, i) => (
                              <div key={`mstc-${i}`} className="bg-blue-50/30 border border-blue-150/50 p-3.5 rounded-xl space-y-2">
                                <span className="text-[10px]  text-blue-600 font-bold uppercase tracking-wider">{contact.role}</span>
                                <h4 className="text-[13.5px] font-black text-slate-900">{contact.name}</h4>
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-605  break-all flex items-center gap-1.5">
                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                    <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">{contact.email}</a>
                                  </p>
                                  {contact.phone && contact.phone !== 'no contact info available' && (
                                    <p className="text-xs text-slate-605  flex items-center gap-1.5">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="hover:text-primary transition-colors">{contact.phone}</a>
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {sellerContacts.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest  bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                              Seller / Site Contacts
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sellerContacts.map((contact, i) => (
                              <div key={`seller-${i}`} className="bg-emerald-50/30 border border-emerald-150/50 p-3.5 rounded-xl space-y-2">
                                <span className="text-[10px]  text-emerald-600 font-bold uppercase tracking-wider">{contact.role}</span>
                                <h4 className="text-[13.5px] font-black text-slate-900">{contact.name}</h4>
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-605  break-all flex items-center gap-1.5">
                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                    <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">{contact.email}</a>
                                  </p>
                                  {contact.phone && contact.phone !== 'no contact info available' && (
                                    <p className="text-xs text-slate-605  flex items-center gap-1.5">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="hover:text-primary transition-colors">{contact.phone}</a>
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Right Side: Image/Preview Panel */}
            {(() => {
              const imageUrls = signedImages.imageUrls; // representing actualPhotos
              const catalogPages = signedImages.catalogPages; // representing catalog document pages
              const displayImage = signedImages.displayImage;

              return (
                <div className="w-full md:w-[440px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50 p-5 overflow-y-auto flex flex-col space-y-5">
                  {imagesLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                      <span className="text-xs font-semibold">Loading secure previews...</span>
                    </div>
                  ) : (
                    <>
                      {/* Image Gallery: Actual Photos Only */}
                      {(() => {
                        if (imageUrls.length === 0) return null;
                        return (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider  border-b border-slate-150 pb-2 flex items-center justify-between">
                              <span>Auction Images</span>
                              <span className="text-[9.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded ">{imageUrls.length} Photos</span>
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

                      {/* Catalog Preview: Scrollable list of catalog pages */}
                      {catalogPages.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider  border-b border-slate-150 pb-2 flex items-center justify-between">
                            <span>Catalog Document Preview</span>
                            <span className="text-[9.5px] bg-slate-150 text-slate-700 border border-slate-255 font-bold px-2 py-0.5 rounded ">{catalogPages.length} Pages</span>
                          </h4>
                          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                            {catalogPages.map((url: string, idx: number) => (
                              <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-white group p-1">
                                <button
                                  type="button"
                                  onClick={() => setLightboxImage(url)}
                                  className="block w-full text-left cursor-zoom-in relative focus:outline-none"
                                >
                                  <img
                                    src={url}
                                    alt={`Catalog page ${idx + 1}`}
                                    className="w-full h-auto object-contain rounded-lg group-hover:scale-[1.01] transition-transform duration-250"
                                    loading="lazy"
                                  />
                                </button>
                                <div className="absolute bottom-2.5 right-2.5 bg-slate-900/70 backdrop-blur-xs text-[10px] text-white px-2 py-0.5 rounded-md select-none font-bold">
                                  Page {idx + 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : displayImage && !imageUrls.includes(displayImage) ? (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider  border-b border-slate-150 pb-2">
                            <span>Catalog Document Preview</span>
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
                    </>
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
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="w-full sm:w-auto inline-flex justify-center items-center py-3 px-7 rounded-xl text-[15px] font-bold text-white bg-slate-950 hover:bg-primary hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF Catalog
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-slate-955/95 backdrop-blur-md animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          {/* Floating Controls Bar */}
          <div 
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.5))}
              disabled={zoomLevel <= 1}
              className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            
            <span className="text-sm font-medium min-w-[3.5rem] text-center select-none">
              {Math.round(zoomLevel * 100)}%
            </span>
            
            <button
              onClick={() => setZoomLevel(prev => Math.min(4, prev + 0.5))}
              disabled={zoomLevel >= 4}
              className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>

            <div className="w-[1px] h-5 bg-white/10 mx-1" />

            <button
              onClick={() => setZoomLevel(1)}
              disabled={zoomLevel === 1}
              className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer z-50"
            title="Close preview (Esc)"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image Container */}
          <div
            ref={wrapperRef}
            className={clsx(
              "flex-1 w-full h-full flex items-center justify-center p-4",
              zoomLevel > 1 ? "overflow-auto cursor-grab active:cursor-grabbing" : "overflow-hidden cursor-zoom-in"
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onClick={() => setLightboxImage(null)}
          >
            <img
              src={lightboxImage}
              alt="Large Catalog Preview"
              className={clsx(
                "rounded-lg border border-white/5 shadow-2xl select-none transition-all duration-200 ease-out",
                zoomLevel === 1 ? "max-w-full max-h-[85vh] object-contain" : "max-w-none max-h-none"
              )}
              style={zoomLevel > 1 ? {
                width: `${zoomLevel * 100}%`,
                maxWidth: 'none',
                maxHeight: 'none',
              } : undefined}
              onClick={(e) => {
                e.stopPropagation();
                setZoomLevel(prev => prev > 1 ? 1 : 2);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};
