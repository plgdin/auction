"use client";

import { motion } from "framer-motion";
import { MoveRight, ShoppingBag } from "lucide-react";
import { navigate } from "@/src/components/Link";
import { COARSE, REDUCED_MOTION, revealDelay, revealDuration } from "@/src/lib/motion";

export interface HeroProps {
  headlineTop?: string;
  headlineMiddle?: string;
  headlineAccent?: string;
  description?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  className?: string;
}

/** Translucent beige masking tape strip with torn edges and dashed fiber cuts */
function MaskingTape({
  className = "",
  width = "w-24",
  rotate = "-rotate-1",
}: {
  className?: string;
  width?: string;
  rotate?: string;
}) {
  return (
    <div
      className={`absolute z-30 h-6 ${width} ${rotate} pointer-events-none select-none ${className}`}
      style={{
        backgroundColor: "rgba(238, 226, 198, 0.88)",
        backdropFilter: "blur(2px)",
        boxShadow: "0 1.5px 4px rgba(73, 48, 34, 0.16)",
        clipPath: "polygon(0% 3px, 2% 0%, 98% 2%, 100% 5%, 98% 100%, 96% 96%, 3% 98%, 0% 93%)",
        borderLeft: "1px dashed rgba(160, 135, 95, 0.45)",
        borderRight: "1px dashed rgba(160, 135, 95, 0.45)",
      }}
      aria-hidden="true"
    />
  );
}

/** Authentic Polaroid photo frame with realistic shadows, border chin, and washi tape */
function PolaroidPhoto({
  src,
  alt,
  rotation = 0,
  className = "",
  tapePlacement = "top-center",
  delay = 0,
  width,
  height,
  priority = false,
  sizes,
}: {
  src: string;
  alt: string;
  rotation?: number;
  className?: string;
  tapePlacement?: "top-center" | "top-right" | "top-left";
  delay?: number;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes: string;
}) {
  const responsiveSourceSet = (format: "avif" | "webp") =>
    [360, 640, 900]
      .map((size) => `${src.replace(".jpg", `-${size}.${format}`)} ${size}w`)
      .join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, rotate: rotation - 2 }}
      animate={{ opacity: 1, scale: 1, rotate: rotation }}
      transition={{ duration: revealDuration(0.8), delay: revealDelay(delay), ease: [0.16, 1, 0.3, 1] }}
      whileHover={REDUCED_MOTION ? undefined : {
        scale: 1.04,
        rotate: 0,
        zIndex: 40,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      }}
      className={`relative cursor-pointer group transition-shadow drop-shadow-[0_12px_14px_rgba(48,33,22,0.24)] hover:drop-shadow-[0_18px_20px_rgba(48,33,22,0.3)] ${className}`}
    >
      {/* Masking tape on polaroid */}
      {tapePlacement === "top-center" && (
        <MaskingTape className="-top-3 left-1/2 -translate-x-1/2" width="w-24 sm:w-28" rotate="-rotate-1" />
      )}
      {tapePlacement === "top-right" && (
        <MaskingTape className="-top-3 -right-2" width="w-20 sm:w-24" rotate="rotate-6" />
      )}
      {tapePlacement === "top-left" && (
        <MaskingTape className="-top-3 -left-2" width="w-20 sm:w-24" rotate="-rotate-6" />
      )}

      {/* Supplied photo already carries its handmade paper edge and sepia treatment. */}
      <picture>
        <source type="image/avif" srcSet={responsiveSourceSet("avif")} sizes={sizes} />
        <source type="image/webp" srcSet={responsiveSourceSet("webp")} sizes={sizes} />
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.015]"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
        />
      </picture>
    </motion.div>
  );
}

function Hero({
  headlineTop = "Give Your",
  headlineMiddle = "Closet a",
  headlineAccent = "Second Life.",
  description = "Turn your pre-loved clothes, accessories and more into cash — easily, safely, and sustainably with lelam.co.",
  primaryCtaText = "Start Selling",
  primaryCtaHref = "#/sell/new",
  className = "",
}: HeroProps) {
  return (
    <section
      className={`relative w-full min-h-[min(76vh,640px)] lg:min-h-[min(78vh,700px)] overflow-hidden flex flex-col justify-between select-none ${className}`}
    >
      {/* Top spacer to offset the fixed glass navbar */}
      <div className="h-16 sm:h-20 lg:h-24 w-full shrink-0" aria-hidden="true" />

      {/* Main 16:9 Scrapbook Editorial Container */}
      <div className="container relative mx-auto px-5 sm:px-8 md:px-12 lg:px-16 flex-1 flex items-center justify-center py-4 sm:py-8 z-10">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* ========================================================
             LEFT SECTION — BRAND AND MESSAGE (approx 45%)
             ======================================================== */}
          <motion.div
            initial={COARSE || REDUCED_MOTION ? false : { opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: revealDuration(0.85), ease: [0.16, 1, 0.3, 1] }}
            className="home-hero-copy lg:col-span-5 xl:col-span-5 flex flex-col items-start gap-4 sm:gap-5 lg:gap-6 z-10"
          >
            {/* Main Headline: Give Your Closet a Second Life. */}
            <div className="relative">
              <h1
                className="text-[#493022] text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-[4.25rem] 2xl:text-[4.75rem] leading-[1.05] tracking-tight font-normal"
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                }}
              >
                <span className="relative inline-flex items-center">
                  <span>{headlineTop}</span>
                  {/* Subtle pencil sketch rays mark on top right of Give Your */}
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 26 26"
                    fill="none"
                    className="inline-block text-[#493022]/75 ml-2 -mt-6 sm:-mt-8"
                    aria-hidden="true"
                  >
                    <path d="M4 22L12 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    <path d="M15 24L22 11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </span>
                <br />
                <span>{headlineMiddle}</span>
                <br />
                <span className="relative inline-block isolate italic font-serif mt-1">
                  <span aria-hidden="true" className="paper-marker-highlight pointer-events-none absolute -z-10" />
                  {headlineAccent}
                </span>
              </h1>
            </div>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg md:text-xl text-[#6B5646] max-w-lg leading-relaxed font-sans font-normal">
              {description}
            </p>

            {/* Primary selling action and direct route to the shop */}
            <div className="home-hero-cta-group relative isolate pt-1 flex flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(primaryCtaHref)}
                style={{ backgroundColor: "#493022", color: "#F5EBDD" }}
                className="group relative inline-flex items-center gap-3 px-8 py-3.5 sm:px-9 sm:py-4 rounded-[10px] text-base sm:text-lg font-medium shadow-[0_8px_24px_rgba(73,48,34,0.28)] transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <span>{primaryCtaText}</span>
                <MoveRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={() => navigate("#/products")}
                className="home-hero-secondary-cta inline-flex items-center justify-center gap-2 rounded-[10px] border-2 border-[#493022]/55 bg-[#FAF7F2] px-6 py-3.5 text-base font-medium text-[#493022] shadow-[0_5px_16px_rgba(73,48,34,0.12)] transition-colors duration-200 hover:bg-white"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Buy Now</span>
              </button>
            </div>
          </motion.div>

          {/* ========================================================
             RIGHT SECTION — SCRAPBOOK COLLAGE (approx 55%)
             ======================================================== */}
          <div className="lg:col-span-7 xl:col-span-7 relative flex justify-center items-center min-h-[340px] sm:min-h-[380px] md:min-h-[400px] lg:min-h-[420px] w-full">
            <div className="relative w-full max-w-[560px] h-[340px] sm:h-[380px] md:h-[400px] lg:h-[420px]">

              {/* Photograph 2: Upper-right neatly folded pre-loved knitted sweaters */}
              <div className="absolute top-0 sm:top-2 right-0 sm:right-2 z-10 w-[40%] sm:w-[42%] max-w-[270px]">
                <PolaroidPhoto
                  src="/images/gpt/hero-knit.jpg"
                  alt="Neatly folded pre-loved knitted sweaters"
                  width={1122}
                  height={1402}
                  sizes="(min-width: 640px) 238px, 40vw"
                  rotation={7}
                  tapePlacement="top-right"
                  delay={0.2}
                />
              </div>

              {/* Photograph 1: Large central Polaroid with vintage brown leather jacket on wooden hanger */}
              <div className="absolute top-10 sm:top-14 left-2 sm:left-4 z-20 w-[54%] sm:w-[56%] max-w-[350px]">
                <PolaroidPhoto
                  src="/images/gpt/hero-jacket.jpg"
                  alt="Vintage brown leather jacket hanging on a wooden hanger"
                  width={1122}
                  height={1402}
                  sizes="(min-width: 640px) 314px, calc((100vw - 2.5rem) * 0.54)"
                  rotation={-2}
                  tapePlacement="top-center"
                  delay={0.1}
                  priority
                />
              </div>

              {/* Photograph 3: Lower-right vintage film camera */}
              <div className="absolute bottom-4 sm:bottom-6 right-2 sm:right-6 z-20 w-[43%] sm:w-[45%] max-w-[300px]">
                <PolaroidPhoto
                  src="/images/gpt/hero-bag.jpg"
                  alt="Vintage leather handbag with a gold chain strap"
                  width={1448}
                  height={1086}
                  sizes="(min-width: 640px) 252px, 43vw"
                  rotation={-5.5}
                  tapePlacement="top-right"
                  delay={0.3}
                />
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Bottom margin spacer */}
      <div className="h-6 sm:h-10 w-full shrink-0" aria-hidden="true" />

      {/* Asset 08 — Torn Cream Paper Strip along the hero's bottom boundary */}
      <div
        aria-hidden="true"
        className="paper-strip paper-strip-hero pointer-events-none select-none absolute inset-x-0 bottom-0 z-[5] h-16 sm:h-20 md:h-24"
      />
    </section>
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
