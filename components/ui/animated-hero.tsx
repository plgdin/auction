import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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

const DEFAULT_HERO_COLORS = ["#86efac", "#4ade80", "#059669", "#000000"];

function Hero({
  prefix = "Every piece is",
  titles: customTitles,
  description = "A local community marketplace for pre-loved fashion and closet treasures. Discover authenticated vintage garments, place private offers directly with sellers, or bid live in real-time auctions.",
  primaryCtaText = "Shop the rail",
  primaryCtaHref = "#/products",
  secondaryCtaText = "Sell your closet",
  secondaryCtaHref = "#/sell",
  bg = "#000000",
  colors = DEFAULT_HERO_COLORS,
  speed = 1.8,
  grain = 0.28,
  className = "",
}: HeroProps) {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () =>
      customTitles || [
        "pre-loved.",
        "vintage.",
        "one of a kind.",
        "timeless.",
        "handpicked.",
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
    }, 2200);
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
        {/* Top spacer to offset the fixed 80px navbar */}
        <div className="h-20 sm:h-24 w-full shrink-0" aria-hidden="true" />

        {/* Main Hero Content - vertically centered in the viewport */}
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col items-center justify-center py-6 sm:py-10 z-10">
          <div className="flex gap-6 sm:gap-8 lg:gap-10 items-center justify-center flex-col w-full max-w-5xl">
            {/* Heading with animated titles */}
            <div className="flex gap-4 sm:gap-6 flex-col items-center w-full">
              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[5.75rem] xl:text-[6.5rem] tracking-tight text-center font-serif font-normal text-white leading-[1.08] px-2 drop-shadow-sm">
                <span className="block text-white/95">{prefix}</span>
                <span className="relative flex w-full justify-center overflow-hidden text-center min-h-[1.38em] h-[1.38em] pt-1 pb-2">
                  &nbsp;
                  {titles.map((title, index) => (
                    <motion.span
                      key={index}
                      className="absolute font-serif italic text-white underline decoration-emerald-400/70 decoration-wavy decoration-1 underline-offset-8 whitespace-nowrap px-3 drop-shadow"
                      initial={{ opacity: 0, y: "-100%" }}
                      transition={{ type: "spring", stiffness: 50, damping: 15 }}
                      animate={
                        titleNumber === index
                          ? {
                              y: 0,
                              opacity: 1,
                            }
                          : {
                              y: titleNumber > index ? -120 : 120,
                              opacity: 0,
                            }
                      }
                    >
                      {title}
                    </motion.span>
                  ))}
                </span>
              </h1>

              {/* Subtitle / Ideology copy */}
              <p className="text-lg sm:text-xl md:text-2xl leading-relaxed tracking-normal text-white/80 max-w-2xl text-center px-4 font-sans font-light drop-shadow-sm">
                {description}
              </p>
            </div>

            {/* Call to Actions */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 w-full sm:w-auto items-stretch sm:items-center pt-2 sm:pt-4">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-3 rounded-full px-9 py-4 text-base sm:text-lg font-semibold shadow-2xl hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#051208",
                  minHeight: "56px",
                  boxShadow: "0 6px 28px rgba(0, 0, 0, 0.45)",
                }}
                onClick={() => navigate(primaryCtaHref)}
              >
                <ShoppingBag className="w-5 h-5 text-stone-950" strokeWidth={2.2} />
                <span className="text-stone-950 font-semibold">{primaryCtaText}</span>
                <MoveRight className="w-4 h-4 text-stone-900" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-3 rounded-full px-9 py-4 text-base sm:text-lg font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  border: "1.5px solid rgba(255, 255, 255, 0.35)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  minHeight: "56px",
                  boxShadow: "0 4px 18px rgba(0, 0, 0, 0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.22)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.6)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.35)";
                }}
                onClick={() => navigate(secondaryCtaHref)}
              >
                <Sparkles className="w-5 h-5 text-emerald-300 group-hover:text-emerald-200 transition-colors" strokeWidth={2.2} />
                <span className="font-semibold">{secondaryCtaText}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom fold cue */}
        <div className="w-full shrink-0 pb-6 sm:pb-8 flex flex-col items-center justify-center z-10">
          <a
            href="#rack"
            onClick={(e) => {
              e.preventDefault();
              smoothScrollTo(document.getElementById("rack"));
            }}
            className="group inline-flex flex-col items-center gap-2 text-xs uppercase tracking-[0.22em] font-medium text-white/60 hover:text-white transition-colors"
            aria-label="Scroll to clothing rail"
          >
            <span>Explore the rail</span>
            <ArrowDown className="w-4 h-4 animate-bounce text-emerald-300/80 group-hover:text-emerald-200 transition-colors" />
          </a>
        </div>
      </div>
    </Velaris>
  );
}

function HeroDemo() {
  return (
    <div className="block">
      <Hero />
    </div>
  );
}

export { Hero, HeroDemo };
export default Hero;
