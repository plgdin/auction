"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Gavel,
  Heart,
  LayoutDashboard,
  LogOut,
  Search,
  Shield,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import { LiquidNavbar, NimbusIcons, type LiquidNavItem } from "@/components/ui/liquid-glass-navbar";
import { navigate } from "@/src/components/Link";
import { useRoute } from "@/src/lib/router";
import { useStore } from "@/src/lib/store";

export interface LelamNavbarProps {
  favoritesCount: number;
  cartCount: number;
  unreadCount: number;
  onOpenSearch: () => void;
  onOpenSaved: () => void;
}

export function LelamNavbar({
  favoritesCount,
  cartCount,
  unreadCount,
  onOpenSearch,
  onOpenSaved,
}: LelamNavbarProps) {
  const { user, logout } = useStore();
  const route = useRoute();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [accountOpen]);

  const navItems: LiquidNavItem[] = [
    { label: "Home", icon: NimbusIcons.home, fx: "glow", href: "#/" },
    { label: "Shop", icon: NimbusIcons.globe, fx: "spin", href: "#/products" },
    {
      label: "Auctions",
      icon: <Gavel size={16} strokeWidth={2.2} />,
      fx: "glow",
      href: "#/auctions",
    },
  ];

  const activeIndex =
    route.path === "/" || route.path === ""
      ? 0
      : route.path.startsWith("/products") || route.path.startsWith("/product/")
        ? 1
        : route.path.startsWith("/auctions") || route.path.startsWith("/auction/")
          ? 2
          : -1;

  const handleNavChange = (_: number, item: LiquidNavItem) => {
    if (item.href) {
      setAccountOpen(false);
      navigate(item.href);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full select-none font-sans pointer-events-none">
      <div className="lelam-header-scrim" />

      {/* Top Paper Craft Torn Edge — sits in a layer below the navbar, logo, and action buttons */}
      <div
        className="paper-craft-top absolute top-0 left-0 right-0 w-full pointer-events-none select-none overflow-hidden"
        style={{ height: "32px", zIndex: 25 }}
        aria-hidden="true"
      >
        <img
          src="/images/paper_craft_top.png"
          alt=""
          className="w-full h-full object-cover object-top"
          style={{ borderRadius: 0 }}
        />
      </div>

      <div className="lelam-header-bar relative flex h-20 w-full items-center justify-between px-5 sm:px-8 lg:px-12 pointer-events-auto z-30">
        <a
          href="#top"
          className="flex items-center text-[#493022] brand-logo no-underline shrink-0"
          aria-label="lelam.co home"
          onClick={(event) => {
            event.preventDefault();
            navigate("#/");
          }}
        >
          <span
            style={{
              fontFamily: '"Gumela Arabic", serif',
              fontSize: "clamp(30px, 2.6vw, 42px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              textTransform: "lowercase",
              color: "#493022",
              WebkitTextStroke: "1.1px #493022",
              paintOrder: "stroke fill",
            }}
          >
            lelam.co
          </span>
        </a>

        <div className="absolute left-1/2 top-3 hidden -translate-x-1/2 lg:block">
          <LiquidNavbar
            tone="light"
            sound={true}
            active={activeIndex}
            items={navItems}
            onChange={handleNavChange}
          />
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="lelam-mobile-nav flex lg:hidden mr-1">
            <LiquidNavbar
              tone="light"
              compact={true}
              sound={true}
              active={activeIndex}
              items={navItems}
              onChange={handleNavChange}
            />
          </div>

          <button
            type="button"
            onClick={onOpenSearch}
            className="lelam-action-btn lelam-search-toggle"
            aria-label="Search listings"
            title="Search"
          >
            <Search size={18} strokeWidth={2.2} />
          </button>

          <button
            type="button"
            onClick={onOpenSaved}
            className="lelam-action-btn lelam-save-toggle"
            aria-label={`Saved finds, ${favoritesCount} items`}
            title="Watchlist"
          >
            <Heart size={18} strokeWidth={2.2} fill={favoritesCount > 0 ? "currentColor" : "none"} />
            {favoritesCount > 0 && <span className="lelam-heart-badge">{favoritesCount}</span>}
          </button>

          <button
            type="button"
            onClick={() => navigate("#/cart")}
            className="lelam-bid-btn"
            aria-label={`Open cart, ${cartCount} items`}
            title="Cart"
          >
            <ShoppingBag size={16} strokeWidth={2.3} />
            <span className="hidden xs:inline sm:inline">Cart</span>
            <span className="lelam-bid-count">{cartCount}</span>
          </button>

          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              className="lelam-action-btn lelam-account-btn"
              aria-label={user ? `Account menu for ${user.name}` : "Sign in"}
              aria-expanded={accountOpen}
              title={user ? "Account" : "Sign in"}
            >
              <UserRound size={18} strokeWidth={2.2} />
              {unreadCount > 0 && <span className="lelam-unread-dot">{unreadCount}</span>}
            </button>

            {accountOpen && (
              <div className="account-menu" role="menu">
                {user ? (
                  <>
                    <div className="account-menu-head">
                      <span className="account-avatar">{user.name.slice(0, 1)}</span>
                      <div>
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountOpen(false);
                        navigate("#/account");
                      }}
                    >
                      <LayoutDashboard size={16} /> My account
                    </button>
                    {user.isSeller && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate("#/seller");
                        }}
                      >
                        <Store size={16} /> Seller dashboard
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountOpen(false);
                        navigate("#/account?tab=notifications");
                      }}
                    >
                      <Bell size={16} /> Notifications
                      {unreadCount > 0 && <em>{unreadCount}</em>}
                    </button>
                    {user.role === "admin" && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate("#/admin");
                        }}
                      >
                        <Shield size={16} /> Admin panel
                      </button>
                    )}
                    <div className="account-menu-sep" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        logout();
                        setAccountOpen(false);
                        navigate("#/login");
                      }}
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <div className="account-menu-head">
                      <span className="account-avatar">?</span>
                      <div>
                        <strong>Not signed in</strong>
                        <span>Sign in to buy, sell, and track delivery.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountOpen(false);
                        navigate("#/login");
                      }}
                    >
                      <UserRound size={16} /> Sign in
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountOpen(false);
                        navigate("#/register");
                      }}
                    >
                      <Store size={16} /> Create account
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default LelamNavbar;
