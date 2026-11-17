"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Gavel,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  Search,
  Shield,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import { BookmarkNav, type BookmarkNavItem } from "@/components/ui/bookmark-nav";
import { navigate } from "@/src/components/Link";
import { useRoute } from "@/src/lib/router";
import { useStore } from "@/src/lib/store";

export interface LelamNavbarProps {
  favoritesCount: number;
  cartCount: number;
  unreadCount: number;
  onOpenSearch: () => void;
  onOpenSaved: () => void;
  onOpenCart: () => void;
}

export function LelamNavbar({
  favoritesCount,
  cartCount,
  unreadCount,
  onOpenSearch,
  onOpenSaved,
  onOpenCart,
}: LelamNavbarProps) {
  const { user, logout } = useStore();
  const route = useRoute();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const navItems: BookmarkNavItem[] = [
    { label: "Home", icon: Home, href: "#/" },
    { label: "Shop", icon: ShoppingBag, href: "#/products" },
    { label: "Auctions", icon: Gavel, href: "#/auctions" },
  ];

  const activeIndex =
    route.path === "/" || route.path === ""
      ? 0
      : route.path.startsWith("/products") || route.path.startsWith("/product/")
        ? 1
        : route.path.startsWith("/auctions") || route.path.startsWith("/auction/")
          ? 2
          : 0;
  const mobileActiveIndex =
    route.path === "/" || route.path === ""
      ? 0
      : route.path.startsWith("/products") || route.path.startsWith("/product/")
        ? 1
        : route.path.startsWith("/auctions") || route.path.startsWith("/auction/")
          ? 2
          : -1;

  const handleNavChange = (_: number, item: BookmarkNavItem) => {
    if (item.href) {
      setAccountOpen(false);
      navigate(item.href);
    }
  };


  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full select-none font-sans pointer-events-none">
      {/* Top Paper Craft Torn Edge — sits as the topmost layer above the header and bookmark anchors */}
      <div
        className="paper-craft-top absolute top-0 left-0 right-0 w-full pointer-events-none select-none overflow-hidden"
        style={{ height: "32px", zIndex: 45 }}
        aria-hidden="true"
      >
        <img
          src="/images/paper_craft_top.png"
          alt=""
          className="w-full h-full object-cover object-top"
          fetchPriority="high"
          style={{ borderRadius: 0 }}
        />
      </div>

      {/* Animated Hanging Bookmark Navigation — emerging seamlessly from underneath the torn paper edge */}
      <div className="mobile-bookmark-nav absolute left-1/2 top-0 -translate-x-1/2 pointer-events-auto z-30">
        <BookmarkNav
          items={navItems}
          active={activeIndex}
          onChange={handleNavChange}
        />
      </div>

      <div className="lelam-header-bar relative flex h-20 w-full items-center justify-between px-5 sm:px-8 lg:px-12 pointer-events-none z-35">
        <a
          href="#top"
          className="flex items-center text-[#493022] brand-logo no-underline shrink-0 pointer-events-auto"
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

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 pointer-events-auto">
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
            onClick={onOpenCart}
            className="lelam-bid-btn"
            title="Cart"
          >
            <ShoppingBag size={16} strokeWidth={2.3} />
            <span className="hidden xs:inline sm:inline">Cart</span>
            <span className="lelam-bid-count">{cartCount}</span>
          </button>

          <div className="relative" ref={accountRef}>
            <button
              ref={accountButtonRef}
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              className="lelam-action-btn lelam-account-btn"
              aria-label={`${user ? `Account menu for ${user.name}` : "Sign in"}${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={accountOpen}
              aria-controls="account-menu"
              title={user ? "Account" : "Sign in"}
            >
              <UserRound size={18} strokeWidth={2.2} />
              {unreadCount > 0 && <span className="lelam-unread-dot">{unreadCount}</span>}
            </button>

            {accountOpen && (
              <div id="account-menu" className="account-menu" role="group" aria-label="Account actions">
                <div className="account-menu-mobile-nav">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      onOpenCart();
                    }}
                  >
                    <ShoppingBag size={16} /> Your Cart
                    {cartCount > 0 && <em>{cartCount}</em>}
                  </button>
                  <div className="account-menu-sep" />
                </div>
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
                      onClick={() => {
                        setAccountOpen(false);
                        navigate("#/account");
                      }}
                    >
                      <LayoutDashboard size={16} /> My account
                    </button>
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
                    <button
                      type="button"
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
                      <span className="account-avatar">
                        <UserRound size={17} strokeWidth={2.2} />
                      </span>
                      <div>
                        <strong>Not signed in</strong>
                        <span>Sign in to buy, bid, and sell.</span>
                      </div>
                    </div>
                    <div className="account-menu-guest-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate("#/login");
                        }}
                        className="account-menu-signin-btn"
                      >
                        <span className="account-btn-inner">
                          <UserRound size={15} />
                          <span>Sign in</span>
                        </span>
                        <ArrowRight size={14} className="account-btn-arrow" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate("#/register");
                        }}
                        className="account-menu-register-btn"
                      >
                        <Store size={15} />
                        <span>Create account</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = mobileActiveIndex === index;
          return (
            <button
              key={item.label}
              type="button"
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "is-active" : ""}
              onClick={() => handleNavChange(index, item)}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}

export default LelamNavbar;
