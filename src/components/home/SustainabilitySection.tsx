export function SustainabilitySection() {
  return (
    <section className="relative bg-[#2F3E32] text-[#F3EBDD] pt-16 pb-20 px-4 sm:px-8 overflow-hidden">
      {/* Torn-Paper Deckle Top Edge */}
      <div className="torn-top-edge" />

      <div className="max-w-5xl mx-auto relative z-10 text-center">
        <div className="inline-block px-3 py-1 bg-[#161412] text-[#9DB29A] font-mono text-xs font-bold uppercase rounded mb-4">
          ★ SUSTAINABILITY METRICS ★
        </div>
        <h2 className="text-3xl sm:text-5xl font-serif text-white max-w-2xl mx-auto leading-tight">
          Mindful fashion is an act of preservation.
        </h2>
        <p className="text-stone-300 text-sm sm:text-base max-w-xl mx-auto mt-3">
          Every garment rehomed keeps high-quality textiles out of Kerala landfills and honors genuine garment craft.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-12">
          <div className="bg-[#1f2a21] border border-white/10 rounded-xl p-6">
            <span className="font-mono text-xs text-[#E9B949] uppercase font-bold">GARMENTS REHOMED</span>
            <div className="text-4xl sm:text-5xl font-black font-mono text-white mt-2">1,480+</div>
            <p className="text-stone-400 text-xs mt-1">Verified closet pieces in second circulation</p>
          </div>

          <div className="bg-[#1f2a21] border border-white/10 rounded-xl p-6">
            <span className="font-mono text-xs text-[#9DB29A] uppercase font-bold">TEXTILE WASTE SAVED</span>
            <div className="text-4xl sm:text-5xl font-black font-mono text-white mt-2">2,840 kg</div>
            <p className="text-stone-400 text-xs mt-1">Diverted from municipal disposal</p>
          </div>

          <div className="bg-[#1f2a21] border border-white/10 rounded-xl p-6">
            <span className="font-mono text-xs text-[#E4472B] uppercase font-bold">ACTIVE BIDDERS</span>
            <div className="text-4xl sm:text-5xl font-black font-mono text-white mt-2">920+</div>
            <p className="text-stone-400 text-xs mt-1">Collectors and conscious shoppers</p>
          </div>
        </div>
      </div>
    </section>
  );
}

