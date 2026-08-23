import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight,
  Image as ImageIcon, Download
} from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  title?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title = 'Auction Asset Photo',
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Sync initial index
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoomLevel(1);
      setRotation(0);
    }
  }, [isOpen, initialIndex]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setZoomLevel(1);
    setRotation(0);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setZoomLevel(1);
    setRotation(0);
  }, [images.length]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.3, 3.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.3, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-' || e.key === '_') handleZoomOut();
      else if (e.key === '0') handleResetZoom();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Top Header Controls */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 py-3.5 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white">
        <div className="flex items-center gap-2.5 max-w-[60%] truncate">
          <div className="p-1.5 rounded-lg bg-white/10">
            <ImageIcon className="w-4 h-4 text-slate-300" />
          </div>
          <div className="truncate">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">{title}</h3>
            <span className="text-[10px] text-slate-400 block font-mono">
              Photo {currentIndex + 1} of {images.length}
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-white/10 rounded-xl p-0.5 border border-white/10">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-white/20 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 text-[11px] font-bold text-slate-200 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer font-mono"
              title="Reset Zoom (0)"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-white/20 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Rotate */}
          <button
            onClick={handleRotate}
            className="p-2 hover:bg-white/20 bg-white/10 rounded-xl text-slate-200 hover:text-white transition-colors cursor-pointer border border-white/10"
            title="Rotate Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Download Original */}
          <a
            href={currentImage}
            target="_blank"
            rel="noreferrer"
            download={`Auction_Photo_${currentIndex + 1}.jpg`}
            className="p-2 hover:bg-white/20 bg-white/10 rounded-xl text-slate-200 hover:text-white transition-colors cursor-pointer border border-white/10"
            title="Open / Download Full Resolution"
          >
            <Download className="w-4 h-4" />
          </a>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-rose-600/80 bg-white/10 rounded-xl text-slate-200 hover:text-white transition-colors cursor-pointer border border-white/10 ml-2"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-12 overflow-hidden">
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
          }}
        >
          <img
            src={currentImage}
            alt={`${title} - photo ${currentIndex + 1}`}
            className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg shadow-2xl pointer-events-none select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* Left / Right Navigation Controls */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all cursor-pointer shadow-xl border border-white/10 hover:scale-105"
            title="Previous Photo (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={handleNext}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all cursor-pointer shadow-xl border border-white/10 hover:scale-105"
            title="Next Photo (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center px-4">
          <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 flex items-center gap-2 max-w-full overflow-x-auto">
            {images.map((url, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className={`relative shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  currentIndex === idx ? 'border-primary ring-2 ring-primary/40 scale-105' : 'border-white/20 opacity-50 hover:opacity-100'
                }`}
              >
                <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
