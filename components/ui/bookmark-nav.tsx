"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Gavel, Home, ShoppingBag } from "lucide-react";

export interface BookmarkNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

export interface BookmarkNavProps {
  items?: BookmarkNavItem[];
  active?: number;
  onChange?: (index: number, item: BookmarkNavItem) => void;
  className?: string;
  id?: string;
}

const DEFAULT_ITEMS: BookmarkNavItem[] = [
  { label: "Home", href: "#/", icon: Home },
  { label: "Shop", href: "#/products", icon: ShoppingBag },
  { label: "Auctions", href: "#/auctions", icon: Gavel },
];

/**
 * Whimsical hand-drawn radiating tick marks (\ | /)
 * Scrapbook accent doodle positioned beside the bookmarks.
 */
function WhimsicalTicks({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 20 24"
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      <path
        d="M 16 5 L 4 2"
        stroke="#493022"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M 18 12 L 2 12"
        stroke="#493022"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.82"
      />
      <path
        d="M 16 19 L 4 22"
        stroke="#493022"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

/**
 * Bookmark SVG paper background with swallowtail V-notch.
 * Upward bleed ensures top paper edge seamlessly emerges from behind the screen top.
 */
function BookmarkSvgBackdrop({
  width = 68,
  height = 100,
  isActive = false,
  notchDepth = 12,
  uniqueId,
}: {
  width?: number;
  height?: number;
  isActive?: boolean;
  notchDepth?: number;
  uniqueId: string;
}) {
  const halfW = width / 2;
  const innerInset = 4;
  const bleedTop = -32; // Extends paper well above top edge

  // Outer paper path extending upward past top edge with bottom V-notch
  const outerPath = `M 0 ${bleedTop} L ${width} ${bleedTop} L ${width} ${height} L ${halfW} ${
    height - notchDepth
  } L 0 ${height} Z`;

  // Inner dashed stitch path precisely tracking the V-notch and running up the sides
  const innerStitchPath = `M ${innerInset} ${bleedTop} L ${
    width - innerInset
  } ${bleedTop} L ${width - innerInset} ${height - innerInset} L ${halfW} ${
    height - notchDepth - innerInset
  } L ${innerInset} ${height - innerInset} Z`;

  const creamGradId = `bm-cream-${uniqueId}`;
  const brownGradId = `bm-brown-${uniqueId}`;

  return (
    <svg
      viewBox={`0 ${bleedTop} ${width} ${height - bleedTop}`}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-visible"
      style={{
        filter: isActive
          ? "drop-shadow(0 7px 14px rgba(45, 25, 12, 0.3)) drop-shadow(0 2px 4px rgba(45, 25, 12, 0.16))"
          : "drop-shadow(0 5px 10px rgba(45, 25, 12, 0.18)) drop-shadow(0 1px 3px rgba(45, 25, 12, 0.1))",
        transition: "filter 0.25s ease",
      }}
      aria-hidden="true"
    >
      <defs>
        {/* Warm cream / ivory parchment gradient for inactive state */}
        <linearGradient id={creamGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCF9F1" />
          <stop offset="55%" stopColor="#F6EEDA" />
          <stop offset="100%" stopColor="#EDE2CA" />
        </linearGradient>

        {/* Rich dark chocolate brown gradient for active/clicked state */}
        <linearGradient id={brownGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5A3620" />
          <stop offset="55%" stopColor="#492B18" />
          <stop offset="100%" stopColor="#3B2011" />
        </linearGradient>
      </defs>

      {/* Warm Cream Paper Base */}
      <motion.path
        d={outerPath}
        fill={`url(#${creamGradId})`}
        stroke="rgba(89, 54, 28, 0.28)"
        strokeWidth="0.8"
        animate={{ opacity: isActive ? 0 : 1 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      />

      {/* Rich Dark Brown Paper Overlay (Active on Click) */}
      <motion.path
        d={outerPath}
        fill={`url(#${brownGradId})`}
        stroke="rgba(59, 32, 17, 0.6)"
        strokeWidth="0.8"
        animate={{ opacity: isActive ? 1 : 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      />

      {/* Handmade Stitched Dashed Border */}
      <motion.path
        d={innerStitchPath}
        fill="none"
        strokeWidth="1.2"
        strokeDasharray="3.5 2.5"
        strokeLinecap="round"
        animate={{
          stroke: isActive ? "rgba(245, 235, 220, 0.45)" : "rgba(89, 54, 28, 0.42)",
        }}
        transition={{ duration: 0.25 }}
      />
    </svg>
  );
}

export function BookmarkNav({
  items = DEFAULT_ITEMS,
  active = 0,
  onChange,
  className = "",
  id,
}: BookmarkNavProps) {
  const [localActive, setLocalActive] = useState(active >= 0 ? active : 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);
  const bookmarkButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const componentId = id || baseId;
  const shouldReduceMotion = useReducedMotion();

  // Synchronize with external active prop (e.g. on direct URL load or route change)
  useEffect(() => {
    if (active >= 0 && active < items.length) {
      setLocalActive(active);
    }
  }, [active, items.length]);

  // Handle pointer enter: cancel close timer and pull bookmarks down
  const handleMouseEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setIsExpanded(true);
  };

  // Handle pointer leave: retract after a short buffer delay (380ms)
  const handleMouseLeave = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
    }
    leaveTimer.current = setTimeout(() => {
      setIsExpanded(false);
    }, 380);
  };

  // Outside click handler to collapse on mobile or outside tap
  useEffect(() => {
    if (!isExpanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isExpanded]);

  // Keyboard navigation & Escape key handler
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

  const handleSelect = useCallback(
    (index: number, item: BookmarkNavItem) => {
      setLocalActive(index);
      if (onChange) {
        onChange(index, item);
      }
      // Brief visual feedback before smoothly retracting back to resting position
      setTimeout(() => {
        setIsExpanded(false);
      }, 160);
    },
    [onChange]
  );

  // Staggered pull-down timings: Home ~300ms, Shop ~380ms, Auctions ~460ms
  const staggerDelays = [0, 0.08, 0.16];
  const swingRotations = [
    [0, -2.0, 1.0, -0.3, 0],
    [0, 1.8, -0.9, 0.3, 0],
    [0, -1.8, 0.9, -0.3, 0],
  ];

  return (
    <nav
      ref={containerRef}
      id={`bookmark-nav-${componentId}`}
      aria-label="Main Navigation"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-flex flex-col items-center select-none pt-0 ${className}`}
    >
      {/* Whimsical sketchbook doodle tick marks to the left of the bookmarks */}
      <div className="absolute -left-6 sm:-left-7 top-3 sm:top-4 pointer-events-none hidden xs:block">
        <WhimsicalTicks />
      </div>

      {/* The 3 Bookmarks */}
      <div
        role="menubar"
        aria-label="Sections"
        className="relative flex items-start justify-center gap-2 sm:gap-2.5"
      >
        {items.map((item, index) => {
          const ItemIcon = item.icon;
          const isActive = localActive === index;

          // Resting (not interacted) vs Pulled-down (interacted) levels:
          // In resting state: moved UP (-52px) so icons are tucked completely above the viewport,
          // and ONLY the text labels (positioned a bit down towards the notch) and V-notches peek down.
          // In pulled-down state: slides down (+12px), revealing the full paper bookmarks & icons with playful animations.
          const tuckedY = -52;
          const pulledY = 12;

          return (
            <motion.div
              key={item.label}
              role="none"
              style={{
                transformOrigin: "top center",
              }}
              initial={false}
              animate={
                shouldReduceMotion
                  ? { y: isExpanded ? pulledY : tuckedY }
                  : {
                      y: isExpanded ? pulledY : tuckedY,
                      scaleY: isExpanded ? [0.72, 1.07, 0.98, 1] : [1, 0.68, 0.72],
                      scaleX: isExpanded ? [0.92, 0.96, 1.02, 1] : [1, 0.94, 0.92],
                      rotate: isExpanded ? swingRotations[index] : 0,
                      transition: {
                        type: "spring",
                        stiffness: 160 - index * 10,
                        damping: 17,
                        mass: 0.85 + index * 0.08,
                        delay: isExpanded ? staggerDelays[index] : 0,
                      },
                    }
              }
              whileHover={
                isExpanded && !shouldReduceMotion
                  ? {
                      y: pulledY + 3,
                      rotate: index === 0 ? -1.2 : index === 2 ? 1.2 : -0.3,
                      transition: { duration: 0.18, ease: "easeOut" },
                    }
                  : {}
              }
              whileTap={
                shouldReduceMotion
                  ? {}
                  : {
                      scale: 0.98,
                      transition: { duration: 0.1 },
                    }
              }
            >
              <button
                ref={(el) => {
                  bookmarkButtonsRef.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={0}
                aria-label={`${item.label}${isActive ? " (current page)" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  if (!isExpanded) {
                    setIsExpanded(true);
                  } else {
                    handleSelect(index, item);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    const nextIdx = (index + 1) % items.length;
                    bookmarkButtonsRef.current[nextIdx]?.focus();
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    const prevIdx = (index - 1 + items.length) % items.length;
                    bookmarkButtonsRef.current[prevIdx]?.focus();
                  }
                }}
                className="group relative flex flex-col items-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#493022] focus-visible:ring-offset-2 rounded-t-sm w-[56px] h-[92px] sm:w-[68px] sm:h-[100px]"
              >
                {/* Bookmark Paper SVG backdrop with top edge extending seamlessly up */}
                <div className="absolute inset-0 w-full h-full z-20">
                  <BookmarkSvgBackdrop
                    width={68}
                    height={100}
                    notchDepth={12}
                    isActive={isActive}
                    uniqueId={`${componentId}-${item.label}`}
                  />
                </div>

                {/* Bookmark Content: Text positioned down towards the notch; Icon sits above text */}
                <div className="absolute inset-0 z-25 flex flex-col items-center justify-end pb-3 sm:pb-3.5">
                  {/* Icon with playful light animation when pulled down (hidden when resting) */}
                  <motion.div
                    animate={
                      isExpanded && !shouldReduceMotion
                        ? index === 0
                          ? { scale: [1, 1.2, 0.94, 1], y: [0, -3, 1, 0] } // Home gentle bounce
                          : index === 1
                          ? { rotate: [0, -14, 10, -4, 0], scale: [1, 1.12, 1] } // Shop tote bag swing
                          : { rotate: [0, -24, 6, -2, 0], scale: [1, 1.14, 1] } // Auctions gavel tap
                        : { scale: 1, rotate: 0, y: 0 }
                    }
                    transition={{
                      duration: 0.45,
                      delay: staggerDelays[index] + 0.12,
                      ease: "easeOut",
                    }}
                    style={{
                      transformOrigin: index === 2 ? "bottom left" : "center",
                      color: isActive ? "#F7EDDB" : "#493022",
                    }}
                    className="transition-colors duration-200 mb-1.5 sm:mb-2"
                  >
                    <ItemIcon size={18} strokeWidth={2.2} className="sm:hidden" />
                    <ItemIcon size={21} strokeWidth={2.2} className="hidden sm:block" />
                  </motion.div>

                  {/* Text Label - sits a little bit down towards the V-notch */}
                  <span
                    className="text-[11px] sm:text-[12.5px] leading-tight tracking-[-0.01em] transition-colors duration-200"
                    style={{
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontWeight: isActive ? 800 : 700,
                      color: isActive ? "#F7EDDB" : "#493022",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}

export default BookmarkNav;
