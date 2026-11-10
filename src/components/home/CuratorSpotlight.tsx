import { ArrowUpRight } from "lucide-react";
import { Link } from "../Link";

export function CuratorSpotlight() {
  return (
    <section className="section-wrap py-14 sm:py-20 border-t border-white/10">
      <div className="bg-[#161412] border-2 border-white/15 rounded-2xl p-8 sm:p-12 relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
          {/* Polaroid Frame */}
          <div className="md:col-span-5 flex justify-center">
            <div className="w-64 sm:w-72 bg-[#F3EBDD] text-[#161412] p-4 pb-8 rounded shadow-2xl rotate-[-3deg] relative">
              <div className="masking-tape -top-3 left-16" />
              <div className="w-full h-64 bg-[#2a2622] rounded flex items-center justify-center overflow-hidden">
                <img
                  src="/images/leather.jpg"
                  alt="Curator Rohan Mathew"
                  className="w-full h-full object-cover filter contrast-125"
                />
              </div>
              <div className="mt-3 text-center font-serif italic text-sm text-[#161412]">
                Rohan Mathew · Kowdiar, Trivandrum
              </div>
              <span className="block text-center font-mono text-[9px] text-stone-500 mt-0.5">
                Archival Collector · 48 Pieces Sold
              </span>
            </div>
          </div>

          {/* Curator Quote & Story */}
          <div className="md:col-span-7">
            <div className="stamp-badge mb-3">★ CURATOR SPOTLIGHT OF THE MONTH ★</div>
            <blockquote className="text-2xl sm:text-3xl font-serif text-[#F3EBDD] leading-snug">
              &ldquo;Fast fashion is a soulless landfill cycle. When you hold a 1980s leather bomber or Japanese selvedge denim, you're holding craftsmanship that will outlive us all.&rdquo;
            </blockquote>
            <p className="text-stone-400 text-sm mt-4 leading-relaxed font-sans">
              Rohan has sourced and archived over 80 rare military and workwear garments across Kerala. On Relic,
              he lists private lots directly from his closet archives with guaranteed provenance.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Link href="#/products" className="btn-stamp inline-flex items-center gap-2 px-5 py-2.5 text-xs">
                <span>Explore Rohan's Collection</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

