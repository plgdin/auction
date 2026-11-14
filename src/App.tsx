import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Heart, LogIn, Search, ShoppingBag, UserPlus, X } from "lucide-react";
import { LelamNavbar } from "@/components/ui/lelam-navbar";
import HalftoneWordmarkFooter from "@/components/ui/halftone-wordmark-footer";
import { Link, navigate } from "./components/Link";
import { Modal } from "./components/Modal";
import { onAuthPrompt, withNext, type AuthPromptDetail } from "./lib/authGate";
import { formatMoney } from "./lib/format";
import { useRoute } from "./lib/router";
import { StoreProvider, useStore } from "./lib/store";
import { toast } from "./lib/toast";
import { HomePage } from "./pages/Home";
import { ProductsPage } from "./pages/Products";
import { ProductDetailPage } from "./pages/ProductDetail";
import { CartPage } from "./pages/Cart";
import { CheckoutPage } from "./pages/Checkout";
import { AuctionsPage } from "./pages/Auctions";
import { AuctionDetailPage } from "./pages/AuctionDetail";
import { AuthPage } from "./pages/Auth";
import { SellPage } from "./pages/Sell";
import { SellerDashboardPage } from "./pages/SellerDashboard";
import { AccountPage } from "./pages/Account";
import { AdminPage } from "./pages/Admin";
import { OrderDetailPage } from "./pages/OrderDetail";

type ToastItem = { id: number; message: string; tone: string };

function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone: string }>).detail;
      if (!detail?.message) return;
      const id = Date.now() + Math.random();
      setItems((previous) => [...previous, { id, message: detail.message, tone: detail.tone }]);
      window.setTimeout(() => {
        setItems((previous) => previous.filter((item) => item.id !== id));
      }, 3600);
    };
    window.addEventListener("lelam-toast", onToast);
    return () => window.removeEventListener("lelam-toast", onToast);
  }, []);

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast toast-${item.tone}`}>
          <span>{item.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setItems((previous) => previous.filter((entry) => entry.id !== item.id))}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { db } = useStore();
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();

  const results = useMemo(() => {
    const active = db.products.filter((product) => product.status === "active");
    if (!search) return active.slice(0, 4);
    return active
      .filter((product) =>
        `${product.title} ${product.description} ${product.brand ?? ""} ${product.category} ${product.sellerName}`
          .toLowerCase()
          .includes(search),
      )
      .slice(0, 6);
  }, [db.products, search]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
        {/* Scrim Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#25170F]/60 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-[#D5C2A5] shadow-[0_24px_64px_rgba(40,24,14,0.4)]"
          style={{ backgroundColor: "#FAF4EB" }}
        >
          {/* Header */}
          <div className="relative pt-6 pb-2 px-6 text-center">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#6D533E] hover:bg-[#EBDDC8] hover:text-[#332417] transition-all"
              aria-label="Close search"
            >
              <X size={18} strokeWidth={2.4} />
            </button>

            <h2 className="text-xl sm:text-2xl tracking-tight select-none inline-flex items-baseline justify-center gap-1.5">
              <span className="text-[#6D533E] font-medium font-sans">
                search on
              </span>
              <span
                style={{
                  fontFamily: '"Gumela Arabic", serif',
                  fontWeight: 800,
                  textTransform: "lowercase",
                  color: "#493022",
                  WebkitTextStroke: "0.8px #493022",
                  paintOrder: "stroke fill",
                  fontSize: "1.25em",
                  lineHeight: 1,
                }}
              >
                lelam
              </span>
            </h2>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Search Input Bar with Framer Motion */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) {
                  onClose();
                  navigate(`#/products?q=${encodeURIComponent(query.trim())}`);
                }
              }}
              className="relative"
            >
              <div
                className="relative flex items-center gap-2 overflow-hidden rounded-full border border-[#CBB693] bg-[#FFFDF9] shadow-[0_2px_12px_rgba(73,48,34,0.08)] transition-shadow"
                style={{ backgroundColor: "#FFFDF9", borderColor: "#CBB693" }}
              >
                <div className="ml-4 flex items-center justify-center text-[#8C745A]">
                  <Search size={18} strokeWidth={2.2} />
                </div>
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Denim, a leather jacket, homeware…"
                  aria-label="Search listings"
                  className="h-12 flex-1 bg-transparent pr-3 font-sans text-sm sm:text-base text-[#332417] placeholder:text-[#9C856C] outline-none"
                  style={{ color: "#332417" }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="mr-2 flex h-7 w-7 items-center justify-center rounded-full text-[#8C745A] hover:bg-[#EBDDC8] hover:text-[#493022] transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </form>

            {/* Live Search Results */}
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C745A]">
                  {search ? `${results.length} results` : "Fresh on the rail"}
                </span>
              </div>

              <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {results.length ? (
                  results.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`#/product/${product.id}`);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-[#FFFDF9] border border-[#E8DCCB] text-left transition-all hover:border-[#CBB693] hover:shadow-sm group"
                      style={{ backgroundColor: "#FFFDF9", borderColor: "#E8DCCB" }}
                    >
                      <img
                        src={product.images[0]}
                        alt=""
                        className="h-12 w-12 rounded-xl object-cover border border-[#D5C2A5]/70 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <strong
                          className="block text-sm font-semibold truncate group-hover:text-[#8C5E3C] transition-colors"
                          style={{ color: "#332417" }}
                        >
                          {product.title}
                        </strong>
                        <span className="text-xs text-[#8C745A]">
                          {product.condition} · {product.sellerName}
                        </span>
                      </div>
                      <strong
                        className="font-serif text-sm font-semibold shrink-0"
                        style={{ color: "#493022" }}
                      >
                        {formatMoney(product.askingPrice)}
                      </strong>
                    </button>
                  ))
                ) : (
                  <div
                    className="py-8 text-center rounded-2xl border border-dashed border-[#D5C2A5] text-[#8C745A]"
                    style={{ backgroundColor: "#F4E9D8" }}
                  >
                    <p className="text-sm font-medium">Nothing matched &ldquo;{query}&rdquo;</p>
                    <p className="text-xs mt-1">Try a different keyword or browse categories above.</p>
                  </div>
                )}
              </div>
            </div>

            {/* See All Listings CTA */}
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`#/products${search ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-sm font-semibold shadow-md transition-all hover:opacity-95 active:scale-[0.99]"
              style={{ backgroundColor: "#493022", color: "#FAF4EB" }}
            >
              <span>See all listings {search ? `for "${query.trim()}"` : ""}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function SavedOverlay({ onClose }: { onClose: () => void }) {
  const { db, favorites, toggleFavorite } = useStore();
  const saved = db.products.filter((product) => favorites.includes(product.id));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Scrim Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#25170F]/60 backdrop-blur-md"
        />

        {/* Drawer Window */}
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 32 }}
          className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#D5C2A5] shadow-[-20px_0_60px_rgba(40,24,14,0.35)]"
          style={{ backgroundColor: "#FAF4EB" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E8DCCB] px-6 py-5 bg-[#FAF4EB]">
            <div className="flex items-center gap-2.5">
              <Heart size={18} className="text-[#8C5E3C] fill-[#8C5E3C]/20" />
              <h2
                className="text-xl sm:text-2xl tracking-tight select-none inline-flex items-baseline gap-1.5"
                style={{
                  fontFamily: '"Gumela Arabic", serif',
                  fontWeight: 800,
                  color: "#493022",
                  textTransform: "lowercase",
                  WebkitTextStroke: "0.6px #493022",
                  paintOrder: "stroke fill",
                }}
              >
                saved finds
              </h2>
              {saved.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EBDDC8] text-[#493022]">
                  {saved.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#6D533E] hover:bg-[#EBDDC8] hover:text-[#332417] transition-all"
              aria-label="Close saved drawer"
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 scrollbar-thin flex flex-col">
            {saved.length ? (
              <div className="space-y-3 flex-1">
                {saved.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#FFFDF9] border border-[#E8DCCB] transition-all hover:border-[#CBB693] hover:shadow-sm group"
                    style={{ backgroundColor: "#FFFDF9", borderColor: "#E8DCCB" }}
                  >
                    <Link
                      href={`#/product/${product.id}`}
                      onClick={onClose}
                      className="h-14 w-14 rounded-xl overflow-hidden border border-[#D5C2A5]/70 shrink-0 bg-[#F4E9D8]"
                    >
                      <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`#/product/${product.id}`}
                        onClick={onClose}
                        className="block text-sm font-semibold truncate hover:text-[#8C5E3C] transition-colors"
                        style={{ color: "#332417" }}
                      >
                        {product.title}
                      </Link>
                      <p className="text-xs text-[#8C745A] mt-0.5">
                        {product.condition} ·{" "}
                        <span className="font-serif font-semibold" style={{ color: "#493022" }}>
                          {formatMoney(product.askingPrice)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${product.title} from saved`}
                      onClick={() => {
                        toggleFavorite(product.id);
                        toast("Removed from saved.");
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[#8C745A] hover:bg-[#F3E7D3] hover:text-[#9A3412] transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="my-auto flex flex-col items-center justify-center py-12 px-4 text-center">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#DECDB4] shadow-sm"
                  style={{ backgroundColor: "#F3E7D3" }}
                >
                  <Heart size={28} className="text-[#8C5E3C]" />
                </div>
                <h3 className="font-serif text-2xl font-normal text-[#332417] mb-1.5">
                  Nothing saved yet.
                </h3>
                <p className="text-xs sm:text-sm text-[#8C745A] max-w-[260px] leading-relaxed mb-6">
                  Tap the heart on any piece you love to keep it here for later.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate("#/products");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl py-3 px-6 text-sm font-semibold shadow-md transition-all hover:opacity-95 active:scale-[0.99]"
                  style={{ backgroundColor: "#493022", color: "#FAF4EB" }}
                >
                  <span>Browse the rail</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Drawer Footer if items exist */}
          {saved.length > 0 && (
            <div className="border-t border-[#E8DCCB] p-4 bg-[#FAF4EB]">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("#/products");
                }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-sm font-semibold shadow-md transition-all hover:opacity-95 active:scale-[0.99]"
                style={{ backgroundColor: "#493022", color: "#FAF4EB" }}
              >
                <span>Browse more pieces</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function AuthPrompt({
  detail,
  onClose,
}: {
  detail: AuthPromptDetail;
  onClose: () => void;
}) {
  return (
    <Modal title="Sign in to continue" onClose={onClose}>
      <div className="auth-prompt">
        <div className="auth-prompt-icon">
          <ShoppingBag size={26} />
        </div>
        <h2>{detail.action || "Sign in to keep going."}</h2>
        <p>
          Create a free account to buy, add to cart, make private offers, and follow your
          delivery. It takes a moment, and your cart comes with you.
        </p>
        <div className="auth-prompt-actions">
          <Link
            href={withNext("#/login", detail.next)}
            className="button button-olive"
            onClick={onClose}
          >
            <LogIn size={17} /> Sign in
          </Link>
          <Link
            href={withNext("#/register", detail.next)}
            className="button button-ghost"
            onClick={onClose}
          >
            <UserPlus size={17} /> Create account
          </Link>
        </div>
        <span className="auth-prompt-note">
          Demo accounts are on the sign-in page. No real payment is taken.
        </span>
      </div>
    </Modal>
  );
}

function NotFound() {
  return (
    <main className="page-shell">
      <div className="section-wrap empty-state page-empty">
        <ShoppingBag size={38} />
        <h2>
          This page is <em>off the rail.</em>
        </h2>
        <p>The link may be old, or the piece may have sold.</p>
        <Link href="#/products" className="button button-olive">
          Back to the marketplace
        </Link>
      </div>
    </main>
  );
}

function Routes() {
  const route = useRoute();
  const path = route.path;

  if (path === "/" || path === "") return <HomePage />;
  if (path === "/products") return <ProductsPage />;
  if (path.startsWith("/product/")) return <ProductDetailPage />;
  if (path === "/cart") return <CartPage />;
  if (path === "/checkout") return <CheckoutPage />;
  if (path === "/auctions") return <AuctionsPage />;
  if (path.startsWith("/auction/")) return <AuctionDetailPage />;
  if (path === "/login") return <AuthPage mode="login" />;
  if (path === "/register") return <AuthPage mode="register" />;
  if (path === "/sell") return <SellPage />;
  if (path === "/seller") return <SellerDashboardPage />;
  if (path === "/account") return <AccountPage />;
  if (path === "/admin") return <AdminPage />;
  if (path.startsWith("/orders/")) return <OrderDetailPage />;
  return <NotFound />;
}

function Shell() {
  const { favorites, cartCount, unreadCount, user } = useStore();
  const route = useRoute();
  const [searchOpen, setSearchOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<AuthPromptDetail | null>(null);
  const [lastPath, setLastPath] = useState(route.path);

  useEffect(() => onAuthPrompt(setAuthPrompt), []);

  useEffect(() => {
    if (route.path !== lastPath) {
      setLastPath(route.path);
      if (!route.anchor) window.scrollTo({ top: 0 });
    }
    if (route.anchor) {
      window.setTimeout(() => {
        document.getElementById(route.anchor)?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    }
  }, [route.path, route.anchor, lastPath]);

  const footerColumns = [
    {
      title: "Marketplace",
      links: [
        { label: "Shop all", href: "#/products" },
        { label: "Live auctions", href: "#/auctions" },
        { label: "Sell a piece", href: "#/sell" },
        { label: "Categories", href: "#/products" },
      ],
    },
    {
      title: "Account",
      links: [
        { label: "My orders", href: "#/account?tab=orders" },
        { label: "My offers", href: "#/account?tab=offers" },
        { label: "Saved finds", href: "#/account?tab=saved" },
        { label: user ? "My account" : "Create account", href: user ? "#/account" : "#/register" },
      ],
    },
    {
      title: "lelam.co",
      links: [
        { label: "Trivandrum, Kerala" },
        { label: "Delivery in 695xxx" },
        { label: "Private offers only" },
        { label: "Demo marketplace" },
      ],
    },
  ];

  return (
    <div className="site-shell">
      <LelamNavbar
        favoritesCount={favorites.length}
        cartCount={cartCount}
        unreadCount={unreadCount}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSaved={() => setSavedOpen(true)}
      />

      <div className="site-content">
        <Routes />
      </div>

      <HalftoneWordmarkFooter
        wordmark="lelam"
        label="lelam.co"
        meta="©2026 · Trivandrum, Kerala"
        preset="paper"
        palette={{ background: "transparent", ink: "#493022", warm: "#C98F7D" }}
        columns={footerColumns}
        height="540px"
      />

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      {savedOpen && <SavedOverlay onClose={() => setSavedOpen(false)} />}
      {authPrompt && <AuthPrompt detail={authPrompt} onClose={() => setAuthPrompt(null)} />}
      <ToastHost />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
