import React, { useState, useCallback } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonWithIconProps {
  label?: string;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
  className?: string;
}

export const ButtonWithIconDemo: React.FC<ButtonWithIconProps> = ({
  label = "I'm Interested",
  isInterested = false,
  onInterestedToggle,
  className,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    onInterestedToggle?.();
    setTimeout(() => setIsAnimating(false), 500);
  }, [isAnimating, onInterestedToggle]);

  if (isInterested) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-2 rounded-full cursor-pointer select-none shrink-0",
          "font-semibold text-[13px] tracking-wide whitespace-nowrap",
          "h-10 px-4",
          "outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-400",
          "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/30",
          "transition-all duration-300 ease-out transform-gpu",
          isAnimating ? "scale-95" : "hover:scale-[1.03] active:scale-95",
          className
        )}
      >
        <span>Interested</span>
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
          <Heart
            size={14}
            strokeWidth={2.5}
            className={cn(
              "fill-white text-white transition-transform duration-300",
              isAnimating && "scale-75"
            )}
          />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group relative inline-flex items-center rounded-full cursor-pointer select-none shrink-0 overflow-hidden",
        "font-semibold text-[13px] tracking-wide whitespace-nowrap",
        "h-10 pl-5 pr-13 hover:pl-13 hover:pr-5",
        "outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300",
        "bg-white text-slate-700 border border-slate-200 shadow-sm hover:border-rose-300 hover:shadow-md hover:shadow-rose-100/50",
        "transition-all duration-500 ease-out transform-gpu",
        isAnimating ? "scale-95" : "active:scale-95",
        className
      )}
    >
      {/* Label — stays above the sliding circle */}
      <span className="relative z-10 transition-all duration-500 ease-out">{label}</span>

      {/* Sliding heart circle */}
      <div
        className={cn(
          "absolute top-1 bottom-1 right-1 w-8 rounded-full flex items-center justify-center",
          "bg-rose-50 transition-all duration-500 ease-out",
          "group-hover:right-[calc(100%-36px)] group-hover:bg-rose-100"
        )}
      >
        <Heart
          size={14}
          strokeWidth={2.5}
          className={cn(
            "text-rose-400 fill-none transition-all duration-500",
            "group-hover:fill-rose-500 group-hover:text-rose-500 group-hover:scale-110",
            isAnimating && "scale-125 fill-rose-500 text-rose-500"
          )}
        />
      </div>
    </button>
  );
};

export default ButtonWithIconDemo;
