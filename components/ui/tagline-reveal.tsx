"use client";

import { useEffect, useRef, useState } from "react";

export interface TaglineRevealProps {
  lines?: string[];
  eyebrow?: string;
  className?: string;
}

const DEFAULT_LINES = [
  "Authentic vintage garments and curated wardrobe archives.",
  "Direct from local closets in Kerala to your door.",
];

export function TaglineReveal({
  lines = DEFAULT_LINES,
  eyebrow = "THE PHILOSOPHY",
  className = "",
}: TaglineRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeWordCount, setActiveWordCount] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Flatten all words across all lines
  const allWords = lines.flatMap((line) => line.split(/\s+/));
  const totalWords = allWords.length;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const onMotionChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", onMotionChange);
    return () => mediaQuery.removeEventListener("change", onMotionChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setActiveWordCount(totalWords);
      return;
    }

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!containerRef.current) {
            ticking = false;
            return;
          }

          const rect = containerRef.current.getBoundingClientRect();
          const windowHeight = window.innerHeight;

          // Trigger range: starts when top is at 80% of viewport, finishes when top is at 30%
          const start = windowHeight * 0.82;
          const end = windowHeight * 0.28;
          const progress = Math.min(Math.max((start - rect.top) / (start - end), 0), 1);

          const count = Math.round(progress * totalWords);
          setActiveWordCount(count);

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [totalWords, prefersReducedMotion]);

  let wordIndexCounter = 0;

  return (
    <section
      ref={containerRef}
      className={`relative w-full bg-[#11130d] border-y border-white/10 py-16 sm:py-24 px-6 sm:px-8 overflow-hidden select-none ${className}`}
      aria-label="Core manifesto"
    >
      {/* Ambient warm radial glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200, 155, 60, 0.12), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        {eyebrow && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-[0.24em] text-[#c89b3c] bg-white/[0.04] border border-[#c89b3c]/30 mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c89b3c]" />
            <span>{eyebrow}</span>
          </div>
        )}

        <div className="max-w-[760px] mx-auto space-y-3 sm:space-y-4">
          {lines.map((line, lineIndex) => {
            const lineWords = line.split(/\s+/);
            return (
              <p
                key={lineIndex}
                className="text-2xl sm:text-4xl lg:text-[40px] font-semibold leading-[1.3] tracking-tight text-white"
                style={{ textWrap: "balance" }}
              >
                {lineWords.map((word, wIdx) => {
                  const currentIdx = wordIndexCounter++;
                  const isActive = prefersReducedMotion || currentIdx < activeWordCount;

                  return (
                    <span
                      key={wIdx}
                      className="inline-block mr-[0.28em] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.32)",
                        transform: isActive ? "translateY(0)" : "translateY(2px)",
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </p>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] font-mono uppercase tracking-[0.22em] text-white/40">
          <span className="h-px w-8 bg-white/20" />
          <span>EST. 2028 · TRIVANDRUM</span>
          <span className="h-px w-8 bg-white/20" />
        </div>
      </div>
    </section>
  );
}

export default TaglineReveal;

