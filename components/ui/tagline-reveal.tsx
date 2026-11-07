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
      className={`w-full py-8 sm:py-10 px-5 sm:px-8 max-w-4xl mx-auto flex flex-col items-center text-center select-none ${className}`}
      aria-label="Core manifesto"
    >
      {eyebrow && (
        <span className="text-sm sm:text-base uppercase tracking-[0.24em] font-bold text-[#c89b3c] mb-3 inline-block">
          {eyebrow}
        </span>
      )}

      <div className="max-w-[680px] mx-auto space-y-3">
        {lines.map((line, lineIndex) => {
          const lineWords = line.split(/\s+/);
          return (
            <p
              key={lineIndex}
              className="text-2xl sm:text-3xl md:text-4xl font-bold leading-[1.25] tracking-tight text-white"
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
                      color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.42)",
                      transform: isActive ? "translateY(0)" : "translateY(1px)",
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
    </section>
  );
}

export default TaglineReveal;

