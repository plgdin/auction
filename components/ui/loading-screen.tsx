"use client";

import { useEffect, useState } from "react";
import LiquidLoading from "@/components/ui/liquid-loader";
import { ArrowRight } from "lucide-react";

export interface LoadingScreenProps {
  onComplete?: () => void;
  minDuration?: number;
  autoDismiss?: boolean;
  background?: string;
  brandName?: string;
}

export function LoadingScreen({
  onComplete,
  minDuration = 3000,
  autoDismiss = true,
  background = "#0c0e09",
}: LoadingScreenProps) {
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!autoDismiss) return;
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => {
        setHidden(true);
        onComplete?.();
      }, 1250);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, autoDismiss, onComplete]);

  const handleSkip = () => {
    setFading(true);
    setTimeout(() => {
      setHidden(true);
      onComplete?.();
    }, 600);
  };

  if (hidden) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] w-screen h-screen overflow-hidden select-none pointer-events-auto flex flex-col items-center justify-between p-6 sm:p-10"
      style={{
        backgroundColor: background,
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
        transition: "opacity 1200ms cubic-bezier(0.16, 1, 0.3, 1), transform 1200ms cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 1200ms cubic-bezier(0.16, 1, 0.3, 1)",
        transform: fading ? "scale(1.03)" : "scale(1)",
        backdropFilter: fading ? "blur(0px)" : "blur(14px)",
        WebkitBackdropFilter: fading ? "blur(0px)" : "blur(14px)",
      }}
    >
      {/* Top bar with Skip option */}
      <div 
        className="w-full flex items-center justify-end z-10 transition-all duration-700 ease-out"
        style={{
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(-10px)" : "translateY(0)",
        }}
      >
        <button
          type="button"
          onClick={handleSkip}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.24em] font-medium text-white/40 hover:text-white transition-colors py-1.5 px-3.5 rounded-full border border-white/10 hover:border-white/30 bg-white/5 backdrop-blur-md cursor-pointer"
        >
          <span>Skip</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Centerpiece: Liquid Loading Bar with soft exit motion */}
      <div 
        className="flex-1 flex flex-col items-center justify-center transition-all duration-1000 ease-out"
        style={{
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(-18px) scale(0.92)" : "translateY(0) scale(1)",
          filter: fading ? "blur(8px)" : "none",
        }}
      >
        <LiquidLoading variant="website" size="md" />
      </div>

      {/* Discreet bottom status label */}
      <div 
        className="w-full flex items-center justify-center gap-2 pb-2 z-10 transition-all duration-700 ease-out"
        style={{
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(10px)" : "translateY(0)",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#5d6446] animate-pulse" />
        <span className="text-[11px] uppercase tracking-[0.25em] font-medium text-white/40 font-sans">
          Loading the rail…
        </span>
      </div>
    </div>
  );
}

export default LoadingScreen;
