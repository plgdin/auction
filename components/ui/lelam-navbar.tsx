"use client";

import { LiquidNavbar, NimbusIcons, type LiquidNavItem } from "@/components/ui/liquid-glass-navbar";
import { Gavel, Heart, Search } from "lucide-react";
import type { Category } from "@/src/data";

export interface LelamNavbarProps {
  favoritesCount: number;
  bagCount: number;
  onOpenSearch: () => void;
  onOpenWatchlist: () => void;
  onOpenBag: () => void;
  onSelectCategory?: (category: Category) => void;
}

export function LelamNavbar({
  favoritesCount,
  bagCount,
  onOpenSearch,
  onOpenWatchlist,
  onOpenBag,
}: LelamNavbarProps) {
  const navItems: LiquidNavItem[] = [
    { label: "Live Auctions", icon: NimbusIcons.home, fx: "glow", href: "#shop" },
    { label: "How It Works", icon: NimbusIcons.plane, fx: "plane", href: "#how-it-works" },
    { label: "Sell on lelam", icon: NimbusIcons.drop, fx: "drop", href: "#sell" },
  ];

  const handleNavChange = (_: number, item: LiquidNavItem) => {
    if (item.href) {
      document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full select-none font-sans pointer-events-none">
      {/* Top ambient contrast scrim for crystal-clear readability across all images */}
      <div className="lelam-header-scrim" />

      {/* Main navigation row */}
      <div className="relative flex h-20 w-full items-center justify-between px-5 sm:px-8 lg:px-12 pointer-events-auto z-30">
        {/* Left: lelam.co Brand Logo */}
        <a
          href="#top"
          className="flex items-center text-white brand-logo no-underline shrink-0"
          aria-label="lelam.co home"
        >
          <span
            style={{
              fontFamily: '"Gumela Arabic", serif',
              fontSize: "clamp(30px, 2.5vw, 42px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              textTransform: "lowercase",
              color: "#ffffff",
              textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 0 24px rgba(0,0,0,0.5)",
            }}
          >
            lelam.co
          </span>
        </a>

        {/* Center: Fluid Liquid Glass Water Pill Navbar (Desktop) */}
        <div className="absolute left-1/2 top-3 hidden -translate-x-1/2 lg:block">
          <LiquidNavbar
            tone="dark"
            sound={true}
            defaultActive={0}
            items={navItems}
            onChange={handleNavChange}
          />
        </div>

        {/* Right: High-Contrast Premium Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Mobile Liquid Pill (Compact icons) */}
          <div className="flex lg:hidden mr-1">
            <LiquidNavbar
              tone="dark"
              compact={true}
              sound={true}
              items={navItems}
              onChange={handleNavChange}
            />
          </div>

          {/* Search Button */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="lelam-action-btn"
            aria-label="Search archive"
            title="Search archive"
          >
            <Search size={18} strokeWidth={2.2} />
          </button>

          {/* Watchlist / Saved Button */}
          <button
            type="button"
            onClick={onOpenWatchlist}
            className="lelam-action-btn"
            aria-label={`Saved finds, ${favoritesCount} items`}
            title="Watchlist"
          >
            <Heart
              size={18}
              strokeWidth={2.2}
              fill={favoritesCount > 0 ? "currentColor" : "none"}
            />
            {favoritesCount > 0 && (
              <span className="lelam-heart-badge">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Bid List Pill Button */}
          <button
            type="button"
            onClick={onOpenBag}
            className="lelam-bid-btn"
            aria-label={`Open bid list, ${bagCount} items`}
            title="Bid list"
          >
            <Gavel size={16} strokeWidth={2.3} />
            <span className="hidden xs:inline sm:inline">Bid list</span>
            <span className="lelam-bid-count">
              {bagCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default LelamNavbar;
