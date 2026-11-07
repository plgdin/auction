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
      className={`w-full py-20 sm:py-28 px-5 sm:px-8 max-w-5xl mx-auto flex flex-col items-center text-center select-none ${className}`}
      aria-label="Core manifesto"
    >
      {eyebrow && (
        <span className="text-xs uppercase tracking-[0.24em] font-medium text-[#c89b3c] mb-6 inline-block">
          {eyebrow}
        </span>
      )}

      <div className="max-w-[680px] mx-auto space-y-4">
        {lines.map((line, lineIndex) => {
          const lineWords = line.split(/\s+/);
          return (
            <p
              key={lineIndex}
              className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-[1.18] tracking-tight"
              style={{ textWrap: "balance" }}
            >
              {lineWords.map((word, wIdx) => {
                const currentIdx = wordIndexCounter++;
                const isActive = prefersReducedMotion || currentIdx < activeWordCount;

                return (
                  <span
                    key={wIdx}
                    className="inline-block mr-[0.28em] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.28)",
                      transform: isActive ? "translateY(0)" : "translateY(2px)",
                      filter: isActive ? "none" : "blur(0.4px)",
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

