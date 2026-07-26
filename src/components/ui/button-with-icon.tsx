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
    setTimeout(() => setIsAnimating(false), 400);
  }, [isAnimating, onInterestedToggle]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group relative inline-flex items-center gap-2 rounded-full cursor-pointer select-none transition-all duration-300 ease-out transform-gpu",
        "font-semibold text-[13px] tracking-wide",
        "px-4 py-2 pe-3",
        "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        isInterested
          ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/30 focus-visible:ring-rose-400"
          : "bg-white text-slate-700 border border-slate-200 shadow-sm hover:border-rose-200 hover:shadow-md hover:shadow-rose-100/50 focus-visible:ring-slate-300",
        isAnimating && "scale-95",
        !isAnimating && "hover:scale-[1.02] active:scale-95",
        className
      )}
    >
      {/* Label */}
      <span className="relative z-10 transition-colors duration-200">
        {isInterested ? "Interested" : label}
      </span>

      {/* Heart Icon Container */}
      <span
        className={cn(
          "relative flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 ease-out transform-gpu",
          isInterested
            ? "bg-white/20 group-hover:bg-white/30"
            : "bg-rose-50 group-hover:bg-rose-100",
          isAnimating && "animate-bounce-once"
        )}
      >
        <Heart
          size={14}
          strokeWidth={2.5}
          className={cn(
            "transition-all duration-300 transform-gpu",
            isInterested
              ? "fill-white text-white scale-100"
              : "text-rose-400 group-hover:text-rose-500 group-hover:scale-110 fill-none",
            isAnimating && !isInterested && "scale-125 text-rose-500",
            isAnimating && isInterested && "scale-75"
          )}
        />
      </span>
    </button>
  );
};

export default ButtonWithIconDemo;
