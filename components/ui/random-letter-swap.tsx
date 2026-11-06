"use client";

import React, { useMemo, useState } from "react";
import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

export interface RandomLetterSwapProps {
  label: string;
  reverse?: boolean;
  transition?: Transition;
  staggerDuration?: number;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  isHovered?: boolean;
}

export function RandomLetterSwap({
  label,
  reverse = true,
  transition = { duration: 0.6, type: "spring" },
  staggerDuration = 0.025,
  className,
  onClick,
  ariaLabel,
  isHovered: controlledHovered,
  ...props
}: RandomLetterSwapProps & React.HTMLAttributes<HTMLSpanElement>) {
  const [internalHovered, setInternalHovered] = useState(false);
  const isHovered = controlledHovered !== undefined ? controlledHovered : internalHovered;

  const letters = useMemo(() => (label ?? "").split(""), [label]);

  // Deterministic pseudo-random stagger order for each character based on label string
  const randomizedDelays = useMemo(() => {
    const indices = letters.map((_, i) => i);
    let seed = 0;
    for (let i = 0; i < (label ?? "").length; i++) {
      seed = (seed * 31 + label.charCodeAt(i)) >>> 0;
    }
    const pseudoRandom = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return letters.map((_, i) => {
      const order = indices.indexOf(i);
      return Math.max(0, order) * staggerDuration;
    });
  }, [label, letters, staggerDuration]);

  return (
    <span
      className={cn(
        "relative inline-flex items-center overflow-hidden whitespace-nowrap select-none",
        className,
      )}
      onMouseEnter={(e) => {
        setInternalHovered(true);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setInternalHovered(false);
        props.onMouseLeave?.(e);
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel ?? label}
      {...props}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="inline-flex">
        {letters.map((char, index) => {
          const delay = randomizedDelays[index] ?? index * staggerDuration;
          const isSpace = char === " ";

          if (isSpace) {
            return (
              <span key={index} className="inline-block whitespace-pre">
                {"\u00A0"}
              </span>
            );
          }

          return (
            <span
              key={index}
              className="relative inline-flex flex-col overflow-hidden"
              style={{ verticalAlign: "middle" }}
            >
              {/* Primary character moving out */}
              <motion.span
                className="inline-block"
                animate={
                  isHovered
                    ? { y: reverse ? "100%" : "-100%", opacity: 0 }
                    : { y: "0%", opacity: 1 }
                }
                transition={{
                  ...transition,
                  delay: isHovered ? delay : (letters.length - 1 - index) * (staggerDuration * 0.5),
                }}
              >
                {char}
              </motion.span>

              {/* Ghost character sliding in */}
              <motion.span
                className="absolute inset-0 inline-flex items-center justify-center"
                initial={{ y: reverse ? "-100%" : "100%", opacity: 0 }}
                animate={
                  isHovered
                    ? { y: "0%", opacity: 1 }
                    : { y: reverse ? "-100%" : "100%", opacity: 0 }
                }
                transition={{
                  ...transition,
                  delay: isHovered ? delay : (letters.length - 1 - index) * (staggerDuration * 0.5),
                }}
              >
                {char}
              </motion.span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

export default RandomLetterSwap;
