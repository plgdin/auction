import { Clock, Zap, ArrowUpRight } from "lucide-react";
import { Link } from "../Link";

export interface LiveLot {
  id: string;
  title: string;
  category: string;
  currentBid: number;
  bidCount: number;
  secondsRemaining: number;
  leader: string;
  isWinning?: boolean;
  imageSvgType: "jacket" | "camera" | "sneaker" | "denim" | "bag" | "mug";
  lotNumber: string;
}

interface EndingSoonRowProps {
  lots: LiveLot[];
  onPlaceBid: (lotId: string) => void;
  floatingBids: { [lotId: string]: boolean };
}

export function EndingSoonRow({ lots, onPlaceBid, floatingBids }: EndingSoonRowProps) {
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? "0" : ""}${s}s`;
  };

  return (
    <section className="section-wrap py-12 sm:py-16" id="live-auctions">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="stamp-badge mb-2">★ TICKING CLOCKS · ZERO SNIPING ★</div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal text-white">
            Ending Soon <span className="italic text-[#E4472B]">Auctions</span>
          </h2>
          <p className="text-stone-300 text-sm sm:text-base max-w-xl mt-2">
            Every second counts. Bids placed under 60 seconds automatically extend the clock.
            Tap <strong>+₹100 Bid</strong> to take the lead.
          </p>
        </div>
        <Link
          href="#/auctions"
          className="btn-tape-outline inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-[#E9B949]"
        >
          <span>View All Active Lots ({lots.length})</span>
          <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {lots.map((lot) => {
          const isUrgent = lot.secondsRemaining < 600;
          return (
            <div
              key={lot.id}
              className={`relative bg-[#14160f] border-2 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 ${
                isUrgent
                  ? "border-[#E4472B] shadow-[0_0_20px_rgba(228,71,43,0.25)] animate-pulse-gentle"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              {floatingBids[lot.id] && (
                <div className="floating-plus-bid top-8 right-8">+₹100</div>
              )}

              <div className={`winning-stamp-banner ${lot.isWinning ? "is-stamped" : ""}`}>
                YOU'RE WINNING!
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="font-mono text-xs font-bold text-[#E9B949]">{lot.lotNumber}</span>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs font-bold ${
                    isUrgent ? "bg-[#E4472B] text-white animate-pulse" : "bg-white/10 text-stone-200"
                  }`}
                >
                  <Clock size={12} />
                  <span>{formatTimer(lot.secondsRemaining)}</span>
                </div>
              </div>

              <div className="py-6 flex items-center justify-center">
                <div className="w-28 h-28 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center p-3 relative group">
                  {lot.imageSvgType === "jacket" && (
                    <svg viewBox="0 0 100 100" className="w-full h-full text-[#E9B949]">
                      <path d="M20,20 L40,15 L50,25 L60,15 L80,20 L90,50 L75,60 L70,90 L30,90 L25,60 L10,50 Z" fill="#2d2924" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                  {lot.imageSvgType === "camera" && (
                    <svg viewBox="0 0 100 100" className="w-full h-full text-[#F3EBDD]">
                      <rect x="15" y="25" width="70" height="50" rx="4" fill="#222" stroke="currentColor" strokeWidth="2" />
                      <circle cx="50" cy="50" r="18" fill="#333" stroke="#E9B949" strokeWidth="2" />
                    </svg>
                  )}
                  {lot.imageSvgType === "sneaker" && (
                    <svg viewBox="0 0 100 100" className="w-full h-full text-[#E4472B]">
                      <path d="M15,55 C25,55 30,40 55,40 C75,40 85,20 95,20 L95,55 Z" fill="#3a1c18" stroke="currentColor" strokeWidth="2" />
                      <rect x="10" y="55" width="85" height="12" rx="2" fill="#fff" stroke="#161412" strokeWidth="1" />
                    </svg>
                  )}
                  {lot.imageSvgType === "denim" && (
                    <svg viewBox="0 0 100 100" className="w-full h-full text-[#3E5C76]">
                      <path d="M25,15 L75,15 L80,85 L52,85 L50,40 L48,85 L20,85 Z" fill="#1b2a38" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                  {lot.imageSvgType === "bag" && (
                    <svg viewBox="0 0 100 100" className="w-full h-full text-[#E9B949]">
                      <rect x="25" y="40" width="50" height="45" rx="6" fill="#2b2318" stroke="currentColor" strokeWidth="2" />
                      <path d="M35,40 C35,20 65,20 65,40" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                  {lot.imageSvgType === "mug" && (
                    <svg viewBox="0 0 100 100" className="w-full h-full text-[#9DB29A]">
                      <rect x="30" y="25" width="40" height="55" rx="6" fill="#202c22" stroke="currentColor" strokeWidth="2" />
                      <path d="M70,35 C85,35 85,60 70,60" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
                  {lot.category}
                </span>
                <h3 className="text-lg font-bold text-white mt-1 leading-snug">{lot.title}</h3>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-stone-400 block">Current Bid</span>
                    <div className="text-2xl font-black font-mono text-[#E9B949]">
                      ₹{lot.currentBid.toLocaleString("en-IN")}
                    </div>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {lot.bidCount} bids · {lot.leader}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onPlaceBid(lot.id)}
                    className="btn-stamp inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#E4472B] text-white"
                  >
                    <Zap size={14} />
                    <span>+₹100 Bid</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

