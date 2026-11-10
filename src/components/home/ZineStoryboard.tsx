export function ZineStoryboard() {
  return (
    <section className="section-wrap py-16 sm:py-20 border-t border-white/10" id="how-it-works">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="stamp-badge mb-2">★ THE ZINE BLUEPRINT ★</div>
        <h2 className="text-3xl sm:text-5xl font-serif text-white">
          How Relic <span className="italic text-[#9DB29A]">Works</span>
        </h2>
        <p className="text-stone-300 text-sm sm:text-base mt-2">
          No endless haggling. No corporate consignment cuts. Just 3 clean steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Step 1 */}
        <div className="bg-[#14160f] border-2 border-white/10 rounded-xl p-6 relative">
          <div className="masking-tape -top-3 left-6" />
          <div className="font-mono text-xs font-bold text-[#E4472B] mb-2">STEP 01</div>
          <h3 className="text-xl font-serif font-bold text-white mb-2">Snap & Grade</h3>
          <p className="text-stone-300 text-sm leading-relaxed mb-6">
            Photograph collar, care tag, and seams. Set your reserve price. Opt into timed auctions or keep it buy-now.
          </p>
          <div className="w-full h-32 rounded bg-black/40 border border-white/5 flex items-center justify-center p-4">
            <svg viewBox="0 0 120 80" className="w-full h-full text-[#E9B949]">
              <rect x="20" y="15" width="80" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4,2" />
              <circle cx="60" cy="40" r="14" fill="none" stroke="#E4472B" strokeWidth="2" />
              <path d="M 30,25 L 45,25" stroke="#F3EBDD" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-[#14160f] border-2 border-white/10 rounded-xl p-6 relative">
          <div className="masking-tape -top-3 left-6" />
          <div className="font-mono text-xs font-bold text-[#E9B949] mb-2">STEP 02</div>
          <h3 className="text-xl font-serif font-bold text-white mb-2">24h Frenzy</h3>
          <p className="text-stone-300 text-sm leading-relaxed mb-6">
            Collectors compete on public countdowns with anti-snipe extensions, or submit private confidential offers.
          </p>
          <div className="w-full h-32 rounded bg-black/40 border border-white/5 flex items-center justify-center p-4">
            <svg viewBox="0 0 120 80" className="w-full h-full text-[#E4472B]">
              <circle cx="60" cy="40" r="26" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M 60,22 L 60,40 L 74,40" stroke="#E9B949" strokeWidth="2.5" />
              <path d="M 40,16 L 30,8" stroke="#F3EBDD" strokeWidth="2" />
              <path d="M 80,16 L 90,8" stroke="#F3EBDD" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-[#14160f] border-2 border-white/10 rounded-xl p-6 relative">
          <div className="masking-tape -top-3 left-6" />
          <div className="font-mono text-xs font-bold text-[#9DB29A] mb-2">STEP 03</div>
          <h3 className="text-xl font-serif font-bold text-white mb-2">Doorstep Payout</h3>
          <p className="text-stone-300 text-sm leading-relaxed mb-6">
            Prepaid tracked courier picks up at your doorstep in Trivandrum. Payouts transferred directly to UPI within 24 hours.
          </p>
          <div className="w-full h-32 rounded bg-black/40 border border-white/5 flex items-center justify-center p-4">
            <svg viewBox="0 0 120 80" className="w-full h-full text-[#9DB29A]">
              <rect x="25" y="25" width="55" height="35" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M 80,40 L 95,40 L 102,50 L 102,60 L 80,60 Z" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="42" cy="62" r="7" fill="#161412" stroke="#E9B949" strokeWidth="2" />
              <circle cx="90" cy="62" r="7" fill="#161412" stroke="#E9B949" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

