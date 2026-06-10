import { useState } from 'react';
import type { AuctionImage } from '../../types/database.types';
import { Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface ImageGalleryProps {
  images: AuctionImage[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full aspect-video md:aspect-square bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 border border-slate-200">
        <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
        <span className="text-sm font-medium">No images available</span>
      </div>
    );
  }

  const handlePrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image View */}
      <div className="relative w-full aspect-video md:aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 group">
        <img 
          src={images[activeIndex].image_url} 
          alt={`Auction image ${activeIndex + 1}`}
          className="w-full h-full object-contain"
        />
        
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 text-slate-800 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 text-slate-800 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-y-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x hide-scrollbar">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setActiveIndex(index)}
              className={clsx(
                "relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border-2 snap-start transition-all",
                activeIndex === index ? "border-primary shadow-sm" : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <img 
                src={image.image_url} 
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
