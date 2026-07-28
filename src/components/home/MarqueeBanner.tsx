import { Phone } from 'lucide-react';

export function MarqueeBanner() {
  const marqueeItems = [1, 2, 3, 4, 5, 6];

  return (
    <div className="w-full bg-slate-900/30 backdrop-blur-md border-t border-white/10 py-3 overflow-hidden select-none relative z-10">
      <div className="animate-marquee flex items-center gap-10 whitespace-nowrap">
        {marqueeItems.map((i) => (
          <div key={i} className="flex items-center gap-3 text-xs sm:text-sm font-medium text-slate-100 shrink-0">
            <span>Free MSTC Consultancy — For any queries or help contact:</span>
            <a
              href="tel:+919447753889"
              className="inline-flex items-center gap-1.5 font-semibold text-white bg-primary/90 hover:bg-primary px-2.5 py-0.5 rounded-md transition-colors text-xs border border-white/20 shadow-xs"
            >
              <Phone className="w-3 h-3 text-white/90" />
              <span>+91 94477 53889</span>
            </a>
            <span className="text-white/30 font-bold ml-2">•</span>
          </div>
        ))}
      </div>
    </div>
  );
}
