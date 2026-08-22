import React, { useState, useCallback } from "react";
import { Heart } from "lucide-react";
import { cn } from "../../lib/utils";

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
        "group/btn inline-flex items-center justify-between gap-2.5 h-10 px-4 rounded-full cursor-pointer select-none shrink-0 border outline-none font-bold text-xs sm:text-sm transition-all duration-200 shadow-3xs",
        isInterested
          ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/80 shadow-rose-100"
          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900",
        isAnimating ? "scale-95" : "active:scale-95",
        className
      )}
    >
      <span className="truncate">
        {isInterested ? "Interested" : label}
      </span>

      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
          isInterested
            ? "bg-rose-100/80 text-rose-600"
            : "bg-rose-50 text-rose-400 group-hover/btn:bg-rose-100 group-hover/btn:text-rose-500"
        )}
      >
        <Heart
          size={14}
          strokeWidth={2.5}
          className={cn(
            "transition-all duration-200",
            isInterested
              ? "fill-rose-500 text-rose-500"
              : "fill-none text-rose-400 group-hover/btn:fill-rose-500 group-hover/btn:text-rose-500"
          )}
        />
      </div>
    </button>
  );
};

export default ButtonWithIconDemo;
