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
      setTimeout(() => setIsAnimating(false), 250);
    },
    [isAnimating, onInterestedToggle]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group/btn relative inline-flex items-center justify-center rounded-full cursor-pointer select-none shrink-0 overflow-hidden px-1",
        "h-10 w-[154px]",
        "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "transition-all duration-200 ease-out transform-gpu",
        isInterested
          ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/30 focus-visible:ring-rose-400"
          : "bg-white text-slate-700 border border-slate-200 shadow-sm hover:border-rose-300 hover:shadow-md hover:shadow-rose-100/50 focus-visible:ring-slate-300",
        isAnimating ? "scale-95" : "active:scale-95",
        className
      )}
    >
      {isInterested ? (
        <div className="flex items-center justify-center gap-2 w-full px-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 shrink-0">
            <Heart
              size={14}
              strokeWidth={2.5}
              className={cn(
                "fill-white text-white transition-transform duration-200",
                isAnimating && "scale-75"
              )}
            />
          </span>
          <span className="font-semibold text-[13px] tracking-wide whitespace-nowrap">
            Interested
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between w-full relative px-2.5">
          <span className="font-semibold text-[13px] tracking-wide whitespace-nowrap text-slate-700 transition-all duration-300 ease-out group-hover/btn:translate-x-8">
            {label}
          </span>

          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
              "bg-rose-50 transition-all duration-300 ease-out",
              "group-hover/btn:-translate-x-[104px] group-hover/btn:bg-rose-100"
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
        </div>
      )}
    </button>
  );
};

export default ButtonWithIconDemo;
