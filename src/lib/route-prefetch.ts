/**
 * Route-level code splitting with intent prefetching.
 *
 * `App` renders these loaders through `lazy()` and links warm them on hover,
 * focus, or touch. Prefetching turns a cold click into a cached module lookup,
 * which is what keeps navigation feeling instant on a phone.
 */

export const routeLoaders = {
  products: () => import("../pages/Products").then((module) => ({ default: module.ProductsPage })),
  productDetail: () => import("../pages/ProductDetail").then((module) => ({ default: module.ProductDetailPage })),
  cart: () => import("../pages/Cart").then((module) => ({ default: module.CartPage })),
  checkout: () => import("../pages/Checkout").then((module) => ({ default: module.CheckoutPage })),
  auctions: () => import("../pages/Auctions").then((module) => ({ default: module.AuctionsPage })),
  auctionDetail: () => import("../pages/AuctionDetail").then((module) => ({ default: module.AuctionDetailPage })),
  auth: () => import("../pages/Auth").then((module) => ({ default: module.AuthPage })),
  sell: () => import("../pages/Sell").then((module) => ({ default: module.SellPage })),
  sellForm: () => import("../pages/SellForm").then((module) => ({ default: module.SellFormPage })),
  sellerDashboard: () => import("../pages/SellerDashboard").then((module) => ({ default: module.SellerDashboardPage })),
  account: () => import("../pages/Account").then((module) => ({ default: module.AccountPage })),
  admin: () => import("../pages/Admin").then((module) => ({ default: module.AdminPage })),
  orderDetail: () => import("../pages/OrderDetail").then((module) => ({ default: module.OrderDetailPage })),
  policies: () => import("../pages/Policies").then((module) => ({ default: module.PoliciesPage })),
  orderConfirmation: () =>
    import("../pages/OrderConfirmation").then((module) => ({ default: module.OrderConfirmationPage })),
  paymentFailed: () => import("../pages/PaymentFailed").then((module) => ({ default: module.PaymentFailedPage })),
} as const;

export type RouteKey = keyof typeof routeLoaders;

/** Map a clean app path to the chunk that renders it. */
export function routeKeyForPath(path: string): RouteKey | null {
  const clean = path.split("#")[0].split("?")[0] || "/";
  if (clean === "/" || clean === "") return null;
  if (clean === "/products" || clean === "/shop") return "products";
  if (clean.startsWith("/product/")) return "productDetail";
  if (clean === "/cart") return "cart";
  if (clean === "/checkout") return "checkout";
  if (clean === "/auctions") return "auctions";
  if (clean.startsWith("/auction/")) return "auctionDetail";
  if (clean === "/login" || clean === "/register") return "auth";
  if (clean === "/sell") return "sell";
  if (clean === "/sell/new") return "sellForm";
  if (clean === "/seller") return "sellerDashboard";
  if (clean === "/account") return "account";
  if (clean === "/admin") return "admin";
  if (clean.startsWith("/orders/")) return "orderDetail";
  if (clean === "/terms" || clean === "/privacy" || clean === "/returns" || clean === "/auction-terms") {
    return "policies";
  }
  if (clean.startsWith("/order-confirmed/") || clean.startsWith("/order-success/")) return "orderConfirmation";
  if (clean.startsWith("/payment-failed")) return "paymentFailed";
  return null;
}

const started = new Set<RouteKey>();

function warmRouteKey(key: RouteKey): void {
  if (started.has(key)) return;
  started.add(key);
  void routeLoaders[key]().catch(() => {
    // A failed prefetch must not break navigation; the route can load on click.
    started.delete(key);
  });
}

/** Warm one route chunk. Safe to call repeatedly and from many components. */
export function prefetchRoute(path: string): void {
  const key = routeKeyForPath(path);
  if (key) warmRouteKey(key);
}

const warmedImages = new Set<string>();

/** Warm the first photo of a detail page so it paints immediately on click. */
export function prefetchImage(src: string | null | undefined): void {
  if (!src || warmedImages.has(src)) return;
  warmedImages.add(src);
  const image = new Image();
  image.decoding = "async";
  image.src = src;
}

let cartDrawerWarmed = false;

/** Cart drawer code lives in its own chunk; warm it when the cart button is aimed at. */
export function prefetchCartDrawer(): void {
  if (cartDrawerWarmed) return;
  cartDrawerWarmed = true;
  void import("../components/CartDrawer").catch(() => {
    cartDrawerWarmed = false;
  });
}

let searchModalWarmed = false;

/** Search UI is only needed after the user reaches for it. */
export function prefetchSearchModal(): void {
  if (searchModalWarmed) return;
  searchModalWarmed = true;
  void import("@/components/ui/genie-search-modal").catch(() => {
    searchModalWarmed = false;
  });
}

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

function connectionIsConstrained(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData) return true;
  return Boolean(connection?.effectiveType && /(^|-)2g$|^3g$/.test(connection.effectiveType));
}

/**
 * Run a callback once the largest contentful paint is done and the browser is
 * idle. Prefetching earlier would compete with the hero image for bandwidth.
 */
function afterLcp(callback: () => void): void {
  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(callback, { timeout: 3000 });
    } else {
      window.setTimeout(callback, 800);
    }
  };

  let settled = false;
  let fallbackTimer = 0;
  const settle = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(fallbackTimer);
    // Give the browser room to finish the hero and its fonts before adding
    // requests. Prefetching the instant LCP is reported still steals bandwidth
    // from images that land slightly later.
    window.setTimeout(schedule, 1200);
  };

  const observe = () => {
    if (typeof PerformanceObserver === "undefined") {
      window.setTimeout(settle, 1200);
      return;
    }
    try {
      const observer = new PerformanceObserver((list) => {
        if (list.getEntries().length === 0) return;
        observer.disconnect();
        settle();
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
      fallbackTimer = window.setTimeout(settle, 2500);
    } catch {
      window.setTimeout(settle, 1200);
    }
  };

  if (document.readyState === "complete") observe();
  else window.addEventListener("load", observe, { once: true });
}

/** Warm the routes most people visit next, once the first paint is settled. */
export function prefetchCommonRoutes(): void {
  if (typeof window === "undefined") return;
  if (connectionIsConstrained()) return;

  afterLcp(() => {
    prefetchRoute("/products");
    prefetchRoute("/auctions");
    prefetchRoute("/cart");
    prefetchRoute("/sell");
    warmRouteKey("productDetail");
    warmRouteKey("auctionDetail");
    prefetchCartDrawer();
    prefetchSearchModal();
  });
}
