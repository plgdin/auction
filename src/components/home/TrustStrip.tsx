import { ShieldCheck, Clock, Truck, RotateCcw } from "lucide-react";

export function TrustStrip() {
  return (
    <section className="bg-[#161412] border-y border-white/10 py-10 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#E9B949]/15 border border-[#E9B949]/40 flex items-center justify-center text-[#E9B949] mb-3">
            <ShieldCheck size={22} />
          </div>
          <strong className="text-sm font-bold text-white">100% Condition Guaranteed</strong>
          <span className="text-xs text-stone-400 mt-1">4-tier transparent fabric grading</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#E4472B]/15 border border-[#E4472B]/40 flex items-center justify-center text-[#E4472B] mb-3">
            <Clock size={22} />
          </div>
          <strong className="text-sm font-bold text-white">Anti-Snipe Protection</strong>
          <span className="text-xs text-stone-400 mt-1">60s clock extension on late bids</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#9DB29A]/15 border border-[#9DB29A]/40 flex items-center justify-center text-[#9DB29A] mb-3">
            <Truck size={22} />
          </div>
          <strong className="text-sm font-bold text-white">Doorstep Kerala Courier</strong>
          <span className="text-xs text-stone-400 mt-1">Trivandrum 695xxx in 24-48 hours</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#3E5C76]/25 border border-[#3E5C76]/60 flex items-center justify-center text-[#F3EBDD] mb-3">
            <RotateCcw size={22} />
          </div>
          <strong className="text-sm font-bold text-white">Instant UPI Payouts</strong>
          <span className="text-xs text-stone-400 mt-1">Transferred 24h after delivery</span>
        </div>
      </div>
    </section>
  );
}

