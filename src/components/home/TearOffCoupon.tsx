import { useState } from "react";
import { Scissors } from "lucide-react";
import { toast } from "../../lib/toast";

export function TearOffCoupon() {
  const [couponEmail, setCouponEmail] = useState("");
  const [couponCopied, setCouponCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponEmail) return;
    setCouponCopied(true);
    toast("Coupon LELAM10 activated! Code copied to clipboard.");
    navigator.clipboard?.writeText("LELAM10");
  };

  return (
    <section className="section-wrap py-16 sm:py-20">
      <div className="tear-off-coupon-container max-w-4xl mx-auto">
        <div className="scissors-icon-tag flex items-center gap-1">
          <Scissors size={12} />
          <span>CUT HERE</span>
        </div>

        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="stamp-badge self-start mb-3">★ THE FIRST AUCTION PASS ★</div>
          <h3 className="text-2xl sm:text-3xl font-serif text-white">
            Claim 10% off your first winning bid
          </h3>
          <p className="text-stone-300 text-sm mt-2 leading-relaxed">
            Subscribe to the Relic Weekly Dispatch. We email private drop alerts, unreserved thrift lots, and curator picks every Thursday.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              value={couponEmail}
              onChange={(e) => setCouponEmail(e.target.value)}
              placeholder="Enter your email address..."
              className="bg-white/10 border border-white/20 rounded px-4 py-2.5 text-sm text-white placeholder-stone-400 focus:outline-none focus:border-[#E9B949] flex-1 font-mono"
            />
            <button
              type="submit"
              className="btn-stamp px-6 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#E4472B] text-white"
            >
              {couponCopied ? "Claimed!" : "Tear Off Coupon"}
            </button>
          </form>
        </div>

        <div className="coupon-stub-side">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#161412]">
            PROMO CODE
          </span>
          <div className="font-mono text-2xl font-black text-[#161412] tracking-wider border-2 border-dashed border-[#161412] px-3 py-1 bg-white/40">
            LELAM10
          </div>
          <span className="text-[10px] font-mono text-[#161412]/80 mt-1">
            Valid on any live lot or direct piece
          </span>
        </div>
      </div>
    </section>
  );
}

