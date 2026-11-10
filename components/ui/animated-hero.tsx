"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, MoveRight, ShoppingBag, Sparkles } from "lucide-react";
import { navigate, smoothScrollTo } from "@/src/components/Link";
import Velaris from "@/components/ui/velaris";

export interface HeroProps {
  prefix?: string;
  titles?: string[];
  description?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  bg?: string;
  colors?: string[];
  speed?: number;
  grain?: number;
  className?: string;
}

const DEFAULT_HERO_COLORS = ["#1e1b15", "#2a2214", "#141510", "#0a0a08"];

function Hero({
  prefix = "Curated vintage thrift and live auctions",
  titles: customTitles,
  description = "A marketplace for verified vintage clothing and closet archives. Buy directly at asking price, make private confidential offers, or bid in real time.",
  primaryCtaText = "Shop the collection",
  primaryCtaHref = "#/products",
  secondaryCtaText = "Sell your closet",
  secondaryCtaHref = "#/sell",
  bg = "#080907",
  colors = DEFAULT_HERO_COLORS,
  speed = 1.6,
  grain = 0.24,
  className = "",
}: HeroProps) {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () =>
      customTitles || [
        "verified archives",
        "vintage leather",
        "japanese denim",
        "timeless knitwear",
        "rare collector pieces",
      ],
    [customTitles]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2800);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <Velaris
      height="100svh"
      bg={bg}
      colors={colors}
      speed={speed}
      grain={grain}
      className={`min-h-[100svh] ${className}`}
    >
      <div className="relative w-full h-full min-h-[100svh] flex flex-col justify-between items-center text-white">
        {/* Top spacer to offset fixed navbar */}
        <div className="h-20 sm:h-24 w-full shrink-0" aria-hidden="true" />

        {/* Main Hero Content - Capped at 680px per B5 */}
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col items-center justify-center py-6 sm:py-10 z-10">
          <motion.div
            className="flex flex-col items-center text-center w-full max-w-[680px] mx-auto gap-6 sm:gap-8"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Heading 1 per B5: Left to right text gradient #FFFFFF -> #9B9B9B */}
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.1] tracking-tight bg-gradient-to-r from-white via-stone-100 to-[#9B9B9B] bg-clip-text text-transparent px-2"
              style={{ textWrap: "balance" }}
            >
              <span className="block">{prefix}</span>
              <span className="relative block mt-2 h-[1.3em] overflow-hidden text-[#F5D061]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={titleNumber}
                    initial={{ opacity: 0, y: 32, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -32, filter: "blur(8px)" }}
                    transition={{
                      duration: 0.55,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="inline-block bg-gradient-to-r from-[#FFF0C2] via-[#F5D061] to-[#E5AC3A] bg-clip-text text-transparent font-bold drop-shadow-[0_2px_20px_rgba(245,208,97,0.35)]"
                  >
                    {titles[titleNumber]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </h1>

            {/* Subheadline capped at 680px with meaningful thought breaks */}
            <p
              className="text-base sm:text-lg md:text-xl text-white/80 font-normal leading-relaxed max-w-[640px] px-2"
              style={{ textWrap: "pretty" }}
            >
              {description}
            </p>

            {/* Call to Actions - B2 button sizing (8px v, 16px h) */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto items-stretch sm:items-center pt-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full py-2 px-5 text-base font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-lg hover:shadow-xl"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#0c0e09",
                  minHeight: "44px",
                }}
                onClick={() => navigate(primaryCtaHref)}
              >
                <ShoppingBag className="w-4 h-4 text-[#0c0e09]" strokeWidth={2.2} />
                <span>{primaryCtaText}</span>
                <MoveRight className="w-4 h-4 text-[#0c0e09]" strokeWidth={2.2} />
              </button>

              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full py-2 px-5 text-base font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  minHeight: "44px",
                }}
                onClick={() => navigate(secondaryCtaHref)}
              >
                <Sparkles className="w-4 h-4 text-[#c89b3c]" strokeWidth={2.2} />
                <span>{secondaryCtaText}</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Bottom fold cue */}
        <div className="w-full shrink-0 pb-6 sm:pb-8 flex flex-col items-center justify-center z-10">
          <a
            href="#rack"
            onClick={(e) => {
              e.preventDefault();
              smoothScrollTo(document.getElementById("rack"));
            }}
            className="group inline-flex flex-col items-center gap-2 text-xs uppercase tracking-[0.24em] font-medium text-white/60 hover:text-white transition-colors"
            aria-label="Scroll to clothing rail"
          >
            <span>Explore the rail</span>
            <ArrowDown className="w-4 h-4 animate-bounce text-[#c89b3c]" />
          </a>
        </div>
      </div>
    </Velaris>
  );
}

export { Hero };
export default Hero;
