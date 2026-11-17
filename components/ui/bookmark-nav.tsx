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
  const topBleed = 64; // Extends paper well above button top to eliminate any header gap
  const totalH = height + topBleed;

  // Outer paper path extending upward past top edge with bottom V-notch
  const outerPath = `M 0 0 L ${width} 0 L ${width} ${totalH} L ${halfW} ${
    totalH - notchDepth
  } L 0 ${totalH} Z`;

  // Inner dashed stitch path precisely tracking the V-notch and running up the sides into the header
  const innerStitchPath = `M ${innerInset} 0 L ${innerInset} ${totalH - innerInset} L ${halfW} ${
    totalH - notchDepth - innerInset
  } L ${width - innerInset} ${totalH - innerInset} L ${width - innerInset} 0`;

  const creamGradId = `bm-cream-${uniqueId}`;
  const brownGradId = `bm-brown-${uniqueId}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${totalH}`}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-visible drop-shadow-[0_5px_10px_rgba(45,25,12,0.22)]"
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
        transition={{ duration: 0.2, ease: "easeOut" }}
      />

      {/* Rich Dark Brown Paper Overlay (Active on Click) */}
      <motion.path
        d={outerPath}
        fill={`url(#${brownGradId})`}
        stroke="rgba(59, 32, 17, 0.6)"
        strokeWidth="0.8"
        animate={{ opacity: isActive ? 1 : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
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
        transition={{ duration: 0.2 }}
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
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
      // Brief visual feedback before smoothly retracting back to resting position
      leaveTimer.current = setTimeout(() => {
        setIsExpanded(false);
      }, 160);
    },
    [onChange]
  );

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
        role="group"
        aria-label="Sections"
        className="relative flex items-start justify-center gap-2 sm:gap-2.5"
      >
        {items.map((item, index) => {
          const ItemIcon = item.icon;
          const isActive = localActive === index;

          // Resting (not interacted) vs Pulled-down (interacted) levels:
          // Unsquashed natural 1:1 scale (scaleY: 1, scaleX: 1) so font typography is clean, crisp, and never squished.
          // Tucked state sits at -42px so bookmarks hang down with comfortable exposed length,
          // while text labels ("Home", "Shop", "Auctions") and V-notches hang naturally in full view.
          const tuckedY = -42;
          const pulledY = 8;

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
                      rotate: isExpanded ? (index === 0 ? -1.2 : index === 2 ? 1.2 : 0) : 0,
                    }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0.15 }
                  : {
                      y: {
                        type: "spring",
                        stiffness: 280,
                        damping: 24,
                        mass: 0.75,
                        delay: isExpanded ? index * 0.04 : 0,
                      },
                      rotate: {
                        type: "spring",
                        stiffness: 240,
                        damping: 20,
                        delay: isExpanded ? index * 0.04 : 0,
                      },
                    }
              }
              whileHover={
                !shouldReduceMotion
                  ? {
                      y: (isExpanded ? pulledY : tuckedY) + 3,
                      transition: { duration: 0.15, ease: "easeOut" },
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
                tabIndex={0}
                aria-label={`${item.label}${isActive ? " (current page)" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  handleSelect(index, item);
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
                {/* Bookmark Paper SVG backdrop with top edge extending seamlessly up into the header */}
                <div className="absolute -top-16 inset-x-0 bottom-0 z-20 pointer-events-none">
                  <BookmarkSvgBackdrop
                    width={68}
                    height={100}
                    notchDepth={12}
                    isActive={isActive}
                    uniqueId={`${componentId}-${item.label}`}
                  />
                </div>

                {/* Bookmark Content:
                    - Tucked state: Only text label is visible peeking out from under header edge; icon is hidden (opacity 0).
                    - Pulled-down state: Text smoothly transitions out (opacity 0, subtle drift & dissolve);
                                         Only the icon is displayed, centered on the bookmark body with playful spring physics.
                */}
                <div className="absolute inset-0 z-25 pointer-events-none">
                  {/* Hero Icon - centered in bookmark body above the bottom notch; visible ONLY in pulled-down state */}
                  <div className="absolute inset-x-0 top-0 bottom-4 sm:bottom-5 flex items-center justify-center">
                    <motion.div
                      animate={{
                        opacity: isExpanded ? 1 : 0,
                        scale: isExpanded ? 1 : 0.65,
                        y: isExpanded ? 0 : -6,
                      }}
                      transition={{
                        duration: isExpanded ? 0.22 : 0.16,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      style={{
                        transformOrigin: index === 2 ? "bottom left" : "center",
                        color: isActive ? "#F7EDDB" : "#493022",
                      }}
                      className="transition-colors duration-200"
                    >
                      <ItemIcon size={21} strokeWidth={2.2} className="sm:hidden" />
                      <ItemIcon size={25} strokeWidth={2.2} className="hidden sm:block" />
                    </motion.div>
                  </div>

                  {/* Text Label - centered vertically within the visible tucked bookmark tab; smoothly transitions out when pulled down */}
                  <div
                    className={`absolute inset-x-0 flex items-center justify-center ${
                      index === 2
                        ? "bottom-[18px] sm:bottom-[22.5px]"
                        : "bottom-[19px] sm:bottom-[23.5px]"
                    }`}
                  >
                    <motion.span
                      animate={
                        isExpanded
                          ? shouldReduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, y: 6, scale: 0.9, filter: "blur(0.8px)" }
                          : shouldReduceMotion
                          ? { opacity: 1 }
                          : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                      }
                      transition={{
                        duration: isExpanded ? 0.16 : 0.2,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="text-[11.5px] sm:text-[13px] leading-tight tracking-[0.01em] transition-colors duration-200 select-none whitespace-nowrap"
                      style={{
                        fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
                        fontWeight: isActive ? 800 : 700,
                        color: isActive ? "#F7EDDB" : "#493022",
                      }}
                    >
                      {item.label}
                    </motion.span>
                  </div>
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
