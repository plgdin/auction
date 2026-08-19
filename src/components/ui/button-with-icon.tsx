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

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isAnimating) return;
      setIsAnimating(true);
      onInterestedToggle?.();
      setTimeout(() => setIsAnimating(false), 300);
    },
    [isAnimating, onInterestedToggle]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group/btn relative inline-flex items-center rounded-full cursor-pointer select-none shrink-0 overflow-hidden",
        "h-10 w-[154px]",
        "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "transition-all duration-300 ease-out transform-gpu",
        isInterested
          ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white border border-rose-500 shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/30 focus-visible:ring-rose-400"
          : "bg-white text-slate-700 border border-slate-200 shadow-sm hover:border-rose-300 hover:shadow-md hover:shadow-rose-100/50 focus-visible:ring-slate-300",
        isAnimating ? "scale-95" : "active:scale-95",
        className
      )}
    >
      <div className="relative w-full h-full flex items-center">
        {/* Uninterested Label */}
        <span
          className={cn(
            "absolute font-semibold text-[13px] tracking-wide whitespace-nowrap transition-all duration-300 ease-out",
            "left-3.5 text-slate-700 group-hover/btn:left-[50px]",
            isInterested ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          {label}
        </span>

        {/* Interested Label */}
        <span
          className={cn(
            "absolute left-[50px] font-semibold text-[13px] tracking-wide whitespace-nowrap text-white transition-all duration-300 ease-out",
            isInterested ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          Interested
        </span>

        {/* Heart Icon Circle */}
        <div
          className={cn(
            "absolute top-1.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ease-out",
            isInterested
              ? "left-[16px] bg-white/20"
              : "left-[118px] bg-rose-50 group-hover/btn:left-[16px] group-hover/btn:bg-rose-100"
          )}
        >
          <Heart
            size={14}
            strokeWidth={2.5}
            className={cn(
              "transition-all duration-300 ease-out",
              isInterested
                ? "fill-white text-white"
                : "text-rose-400 fill-none group-hover/btn:fill-rose-500 group-hover/btn:text-rose-500 group-hover/btn:scale-110",
              isAnimating && "animate-bounce-once"
            )}
          />
        </div>
      </div>
    </button>
  );
};

export default ButtonWithIconDemo;

