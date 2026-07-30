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
    setTimeout(() => setIsAnimating(false), 300);
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
          "transition-[transform,background-color,box-shadow] duration-200 ease-out transform-gpu",
          isAnimating ? "scale-95" : "hover:scale-[1.03] active:scale-95",
          className
        )}
      >
        <span>Interested</span>
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors duration-200">
          <Heart
            size={14}
            strokeWidth={2.5}
            className={cn(
              "fill-white text-white transition-transform duration-200",
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
        "group/btn relative inline-flex items-center rounded-full cursor-pointer select-none shrink-0 overflow-hidden",
        "h-10 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300",
        "bg-white border border-slate-200 shadow-sm hover:border-rose-300 hover:shadow-md hover:shadow-rose-100/50",
        "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out transform-gpu",
        isAnimating ? "scale-95" : "active:scale-95",
        className
      )}
    >
      {/* Invisible layout setter: defines exact button width statically without animating */}
      <div className="invisible pl-4 pr-12 flex items-center h-full font-semibold text-[13px] tracking-wide whitespace-nowrap">
        {label}
      </div>

      {/* Visible animated text label */}
      <span className="absolute inset-y-0 left-0 pl-4 flex items-center font-semibold text-[13px] tracking-wide whitespace-nowrap text-slate-700 transition-transform duration-200 ease-out transform-gpu group-hover/btn:translate-x-8">
        {label}
      </span>

      {/* Sliding heart circle */}
      <div
        className={cn(
          "absolute top-1 bottom-1 right-1 w-8 rounded-full flex items-center justify-center",
          "bg-rose-50 transition-[right,background-color] duration-200 ease-out",
          "group-hover/btn:right-[calc(100%-36px)] group-hover/btn:bg-rose-100"
        )}
      >
        <Heart
          size={14}
          strokeWidth={2.5}
          className={cn(
            "text-rose-400 fill-none transition-all duration-200",
            "group-hover/btn:fill-rose-500 group-hover/btn:text-rose-500 group-hover/btn:scale-110",
            isAnimating && "scale-125 fill-rose-500 text-rose-500"
          )}
        />
      </div>
    </button>
  );
};

export default ButtonWithIconDemo;
