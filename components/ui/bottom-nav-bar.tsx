"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Home,
  LineChart,
  CreditCard,
  MessageCircle,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/src/lib/route-prefetch";

export type BottomNavItem = {
  label: string;
  icon: LucideIcon | React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>;
  href?: string;
  onClick?: () => void;
};

const defaultNavItems: BottomNavItem[] = [
  { label: "Home", icon: Home },
  { label: "Portfolio", icon: LineChart },
  { label: "Transactions", icon: CreditCard },
  { label: "Messages", icon: MessageCircle },
  { label: "Rewards", icon: Trophy },
  { label: "Profile", icon: User },
];

const MOBILE_LABEL_WIDTH = 72;

export type BottomNavBarProps = {
  className?: string;
  defaultIndex?: number;
  activeIndex?: number;
  stickyBottom?: boolean;
  items?: BottomNavItem[];
  onChange?: (index: number, item: BottomNavItem) => void;
};

export function BottomNavBar({
  className,
  defaultIndex = 0,
  activeIndex: controlledIndex,
  stickyBottom = false,
  items = defaultNavItems,
  onChange,
}: BottomNavBarProps) {
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

  const handleItemClick = (idx: number, item: BottomNavItem) => {
    if (controlledIndex === undefined) {
      setInternalIndex(idx);
    }
    onChange?.(idx, item);
    item.onClick?.();
  };

  return (
    <motion.nav
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      role="navigation"
      aria-label="Bottom Navigation"
      style={{ fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      className={cn(
        "bg-[#FAF7F2]/95 dark:bg-card border border-[#493022]/15 dark:border-sidebar-border rounded-full flex items-center p-1.5 shadow-[0_10px_30px_-4px_rgba(54,34,18,0.18),0_4px_12px_rgba(54,34,18,0.08)] backdrop-blur-md space-x-1 min-w-fit max-w-[95vw] h-[52px]",
        stickyBottom && "fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom,0px))] mx-auto z-50 w-fit pointer-events-auto",
        className,
      )}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = activeIndex === idx;

        return (
          <motion.button
            key={item.label}
            data-active={isActive ? "true" : undefined}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "flex items-center gap-0 px-3 py-2 rounded-full transition-colors duration-180 relative h-10 min-w-[44px] min-h-[44px] max-h-[44px] font-bold select-none",
              isActive
                ? "bg-[#493022]/12 text-[#382212] gap-2"
                : "bg-transparent text-[#5c4033] hover:text-[#382212] hover:bg-[#493022]/6",
              "focus:outline-none focus-visible:ring-0",
            )}
            onClick={() => handleItemClick(idx, item)}
            onPointerEnter={() => item.href && prefetchRoute(item.href)}
            onFocus={() => item.href && prefetchRoute(item.href)}
            onTouchStart={() => item.href && prefetchRoute(item.href)}
            aria-label={item.label}
            type="button"
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2.6 : 2.2}
              aria-hidden
              className="transition-colors duration-200 shrink-0 text-inherit"
            />

            <motion.div
              initial={false}
              animate={{
                width: isActive ? `${MOBILE_LABEL_WIDTH}px` : "0px",
                opacity: isActive ? 1 : 0,
                marginLeft: isActive ? "6px" : "0px",
              }}
              transition={{
                width: { type: "spring", stiffness: 380, damping: 28 },
                opacity: { duration: 0.16 },
                marginLeft: { duration: 0.16 },
              }}
              className={cn("overflow-hidden flex items-center max-w-[72px]")}
            >
              <span
                className={cn(
                  "font-bold text-xs whitespace-nowrap select-none transition-opacity duration-200 overflow-hidden text-ellipsis leading-tight text-inherit",
                  isActive ? "text-[#382212]" : "text-[#5c4033]",
                )}
                title={item.label}
              >
                {item.label}
              </span>
            </motion.div>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}

export default BottomNavBar;
