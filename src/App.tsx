import { useEffect, useMemo, useState } from "react";
import { Heart, LogIn, Search, ShoppingBag, UserPlus, X } from "lucide-react";
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

  return (
    <Modal title="Search lelam" onClose={onClose} wide>
      <div className="search-overlay">
        <div className="search-overlay-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Denim, a leather jacket, homeware…"
            aria-label="Search listings"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="search-suggestions">
          {["Denim", "Knitwear", "Leather", "Tops", "Accessories"].map((tag) => (
            <button
              key={tag}
              type="button"
              className="chip-button"
              onClick={() => setQuery(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="search-results">
          <span className="search-results-label">
            {search ? `${results.length} results` : "Fresh on the rail"}
          </span>
          {results.length ? (
            results.map((product) => (
              <button
                key={product.id}
                type="button"
                className="search-result"
                onClick={() => {
                  onClose();
                  navigate(`#/product/${product.id}`);
                }}
              >
                <img src={product.images[0]} alt="" />
                <span>
                  <strong>{product.title}</strong>
                  <em>
                    {product.condition} · {product.sellerName}
                  </em>
                </span>
                <strong>{formatMoney(product.askingPrice)}</strong>
              </button>
            ))
          ) : (
            <p className="panel-empty">Nothing matched. Try a shorter word.</p>
          )}
        </div>

        <button
          type="button"
          className="button button-olive search-overlay-all"
          onClick={() => {
            onClose();
            navigate(`#/products${search ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
          }}
        >
          See all listings
        </button>
      </div>
    </Modal>
  );
}

function SavedOverlay({ onClose }: { onClose: () => void }) {
  const { db, favorites, toggleFavorite } = useStore();
  const saved = db.products.filter((product) => favorites.includes(product.id));

  return (
    <Modal title="Saved finds" onClose={onClose} drawer>
      <div className="saved-overlay">
        {saved.length ? (
          saved.map((product) => (
            <div key={product.id} className="saved-row">
              <Link href={`#/product/${product.id}`} onClick={onClose} className="saved-image">
                <img src={product.images[0]} alt={product.title} />
              </Link>
              <div>
                <Link href={`#/product/${product.id}`} onClick={onClose}>
                  {product.title}
                </Link>
                <span>
                  {product.condition} · {formatMoney(product.askingPrice)}
                </span>
              </div>
              <button
                type="button"
                aria-label={`Remove ${product.title} from saved`}
                onClick={() => {
                  toggleFavorite(product.id);
                  toast("Removed from saved.");
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state drawer-empty">
            <Heart size={32} />
            <h2>Nothing saved yet.</h2>
            <p>Tap the heart on a listing to keep it here for later.</p>
            <Link href="#/products" className="button button-olive" onClick={onClose}>
              Browse the rail
            </Link>
          </div>
        )}
      </div>
    </Modal>
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
          Sign in or create a free account to buy, sell, and track delivery.
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
  const { favorites, cartCount, unreadCount, user, loading } = useStore();
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

  if (loading) {
    return (
      <div className="site-shell">
        <div className="boot-screen">
          <span className="boot-mark">lelam</span>
          <span className="boot-copy">Opening the rail…</span>
        </div>
      </div>
    );
  }

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
        { label: "Cash on delivery" },
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
