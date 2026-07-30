import React, { useState, useCallback } from "react";
import { Heart, ArrowUpRight } from "lucide-react";
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

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "relative inline-flex items-center rounded-full cursor-pointer select-none",
        "font-semibold text-[13px] tracking-wide",
        "h-10 p-1 overflow-hidden",
        "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "group transition-all duration-500 ease-out transform-gpu",
        isInterested
          ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/30 focus-visible:ring-rose-400 ps-4 pe-4"
          : "bg-white text-slate-700 border border-slate-200 shadow-sm hover:border-rose-200 hover:shadow-md hover:shadow-rose-100/50 focus-visible:ring-slate-300 ps-4 pe-12 hover:ps-12 hover:pe-4",
        isAnimating && "scale-95",
        !isAnimating && "active:scale-95",
        className
      )}
    >
      {/* Label */}
      <span className="relative z-10 transition-all duration-500 whitespace-nowrap">
        {isInterested ? "Interested" : label}
      </span>

      {/* Icon Container — slides from right to left on hover (only in non-interested state) */}
      {isInterested ? (
        <Heart
          size={14}
          strokeWidth={2.5}
          className={cn(
            "ml-2 fill-white text-white transition-transform duration-300",
            isAnimating && "scale-125"
          )}
        />
      ) : (
        <div
          className={cn(
            "absolute right-1 w-8 h-8 rounded-full flex items-center justify-center",
            "bg-rose-50 text-rose-500",
            "transition-all duration-500 ease-out",
            "group-hover:right-[calc(100%-36px)] group-hover:rotate-45 group-hover:bg-rose-100"
          )}
        >
          <ArrowUpRight size={15} strokeWidth={2.5} />
        </div>
      )}
    </button>
  );
};

export default ButtonWithIconDemo;
