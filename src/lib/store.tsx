import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSeedDatabase } from "./seed";
import { supabase, PRODUCT_IMAGE_BUCKET } from "./supabase";
import {
  captureRef,
  codeForUser,
  findAffiliateByCode,
  getStoredRef,
  normaliseCode,
} from "./affiliate";
import type {
  Address,
  AffiliateAccount,
  AffiliateCommission,
  Auction,
  AuctionFinancial,
  CartLine,
  Database,
  Notification,
  Offer,
  Order,
  OrderItem,
  PlatformSettings,
  Product,
  ProductStatus,
  Report,
  Review,
  SellerTier,
  User,
} from "./types";
import {
  BUYER_PLATFORM_FEE_PAISE,
  platformFeeGst,
  sellerCommission,
  sellerNetPayout,
} from "./sellerMath";
import { isValidIndianPincode } from "./delivery";

const STORAGE_KEY = "lelam-marketplace-v1";

const UI_TO_CONDITION_MAP: Record<Product["condition"], string> = {
  New: "new",
  "Like new": "like_new",
  Good: "good",
  Fair: "fair",
};


async function uploadListingImages(uid: string, images: string[]): Promise<string[]> {
  const uploaded: string[] = [];
  for (const image of images) {
    if (!image.startsWith("data:")) {
      uploaded.push(image);
      continue;
    }
    try {
      const blob = await (await fetch(image)).blob();
      const extension = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${uid}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) {
        console.warn("[Storage upload error]:", error.message);
        uploaded.push(image);
        continue;
      }
      const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
      uploaded.push(data.publicUrl);
    } catch {
      uploaded.push(image);
    }
  }
  return uploaded;
}


function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clone(db: Database): Database {
  return structuredClone(db);
}

function loadDatabase(): Database {
  const seeded = createSeedDatabase();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version === 1 || parsed.version === 2) {
        // Upgrade all non-admin users to full client tier (buyer & seller)
        for (const u of parsed.users) {
          if (u.role !== "admin") {
            u.isSeller = true;
            if (!u.sellerTier) u.sellerTier = "normal";
          }
        }
        if (parsed.sessionUserId === "u-buyer" || parsed.sessionUserId === "u-seller") {
          parsed.sessionUserId = null;
        }
        return { ...parsed, settings: { ...seeded.settings, ...parsed.settings } };
      }
    }
  } catch {
    /* fall through to a clean seed */
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    /* private mode */
  }
  return seeded;
}

function nowIso() {
  return new Date().toISOString();
}

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

export function computeAuctionSettlement(
  _askingPrice: number,
  winningBid: number,
  _commissionPct: number,
  sellerTier?: SellerTier,
): Pick<AuctionFinancial, "sellerPayout" | "platformSubsidy" | "platformCommission"> {
  const commission = sellerCommission(winningBid, sellerTier);
  return {
    sellerPayout: sellerNetPayout(winningBid, sellerTier),
    platformSubsidy: 0,
    platformCommission: commission,
  };
}

function pushNotification(
  next: Database,
  userId: string,
  type: string,
  title: string,
  body: string,
  href?: string,
) {
  if (!next.users.some((user) => user.id === userId)) return;
  next.notifications.unshift({
    id: uid("n"),
    userId,
    type,
    title,
    body,
    createdAt: nowIso(),
    href,
  });
}

function orderNumber(next: Database) {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const count = (next.orders.length + 1).toString().padStart(4, "0");
  return `LEL-${count}-${stamp}`;
}

function createOrder(
  next: Database,
  input: {
    buyerId: string;
    sellerId: string;
    items: { product: Product; quantity: number; unitPrice?: number }[];
    address: Address;
    source: Order["source"];
    offerId?: string;
    auctionId?: string;
    checkoutGroupId?: string;
    platformFee?: number;
  },
): Order {
  const subtotal = input.items.reduce(
    (total, item) => total + (item.unitPrice ?? item.product.askingPrice) * item.quantity,
    0,
  );
  const platformFee = input.platformFee ?? 0;
  const gst = platformFeeGst(platformFee);
  const deadlineHours = input.source === "auction"
    ? 5 / 60
    : 10 / 60;
  const order: Order = {
    id: uid("o"),
    number: orderNumber(next),
    checkoutGroupId: input.checkoutGroupId ?? uid("cg"),
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    items: input.items.map<OrderItem>((item) => ({
      id: uid("oi"),
      productId: item.product.id,
      title: item.product.title,
      image: item.product.images[0] || "/images/tee.jpg",
      price: item.unitPrice ?? item.product.askingPrice,
      quantity: item.quantity,
      sellerId: item.product.sellerId,
      sellerName: item.product.sellerName,
    })),
    subtotal,
    shipping: 0,
    platformFee,
    platformFeeGst: gst,
    total: subtotal + platformFee + gst,
    status: "pending_payment",
    paymentStatus: "pending",
    source: input.source,
    offerId: input.offerId,
    auctionId: input.auctionId,
    address: input.address,
    createdAt: nowIso(),
    paymentDeadline: futureIso(deadlineHours),
  };
  next.orders.unshift(order);
  return order;
}

function ensureAffiliateAccounts(next: Database): boolean {
  const accounts = next.affiliates ?? [];
  let changed = false;

  for (const user of next.users) {
    if (accounts.some((account) => account.userId === user.id)) continue;
    let code = codeForUser(user.id);
    while (accounts.some((account) => account.code === code)) {
      code = `${code.slice(0, 16)}${Math.floor(Math.random() * 90 + 10)}`;
    }
    accounts.push({
      id: `aff-${user.id}`,
      userId: user.id,
      name: user.name,
      code,
      kind: "creator",
      email: user.email,
      commissionRate: (next.settings.affiliateCommissionPct || 5) / 100,
      status: "active",
      createdAt: user.joinedAt,
    });
    changed = true;
  }

  if (changed) next.affiliates = accounts;
  return changed;
}

function affiliateAccount(next: Database, id: string | undefined) {
  if (!id) return null;
  return (next.affiliates ?? []).find((account) => account.id === id) ?? null;
}

function creditAffiliate(next: Database, order: Order): void {
  const buyer = next.users.find((item) => item.id === order.buyerId);
  const account = affiliateAccount(next, buyer?.referredBy);
  if (!account || account.status !== "active") return;

  const existing = next.affiliateCommissions ?? [];
  if (existing.some((entry) => entry.orderId === order.id)) return;

  const amount = Math.floor(order.subtotal * account.commissionRate);
  if (amount <= 0) return;

  const commission: AffiliateCommission = {
    id: uid("ac"),
    affiliateId: account.id,
    orderId: order.id,
    buyerId: order.buyerId,
    subtotal: order.subtotal,
    rate: account.commissionRate,
    amount,
    status: "pending",
    returnWindowDays: next.settings.returnWindowDays,
    createdAt: nowIso(),
  };
  next.affiliateCommissions = [...existing, commission];
}

function voidAffiliateForOrder(next: Database, orderId: string): boolean {
  let changed = false;
  for (const entry of next.affiliateCommissions ?? []) {
    if (entry.orderId === orderId && (entry.status === "pending" || entry.status === "approved")) {
      entry.status = "void";
      changed = true;
    }
  }
  return changed;
}

function releaseDueCommissions(next: Database, now: number): boolean {
  let changed = false;
  for (const entry of next.affiliateCommissions ?? []) {
    if (entry.status !== "pending" || !entry.eligibleAt) continue;
    if (new Date(entry.eligibleAt).getTime() > now) continue;

    const order = next.orders.find((item) => item.id === entry.orderId);
    if (!order) continue;
    if (["returned", "cancelled"].includes(order.status) || order.paymentStatus === "refunded") {
      entry.status = "void";
      changed = true;
      continue;
    }

    const openDispute = (next.disputes ?? []).some(
      (dispute) =>
        dispute.orderId === order.id &&
        ["opened", "seller_response", "under_review"].includes(dispute.status),
    );
    if (openDispute) continue;

    entry.status = "approved";
    entry.approvedAt = nowIso();
    changed = true;
  }
  return changed;
}

function markProductsReserved(next: Database, productIds: string[]) {
  next.products = next.products.map((product) =>
    productIds.includes(product.id) ? { ...product, status: "reserved" } : product,
  );
}

function releaseProductIfReserved(next: Database, productId: string) {
  next.products = next.products.map((product) =>
    product.id === productId && product.status === "reserved"
      ? { ...product, status: "active" }
      : product,
  );
}

function settleDueAuctions(next: Database, now: number): boolean {
  let changed = false;
  for (const auction of next.auctions) {
    const product = next.products.find((item) => item.id === auction.productId);
    if (!product) continue;

    if (auction.status === "scheduled" && new Date(auction.startsAt).getTime() <= now) {
      auction.status = "live";
      changed = true;
      pushNotification(
        next,
        auction.sellerId,
        "auction_live",
        "Your auction is live",
        `${product.title} just went live. Bidding is now open.`,
        `#/auction/${auction.id}`,
      );
      for (const [userId, favorites] of Object.entries(next.favorites)) {
        if (favorites.includes(product.id) && userId !== auction.sellerId) {
          pushNotification(
            next,
            userId,
            "auction_started",
            "An auction you saved is live",
            `${product.title} is now open for bidding.`,
            `#/auction/${auction.id}`,
          );
        }
      }
    }

    if (auction.status === "live" && new Date(auction.endsAt).getTime() <= now) {
      changed = true;
      const winnerBid = [...auction.bids].sort((a, b) => b.amount - a.amount)[0];
      if (!winnerBid) {
        auction.status = "completed";
        auction.financial = {
          askingPrice: auction.askingPrice,
          startingPrice: auction.startingPrice,
          winningBid: 0,
          sellerPayout: 0,
          platformSubsidy: 0,
          platformCommission: 0,
          outcome: "no_bids",
        };
        pushNotification(
          next,
          auction.sellerId,
          "auction_ended",
          "Auction ended without bids",
          `${product.title} is back in your listings. You can relist it any time.`,
          "#/seller?tab=auctions",
        );
        next.auditLogs.unshift({
          id: uid("al"),
          actorId: auction.sellerId,
          action: "auction.complete",
          entityType: "auction",
          entityId: auction.id,
          detail: "No bids received.",
          createdAt: nowIso(),
        });
        continue;
      }

      auction.currentBid = winnerBid.amount;
      auction.highestBidderId = winnerBid.bidderId;
      auction.winnerId = winnerBid.bidderId;
      auction.status = "completed";
      const auctionSeller = next.users.find((u) => u.id === auction.sellerId);
      const settlement = computeAuctionSettlement(
        auction.askingPrice,
        winnerBid.amount,
        next.settings.platformCommissionPct,
        auctionSeller?.sellerTier,
      );
      auction.financial = {
        askingPrice: auction.askingPrice,
        startingPrice: auction.startingPrice,
        winningBid: winnerBid.amount,
        ...settlement,
        outcome: "sold",
      };
      const buyer = next.users.find((user) => user.id === winnerBid.bidderId);
      if (buyer) {
        const address = buyer.addresses.find((item) => item.isDefault) ?? buyer.addresses[0] ?? {
          id: "addr-needed",
          label: "Add delivery address",
          name: buyer.name,
          phone: buyer.phone ?? "",
          line1: "",
          city: "",
          state: "",
          pincode: "",
        };
        if (address) {
          const order = createOrder(next, {
            buyerId: buyer.id,
            sellerId: auction.sellerId,
            items: [{ product, quantity: 1, unitPrice: winnerBid.amount }],
            address,
            source: "auction",
            auctionId: auction.id,
            platformFee: BUYER_PLATFORM_FEE_PAISE,
          });
          auction.orderId = order.id;
          markProductsReserved(next, [product.id]);
          pushNotification(
            next,
            buyer.id,
            "auction_won",
            "You won the auction",
            `You won ${product.title} for ${(winnerBid.amount / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}. Complete payment within ${next.settings.auctionPaymentDeadlineHours} hours.`,
            `#/orders/${order.id}`,
          );
        }
        pushNotification(
          next,
          auction.sellerId,
          "auction_sold",
          "Your auction has a winner",
          `${product.title} ended at a winning bid. Check your payout in the seller dashboard.`,
          "#/seller?tab=auctions",
        );
      }
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: winnerBid.bidderId,
        action: "auction.win",
        entityType: "auction",
        entityId: auction.id,
        detail: `Winning bid recorded for ${product.title}.`,
        createdAt: nowIso(),
      });
    }
  }
  return changed;
}

function settleDueOrders(next: Database, now: number): boolean {
  let changed = false;
  for (const order of next.orders) {
    if (
      order.status === "pending_payment" &&
      order.paymentDeadline &&
      new Date(order.paymentDeadline).getTime() <= now
    ) {
      order.status = "expired";
      order.paymentStatus = "expired";
      changed = true;
      for (const item of order.items) releaseProductIfReserved(next, item.productId);
      if (order.auctionId) {
        const auction = next.auctions.find((item) => item.id === order.auctionId);
        if (auction?.financial) {
          auction.financial.outcome = "unpaid";
        }
      }
      pushNotification(
        next,
        order.buyerId,
        "payment_expired",
        "Payment window expired",
        `Order ${order.number} was released. The item is available again.`,
        `#/orders/${order.id}`,
      );
      pushNotification(
        next,
        order.sellerId,
        "order_expired",
        "An order expired",
        `Order ${order.number} was not paid and the item is available again.`,
        "#/seller?tab=orders",
      );
    }
  }
  return changed;
}

function settleDueOffers(next: Database, now: number): boolean {
  let changed = false;
  for (const offer of next.offers) {
    if (offer.status === "pending" && new Date(offer.expiresAt).getTime() <= now) {
      offer.status = "expired";
      changed = true;
      pushNotification(
        next,
        offer.buyerId,
        "offer_expired",
        "Offer expired",
        "The seller did not respond in time. The listing is still available.",
        "#/account?tab=offers",
      );
    }
    if (
      offer.status === "accepted" &&
      offer.checkoutExpiresAt &&
      new Date(offer.checkoutExpiresAt).getTime() <= now
    ) {
      offer.status = "expired";
      changed = true;
      releaseProductIfReserved(next, offer.productId);
      pushNotification(
        next,
        offer.buyerId,
        "offer_checkout_expired",
        "Offer checkout expired",
        "The agreed price is no longer reserved. You can make a new offer.",
        "#/account?tab=offers",
      );
      pushNotification(
        next,
        offer.sellerId,
        "offer_expired",
        "Accepted offer expired",
        "The buyer did not complete payment. The listing is active again.",
        "#/seller?tab=offers",
      );
    }
  }
  return changed;
}

function advance(next: Database, now: number): boolean {
  let changed = false;
  if (settleDueAuctions(next, now)) changed = true;
  if (settleDueOrders(next, now)) changed = true;
  if (settleDueOffers(next, now)) changed = true;
  return changed;
}

export type ListingInput = {
  title: string;
  description: string;
  brand?: string;
  condition: Product["condition"];
  category: Product["category"];
  subcategory?: string;
  askingPrice: number;
  images: string[];
  size?: string;
  quantity: number;
  location: string;
  shippingFee: number;
  allowOffers: boolean;
  auctionConsent: boolean;
};

type ActionResult = { ok: true } | { ok: false; error: string };

type PlaceBidResult = { ok: true; amount: number; extended: boolean } | { ok: false; error: string };

interface StoreValue {
  db: Database;
  user: User | null;
  cart: { line: CartLine; product: Product }[];
  cartCount: number;
  cartSubtotal: number;
  favorites: string[];
  notifications: Notification[];
  unreadCount: number;
  refreshRemoteCommerce: () => Promise<void>;
  login: (email: string, password: string) => Promise<ActionResult>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    asSeller?: boolean;
  }) => Promise<ActionResult>;
  signInWithGoogle: (idToken?: string) => Promise<ActionResult>;
  logout: () => void;
  switchAccount: (userId: string) => void;
  resetDemo: () => void;
  addToCart: (productId: string, quantity?: number) => ActionResult;
  removeFromCart: (productId: string) => void;
  setCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  makeOffer: (productId: string, amount: number) => ActionResult;
  respondToOffer: (offerId: string, accept: boolean) => ActionResult;
  counterOffer: (offerId: string, counterAmount: number, message?: string) => ActionResult;
  cancelOffer: (offerId: string) => ActionResult;
  createOrders: (input: {
    addressId: string;
    productId?: string;
    offerId?: string;
    quantity?: number;
  }) => { ok: true; orderIds: string[] } | { ok: false; error: string };
  payOrders: (orderIds: string[]) => ActionResult;
  cancelOrder: (orderId: string) => ActionResult;
  requestReturn: (orderId: string) => ActionResult;
  addReview: (orderId: string, rating: number, comment: string) => ActionResult;
  advanceShipment: (
    orderId: string,
    status: NonNullable<Order["shipment"]>["status"],
    detail?: { provider?: string; awb?: string; trackingUrl?: string; note?: string },
  ) => ActionResult;
  createListing: (input: ListingInput) => { ok: true; productId: string } | { ok: false; error: string };
  updateListing: (productId: string, patch: Partial<ListingInput> & { status?: ProductStatus }) => ActionResult;
  removeListing: (productId: string) => ActionResult;
  toggleListingAvailability: (productId: string) => ActionResult;
  reportProduct: (productId: string, reason: string, details?: string) => ActionResult;
  placeBid: (auctionId: string, amount: number) => Promise<PlaceBidResult>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  saveAddress: (address: Omit<Address, "id"> & { id?: string }) => ActionResult;
  removeAddress: (addressId: string) => void;
  updateOrderAddress: (orderId: string, address: Address) => ActionResult;
  updateProfile: (patch: { name?: string; phone?: string; bio?: string; location?: string; auctionConsent?: boolean }) => ActionResult;
  approveProduct: (productId: string) => void;
  rejectProduct: (productId: string, reason: string) => void;
  setUserBlocked: (userId: string, blocked: boolean) => void;
  updateSellerTier: (userId: string, tier: SellerTier) => ActionResult;
  updateSettings: (patch: Partial<PlatformSettings>) => void;
  generateAuctions: () => ActionResult;
  scheduleAuction: (productId: string, startsAt: string, durationMinutes?: number) => ActionResult;
  startAuctionNow: (auctionId: string) => void;
  endAuctionNow: (auctionId: string) => void;
  cancelAuction: (auctionId: string, reason: string) => void;
  markSettlementPaid: (settlementId: string) => Promise<ActionResult>;
  resolveReport: (reportId: string, status: Report["status"]) => void;
  createAffiliate: (input: {
    name: string;
    email?: string;
    code?: string;
    kind: AffiliateAccount["kind"];
    commissionPct: number;
  }) => Promise<{ ok: true; affiliateId: string } | { ok: false; error: string }>;
  updateAffiliate: (
    affiliateId: string,
    patch: {
      name?: string;
      email?: string;
      code?: string;
      kind?: AffiliateAccount["kind"];
      commissionPct?: number;
      status?: AffiliateAccount["status"];
    },
  ) => Promise<ActionResult>;
  reviewAffiliateCommission: (
    commissionId: string,
    action: "approve" | "pay" | "void",
  ) => Promise<ActionResult>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(loadDatabase);
  const dbRef = useRef(db);
  const affiliateCaptureRef = useRef(false);

  const commit = useCallback((next: Database) => {
    dbRef.current = next;
    setDb(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage can be full when photos are attached */
    }
  }, []);

  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // Personal affiliate accounts, incoming ?ref= clicks, and return-window
  // releases all happen on boot; the interval keeps releases ticking.
  useEffect(() => {
    if (affiliateCaptureRef.current) return;
    affiliateCaptureRef.current = true;

    const next = clone(dbRef.current);
    let changed = ensureAffiliateAccounts(next);

    const captured = captureRef();
    if (captured?.firstSeen) {
      void supabase.rpc("affiliate_track_click", {
        p_code: captured.code,
        p_path: window.location.hash || "/",
        p_referrer: document.referrer || null,
        p_user_agent: navigator.userAgent,
        p_ip_hash: null,
      }).then(({ error }) => {
        if (error) console.warn("[Supabase affiliate click]:", error.message);
      });
      const account = findAffiliateByCode(captured.code, next.affiliates);
      if (account) {
        next.affiliateClicks = [
          {
            id: uid("ac"),
            code: account.code,
            affiliateId: account.id,
            path: window.location.hash || "/",
            createdAt: nowIso(),
          },
          ...(next.affiliateClicks ?? []),
        ].slice(0, 500);
        changed = true;
      }
    }

    if (releaseDueCommissions(next, Date.now())) changed = true;
    if (changed) commit(next);
  }, [commit]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = clone(dbRef.current);
      if (releaseDueCommissions(next, Date.now())) commit(next);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [commit]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Database;
        if (parsed.version === 1 || parsed.version === 2) {
          dbRef.current = parsed;
          setDb(parsed);
        }
      } catch {
        /* ignore malformed cross-tab state */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Live Supabase Sync: Fetch real products and listen to Realtime changes
  useEffect(() => {
    let active = true;

    async function syncFromSupabase() {
      try {
        const { data: rows, error } = await supabase
          .from("public_products")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("[Supabase Sync] Products query returned:", error.message);
          return;
        }

        if (active && Array.isArray(rows) && rows.length > 0) {
          const CONDITION_TO_UI: Record<string, Product["condition"]> = {
            new: "New",
            like_new: "Like new",
            good: "Good",
            fair: "Fair",
          };

          const liveProducts: Product[] = rows.map((r: any) => ({
            id: r.id,
            sellerId: r.seller_id,
            sellerName: r.seller_name || "Seller",
            title: r.title,
            description: r.description || "",
            brand: r.brand || undefined,
            condition: CONDITION_TO_UI[r.condition] || "Good",
            category: r.category || "Other",
            subcategory: r.subcategory || undefined,
            askingPrice: r.asking_price ?? r.asking_price_paise ?? 0,
            images: Array.isArray(r.images) && r.images.length > 0 ? r.images : ["/images/denim.jpg"],
            size: r.size || undefined,
            quantity: r.quantity ?? 1,
            isUnique: Boolean(r.is_unique),
            location: r.location || "Trivandrum, Kerala",
            shippingFee: r.shipping_fee ?? r.shipping_fee_paise ?? 4900,
            status: r.status || "active",
            allowOffers: Boolean(r.allow_offers),
            auctionConsent: Boolean(r.auction_consent),
            createdAt: r.created_at || new Date().toISOString(),
            views: r.views || 0,
            tag: r.tag || undefined,
            color: r.color || "#e8e6df",
            measurements: r.measurements || {},
            flaws: r.flaws || [],
            hasFlaws: Boolean(r.has_flaws),
            gender: r.gender || undefined,
            fit: r.fit || undefined,
            countryOfOrigin: r.country_of_origin || undefined,
            weightGrams: r.weight_grams || undefined,
          }));

          const next = clone(dbRef.current);
          // Once the server catalog is available, hide local demo listings that cannot be ordered.
          next.products = liveProducts;
          const [{ data: auctionRows, error: auctionError }, { data: profiles }] = await Promise.all([
            supabase.from("auctions").select("*").order("starts_at", { ascending: true }),
            supabase.from("profiles").select("id,email"),
          ]);
          if (!auctionError && auctionRows) {
            const [{ data: publicBids }, { data: ownBids }] = await Promise.all([
              supabase.from("public_bids").select("*").order("created_at", { ascending: false }),
              supabase.from("bids").select("id,auction_id,bidder_id,amount_paise,created_at"),
            ]);
            const auth = await supabase.auth.getUser();
            const localUser = next.users.find(
              (item) => item.email.toLowerCase() === auth.data.user?.email?.toLowerCase(),
            );
            next.auctions = auctionRows.map((row: any) => {
              const profile = profiles?.find((item: any) => item.id === row.seller_id);
              const seller = next.users.find((item) => item.email.toLowerCase() === profile?.email?.toLowerCase());
              const bids = (publicBids ?? [])
                .filter((bid: any) => bid.auction_id === row.id)
                .map((bid: any) => {
                  const own = ownBids?.find((candidate: any) => candidate.id === bid.id);
                  return {
                    id: bid.id,
                    auctionId: row.id,
                    bidderId: own?.bidder_id === auth.data.user?.id ? localUser?.id ?? own?.bidder_id ?? "" : "",
                    amount: bid.amount_paise,
                    alias: bid.alias,
                    createdAt: bid.created_at,
                  };
                });
              return {
                id: row.id,
                productId: row.product_id,
                sellerId: seller?.id ?? row.seller_id,
                status: row.status,
                startingPrice: row.starting_price_paise,
                askingPrice: row.asking_price_paise,
                currentBid: row.current_bid_paise ?? undefined,
                highestBidderId: row.highest_bidder_id === auth.data.user?.id
                  ? localUser?.id ?? row.highest_bidder_id
                  : row.highest_bidder_id ?? undefined,
                bidCount: row.bid_count,
                minIncrement: row.min_increment_paise,
                antiSnipeSeconds: row.anti_snipe_seconds,
                startsAt: row.starts_at,
                endsAt: row.ends_at,
                originalEndsAt: row.original_ends_at,
                bids,
                createdAt: row.created_at,
                cancelledReason: row.cancelled_reason ?? undefined,
                winnerId: row.status === "completed" ? row.highest_bidder_id ?? undefined : undefined,
              };
            });
          }
          commit(next);
        }
      } catch (err) {
        console.warn("[Supabase Sync] Failed to connect:", err);
      }
    }

    syncFromSupabase();

    const channel = supabase
      .channel("public-products-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        syncFromSupabase();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [commit]);

  const syncRemoteCommerce = useCallback(async (authUser: any) => {
    try {
      const [{ data: orderRows }, { data: settlementRows }, { data: profiles }] = await Promise.all([
        supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }),
        supabase.from("seller_settlements").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,email,full_name"),
      ]);
      const next = clone(dbRef.current);
      const localUser = next.users.find((item) => item.email.toLowerCase() === authUser.email?.toLowerCase());
      const localId = (id: string) => {
        if (id === authUser.id && localUser) return localUser.id;
        const profile = profiles?.find((item: any) => item.id === id);
        return next.users.find((item) => item.email.toLowerCase() === profile?.email?.toLowerCase())?.id ?? id;
      };
      if (orderRows) {
        const remoteOrders = orderRows.map((row: any) => {
          const address = row.shipping_address ?? {};
          const sellerId = localId(row.seller_id);
          return {
            id: row.id,
            number: row.order_number,
            checkoutGroupId: row.checkout_group_id,
            buyerId: localId(row.buyer_id),
            sellerId,
            items: (row.order_items ?? []).map((item: any) => ({
              id: item.id,
              productId: item.product_id ?? "",
              title: item.title_snapshot,
              image: item.image_snapshot || "/images/tee.jpg",
              price: item.price_paise,
              quantity: item.quantity,
              sellerId,
              sellerName: next.products.find((product) => product.sellerId === sellerId)?.sellerName ?? "Seller",
            })),
            subtotal: row.subtotal_paise,
            shipping: row.shipping_paise,
            platformFee: row.buyer_platform_fee_paise ?? 0,
            total: row.total_paise,
            status: row.status,
            paymentStatus: row.payment_status,
            paymentMethod: row.payment_method ?? undefined,
            source: row.source,
            offerId: row.offer_id ?? undefined,
            auctionId: row.auction_id ?? undefined,
            address: {
              id: address.id ?? "server-address",
              label: address.label ?? "Delivery",
              name: address.name ?? address.recipient_name ?? "",
              phone: address.phone ?? "",
              line1: address.line1 ?? "",
              line2: address.line2 ?? undefined,
              city: address.city ?? "",
              state: address.state ?? "",
              pincode: address.pincode ?? "",
            },
            createdAt: row.created_at,
            paidAt: row.paid_at ?? undefined,
            paymentDeadline: row.payment_deadline ?? undefined,
            cancelledAt: row.cancelled_at ?? undefined,
          };
        });
        const remoteIds = new Set(remoteOrders.map((order: any) => order.id));
        next.orders = [...remoteOrders, ...next.orders.filter((order) => !remoteIds.has(order.id) && order.id.startsWith("o-"))];
      }
      if (settlementRows) {
        const remoteSettlements = settlementRows.map((row: any) => ({
          id: row.id,
          sellerId: localId(row.seller_id),
          orderId: row.order_id ?? undefined,
          auctionId: row.auction_id ?? undefined,
          source: row.source,
          askingPrice: row.asking_price_paise,
          winningBid: row.winning_bid_paise ?? undefined,
          sellerPayout: row.seller_payout_paise,
          platformSubsidy: row.platform_subsidy_paise ?? 0,
          platformCommission: row.platform_commission_paise,
          paymentFee: row.payment_fee_paise ?? 0,
          status: row.status,
          createdAt: row.created_at,
          paidAt: row.paid_at ?? undefined,
        }));
        const remoteIds = new Set(remoteSettlements.map((item: any) => item.id));
        next.settlements = [...remoteSettlements, ...next.settlements.filter((item) => !remoteIds.has(item.id) && item.id.startsWith("s-"))];
      }

      const { data: dashboard } = await supabase.rpc("affiliate_dashboard");
      if (dashboard?.account) {
        const raw = dashboard.account;
        const account: AffiliateAccount = {
          id: raw.id,
          userId: localUser?.id,
          name: raw.display_name || localUser?.name || "Affiliate",
          code: raw.code,
          kind: raw.kind,
          email: raw.contact_email ?? undefined,
          commissionRate: Number(raw.commission_pct) / 100,
          status: raw.status,
          createdAt: raw.created_at,
          totalClicks: Number(raw.total_clicks ?? dashboard.clicks30d ?? 0),
          totalSignups: Number(raw.total_signups ?? 0),
          totalOrders: Number(raw.total_orders ?? 0),
        };
        next.affiliates = [account, ...(next.affiliates ?? []).filter((item) => item.id !== account.id)];
        const commissions = (dashboard.recent ?? []).map((item: any) => ({
          id: item.id,
          affiliateId: raw.id,
          orderId: item.order_id,
          buyerId: localUser?.id ?? authUser.id,
          subtotal: item.order_subtotal_paise,
          rate: Number(item.commission_pct) / 100,
          amount: item.amount_paise,
          status: item.status,
          returnWindowDays: item.return_window_days,
          eligibleAt: item.eligible_at ?? undefined,
          createdAt: item.created_at,
          approvedAt: item.approved_at ?? undefined,
          paidAt: item.paid_at ?? undefined,
        }));
        const remoteIds = new Set(commissions.map((item: any) => item.id));
        next.affiliateCommissions = [...commissions, ...(next.affiliateCommissions ?? []).filter((item) => !remoteIds.has(item.id) && item.id.startsWith("ac-"))];
      }

      if (localUser?.role === "admin") {
        const { data: adminData } = await supabase.rpc("admin_list_affiliates");
        if (adminData) {
          next.affiliates = (adminData.accounts ?? []).map((raw: any) => ({
            id: raw.id,
            userId: raw.user_id ? localId(raw.user_id) : undefined,
            name: raw.display_name ?? "Affiliate",
            code: raw.code,
            kind: raw.kind,
            email: raw.contact_email ?? undefined,
            commissionRate: Number(raw.commission_pct) / 100,
            status: raw.status,
            createdAt: raw.created_at,
            totalClicks: Number(raw.clicks ?? 0),
            totalSignups: Number(raw.signups ?? 0),
            totalOrders: Number(raw.orders ?? 0),
          }));
          next.affiliateCommissions = (adminData.commissions ?? []).map((raw: any) => ({
            id: raw.id,
            affiliateId: raw.affiliate_id,
            orderId: raw.order_id,
            buyerId: localId(raw.referred_user_id),
            subtotal: raw.order_subtotal_paise,
            rate: Number(raw.commission_pct) / 100,
            amount: raw.amount_paise,
            status: raw.status,
            returnWindowDays: raw.return_window_days,
            eligibleAt: raw.eligible_at ?? undefined,
            createdAt: raw.created_at,
            approvedAt: raw.approved_at ?? undefined,
            paidAt: raw.paid_at ?? undefined,
          }));
        }
      }
      commit(next);
    } catch (error) {
      console.warn("[Supabase commerce sync]:", error);
    }
  }, [commit]);

  const refreshRemoteCommerce = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) await syncRemoteCommerce(authUser);
  }, [syncRemoteCommerce]);

  // Sync Supabase Auth session into local user store (for Google OAuth redirects / GSI)
  useEffect(() => {
    const handleAuthUser = (sessionUser: any) => {
      if (!sessionUser) return;
      const current = dbRef.current;
      const email = sessionUser.email?.toLowerCase();
      if (!email) return;
      const next = clone(current);
      let existing = next.users.find((u) => u.email.toLowerCase() === email);
      if (!existing) {
        const name =
          sessionUser.user_metadata?.full_name ||
          sessionUser.user_metadata?.name ||
          email.split("@")[0] ||
          "Google User";
        existing = {
          id: sessionUser.id || uid("u"),
          name,
          email,
          password: "",
          role: "client",
          isSeller: true,
          addresses: [],
          joinedAt: nowIso(),
          auctionConsent: true,
          location: "Trivandrum, Kerala",
        };
        next.users.push(existing);
      }
      if (next.sessionUserId !== existing.id) {
        next.sessionUserId = existing.id;
        commit(next);
      }
      const referralCode = getStoredRef();
      if (referralCode) {
        void supabase.rpc("affiliate_attribute_signup", { p_code: referralCode }).then(({ error }) => {
          if (error) console.warn("[Supabase affiliate attribution]:", error.message);
        });
      }
      void syncRemoteCommerce(sessionUser);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleAuthUser(session.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) handleAuthUser(session.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [commit, syncRemoteCommerce]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = dbRef.current;
      const next = clone(current);
      if (advance(next, Date.now())) commit(next);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [commit]);

  const user = useMemo(
    () => db.users.find((candidate) => candidate.id === db.sessionUserId) ?? null,
    [db.users, db.sessionUserId],
  );

  const cartKey = user?.id ?? "guest";

  const cart = useMemo(() => {
    const lines = db.carts[cartKey] ?? [];
    return lines
      .map((line) => {
        const product = db.products.find((item) => item.id === line.productId);
        return product ? { line, product } : null;
      })
      .filter((entry): entry is { line: CartLine; product: Product } => Boolean(entry));
  }, [db.carts, db.products, cartKey]);

  const cartCount = cart.reduce((total, entry) => total + entry.line.quantity, 0);
  const cartSubtotal = cart.reduce(
    (total, entry) => total + entry.product.askingPrice * entry.line.quantity,
    0,
  );
  const favorites = db.favorites[cartKey] ?? [];
  const notifications = db.notifications.filter((item) => item.userId === user?.id);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const login = useCallback(
    async (email: string, password: string): Promise<ActionResult> => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [commit],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string; asSeller?: boolean }): Promise<ActionResult> => {
      if (input.password.length < 8) return { ok: false, error: "Use at least 8 characters for your password." };
      const { data, error } = await supabase.auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        options: { data: { full_name: input.name.trim() } },
      });
      if (error) return { ok: false, error: error.message };
      if (!data.session) return { ok: false, error: "Check your email to confirm your account, then sign in." };
      return { ok: true };
    },
    [],
  );

  const signInWithGoogle = useCallback(
    async (idToken?: string): Promise<ActionResult> => {
      try {
        if (idToken) {
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: idToken,
          });
          if (error) throw error;
          if (data.user) {
            const current = dbRef.current;
            const email = data.user.email?.toLowerCase() || "";
            const next = clone(current);
            let existing = next.users.find((u) => u.email.toLowerCase() === email);
            if (!existing) {
              const name =
                data.user.user_metadata?.full_name ||
                data.user.user_metadata?.name ||
                email.split("@")[0] ||
                "Google User";
              existing = {
                id: data.user.id || uid("u"),
                name,
                email,
                password: "",
                role: "client",
                isSeller: true,
                addresses: [],
                joinedAt: nowIso(),
                auctionConsent: true,
                location: "Trivandrum, Kerala",
              };
              next.users.push(existing);
            }
            next.sessionUserId = existing.id;
            commit(next);
            return { ok: true };
          }
        } else {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}${window.location.pathname}#/account`,
            },
          });
          if (error) throw error;
          return { ok: true };
        }
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || "Google sign in failed" };
      }
    },
    [commit],
  );

  const logout = useCallback(() => {
    const next = clone(dbRef.current);
    next.sessionUserId = null;
    commit(next);
    supabase.auth.signOut().catch((err) => {
      console.warn("[Supabase Auth signOut]:", err.message);
    });
  }, [commit]);

  const switchAccount = useCallback(
    (userId: string) => {
      const next = clone(dbRef.current);
      next.sessionUserId = userId;
      commit(next);
    },
    [commit],
  );

  const resetDemo = useCallback(() => {
    const seeded = createSeedDatabase();
    commit(seeded);
  }, [commit]);

  const addToCart = useCallback(
    (productId: string, quantity = 1): ActionResult => {
      const current = dbRef.current;
      const product = current.products.find((item) => item.id === productId);
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!product) return { ok: false, error: "Listing not found." };
      if (product.status !== "active") return { ok: false, error: "This item is not available right now." };
      if (activeUser && product.sellerId === activeUser.id) {
        return { ok: false, error: "This is your own listing." };
      }
      const key = activeUser?.id ?? "guest";
      const next = clone(current);
      const lines = next.carts[key] ?? [];
      const existing = lines.find((line) => line.productId === productId);
      if (existing) {
        if (product.isUnique) return { ok: true };
        existing.quantity = Math.min(product.quantity, existing.quantity + quantity);
      } else {
        lines.push({ productId, quantity: product.isUnique ? 1 : Math.min(quantity, product.quantity) });
      }
      next.carts[key] = lines;
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const removeFromCart = useCallback(
    (productId: string) => {
      const current = dbRef.current;
      const key = current.sessionUserId ?? "guest";
      const next = clone(current);
      next.carts[key] = (next.carts[key] ?? []).filter((line) => line.productId !== productId);
      commit(next);
    },
    [commit],
  );

  const setCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      const current = dbRef.current;
      const key = current.sessionUserId ?? "guest";
      const product = current.products.find((item) => item.id === productId);
      if (!product) return;
      const next = clone(current);
      const lines = next.carts[key] ?? [];
      const line = lines.find((item) => item.productId === productId);
      if (!line) return;
      if (quantity <= 0) {
        next.carts[key] = lines.filter((item) => item.productId !== productId);
      } else {
        line.quantity = Math.min(quantity, product.quantity);
      }
      commit(next);
    },
    [commit],
  );

  const clearCart = useCallback(() => {
    const next = clone(dbRef.current);
    next.carts[next.sessionUserId ?? "guest"] = [];
    commit(next);
  }, [commit]);

  const toggleFavorite = useCallback(
    (productId: string) => {
      const current = dbRef.current;
      const key = current.sessionUserId ?? "guest";
      const next = clone(current);
      const list = next.favorites[key] ?? [];
      next.favorites[key] = list.includes(productId)
        ? list.filter((id) => id !== productId)
        : [...list, productId];
      commit(next);
    },
    [commit],
  );

  const makeOffer = useCallback(
    (productId: string, amount: number): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!activeUser) return { ok: false, error: "Sign in to make an offer." };
      const product = current.products.find((item) => item.id === productId);
      if (!product) return { ok: false, error: "Listing not found." };
      if (product.sellerId === activeUser.id) return { ok: false, error: "This is your own listing." };
      if (product.status !== "active") return { ok: false, error: "This listing is not open for offers." };
      if (!product.allowOffers) return { ok: false, error: "The seller is not accepting offers on this item." };
      if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Enter a valid offer amount." };
      if (amount >= product.askingPrice) return { ok: false, error: "That is at or above the asking price. Use Buy now instead." };
      if (
        current.offers.some(
          (offer) =>
            offer.productId === productId &&
            offer.buyerId === activeUser.id &&
            offer.status === "pending",
        )
      ) {
        return { ok: false, error: "You already have a pending offer on this item." };
      }
      const next = clone(current);
      const offer: Offer = {
        id: uid("off"),
        productId,
        buyerId: activeUser.id,
        sellerId: product.sellerId,
        amount,
        message: undefined,
        status: "pending",
        createdAt: nowIso(),
        expiresAt: futureIso(next.settings.offerValidityHours),
      };
      next.offers.unshift(offer);
      pushNotification(
        next,
        product.sellerId,
        "offer_received",
        `New offer on ${product.title}`,
        `${activeUser.name} offered a private price. Review it in your seller dashboard.`,
        "#/seller?tab=offers",
      );
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const respondToOffer = useCallback(
    (offerId: string, accept: boolean): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      const offer = current.offers.find((item) => item.id === offerId);
      if (!activeUser || !offer) return { ok: false, error: "Offer not found." };
      if (!["pending", "counter_offered"].includes(offer.status)) {
        return { ok: false, error: "This offer is no longer open for responses." };
      }

      const isSeller = offer.sellerId === activeUser.id;
      const isBuyer = offer.buyerId === activeUser.id;
      if (offer.status === "counter_offered" && offer.lastCounterBy === "seller") {
        if (!isBuyer && activeUser.role !== "admin") {
          return { ok: false, error: "Only the buyer can respond to this counter-offer." };
        }
      } else {
        if (!isSeller && activeUser.role !== "admin") {
          return { ok: false, error: "Only the seller can respond to this offer." };
        }
      }

      const product = current.products.find((item) => item.id === offer.productId);
      if (!product) return { ok: false, error: "Listing not found." };
      const next = clone(current);
      const target = next.offers.find((item) => item.id === offerId)!;
      target.respondedAt = nowIso();

      if (accept) {
        target.status = "accepted";
        if (target.counterAmount) {
          target.amount = target.counterAmount;
        }
        target.checkoutExpiresAt = futureIso(next.settings.offerCheckoutHours);
        void Promise.resolve(supabase.rpc("respond_to_offer", { p_offer_id: offerId, p_accept: true })).catch((err: any) => console.warn("[Supabase respond_to_offer accept]:", err?.message));
        for (const other of next.offers) {
          if (
            other.id !== target.id &&
            other.productId === target.productId &&
            ["pending", "counter_offered"].includes(other.status)
          ) {
            other.status = "rejected";
            other.respondedAt = nowIso();
            pushNotification(
              next,
              other.buyerId,
              "offer_rejected",
              "Offer not accepted",
              `The seller accepted another offer for ${product.title}.`,
              "#/account?tab=offers",
            );
          }
        }
        next.products = next.products.map((item) =>
          item.id === product.id ? { ...item, status: "reserved" } : item,
        );

        if (isSeller) {
          pushNotification(
            next,
            target.buyerId,
            "offer_accepted",
            "Your offer was accepted",
            `${activeUser.name} accepted your offer on ${product.title}. Complete payment within ${next.settings.offerCheckoutHours} hours.`,
            "#/account?tab=offers",
          );
        } else {
          pushNotification(
            next,
            target.sellerId,
            "offer_accepted",
            "Counter-offer accepted",
            `${activeUser.name} accepted your counter-offer on ${product.title}. Item reserved for checkout.`,
            "#/seller?tab=offers",
          );
        }

        next.auditLogs.unshift({
          id: uid("al"),
          actorId: activeUser.id,
          action: "offer.accept",
          entityType: "offer",
          entityId: target.id,
          detail: `Accepted offer on ${product.title}.`,
          createdAt: nowIso(),
        });
      } else {
        target.status = "rejected";
        void Promise.resolve(supabase.rpc("respond_to_offer", { p_offer_id: offerId, p_accept: false })).catch((err: any) => console.warn("[Supabase respond_to_offer reject]:", err?.message));
        if (isSeller) {
          pushNotification(
            next,
            target.buyerId,
            "offer_rejected",
            "Offer not accepted",
            `The seller passed on your offer for ${product.title}. The listing is still available.`,
            "#/account?tab=offers",
          );
        } else {
          pushNotification(
            next,
            target.sellerId,
            "offer_rejected",
            "Counter-offer declined",
            `The buyer declined your counter-offer for ${product.title}.`,
            "#/seller?tab=offers",
          );
        }
      }
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const counterOffer = useCallback(
    (offerId: string, counterAmount: number, message?: string): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      const offer = current.offers.find((item) => item.id === offerId);
      if (!activeUser || !offer) return { ok: false, error: "Offer not found." };
      if (offer.sellerId !== activeUser.id && offer.buyerId !== activeUser.id) {
        return { ok: false, error: "Unauthorized to counter this offer." };
      }
      if (!["pending", "counter_offered"].includes(offer.status)) {
        return { ok: false, error: "This offer can no longer be negotiated." };
      }
      if (!Number.isInteger(counterAmount) || counterAmount <= 0) {
        return { ok: false, error: "Enter a valid counter offer amount." };
      }
      const product = current.products.find((item) => item.id === offer.productId);
      if (!product) return { ok: false, error: "Listing not found." };
      if (counterAmount >= product.askingPrice) {
        return { ok: false, error: "Counter offer must be below the original asking price." };
      }

      const next = clone(current);
      const target = next.offers.find((item) => item.id === offerId)!;
      const isSeller = activeUser.id === offer.sellerId;

      if (isSeller) {
        target.status = "counter_offered";
        target.counterAmount = counterAmount;
        target.counterMessage = message?.trim() || undefined;
        target.lastCounterBy = "seller";
        target.expiresAt = futureIso(48);

        pushNotification(
          next,
          target.buyerId,
          "offer_countered",
          "Counter-offer received",
          `The seller countered with ₹${(counterAmount / 100).toLocaleString("en-IN")} on ${product.title}.`,
          "#/account?tab=offers",
        );
      } else {
        target.status = "pending";
        target.amount = counterAmount;
        target.counterAmount = undefined;
        target.counterMessage = undefined;
        target.message = message?.trim() || undefined;
        target.lastCounterBy = "buyer";
        target.expiresAt = futureIso(48);

        pushNotification(
          next,
          target.sellerId,
          "offer_countered",
          "Buyer counter-offer received",
          `The buyer sent a counter-offer of ₹${(counterAmount / 100).toLocaleString("en-IN")} on ${product.title}.`,
          "#/seller?tab=offers",
        );
      }

      commit(next);

      void Promise.resolve(
        supabase.rpc("counter_offer", {
          p_offer_id: offerId,
          p_counter_amount_paise: counterAmount,
          p_message: message || "",
        })
      ).catch((err: any) => console.warn("[Supabase counter_offer error]:", err?.message));

      return { ok: true };
    },
    [commit],
  );

  const cancelOffer = useCallback(
    (offerId: string): ActionResult => {
      const current = dbRef.current;
      const offer = current.offers.find((item) => item.id === offerId);
      if (!offer) return { ok: false, error: "Offer not found." };
      if (offer.buyerId !== current.sessionUserId) return { ok: false, error: "Not your offer." };
      if (!["pending", "accepted"].includes(offer.status)) return { ok: false, error: "This offer cannot be cancelled." };
      const next = clone(current);
      const target = next.offers.find((item) => item.id === offerId)!;
      target.status = "cancelled";
      releaseProductIfReserved(next, offer.productId);
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const createOrders = useCallback(
    (input: { addressId: string; productId?: string; offerId?: string; quantity?: number }) => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!activeUser) return { ok: false as const, error: "Sign in to check out." };
      const address = activeUser.addresses.find((item) => item.id === input.addressId);
      if (!address) return { ok: false as const, error: "Choose a delivery address." };
      if (!isValidIndianPincode(address.pincode)) {
        return {
          ok: false as const,
          error: "Enter a valid six-digit Indian PIN code.",
        };
      }

      let groups: { sellerId: string; items: { product: Product; quantity: number; unitPrice?: number }[] }[] = [];
      let offer: Offer | undefined;
      let source: Order["source"] = "cart";

      if (input.offerId) {
        offer = current.offers.find((item) => item.id === input.offerId);
        if (!offer || offer.buyerId !== activeUser.id) {
          return { ok: false as const, error: "Offer not found." };
        }
        if (!["accepted", "converted"].includes(offer.status)) {
          return { ok: false as const, error: "This offer is not ready for checkout." };
        }
        const offerRecord = offer;
        if (
          current.orders.some(
            (order) => order.offerId === offerRecord.id && order.status === "pending_payment",
          )
        ) {
          return { ok: false as const, error: "This offer already has a pending checkout." };
        }
        if (offerRecord.checkoutExpiresAt && new Date(offerRecord.checkoutExpiresAt).getTime() < Date.now()) {
          return { ok: false as const, error: "This offer checkout has expired." };
        }
        const product = current.products.find((item) => item.id === offerRecord.productId);
        if (!product) return { ok: false as const, error: "Listing not found." };
        groups = [{ sellerId: product.sellerId, items: [{ product, quantity: 1, unitPrice: offerRecord.amount }] }];
        source = "offer";
      } else if (input.productId) {
        const product = current.products.find((item) => item.id === input.productId);
        if (!product) return { ok: false as const, error: "Listing not found." };
        if (product.status !== "active" && product.status !== "reserved") return { ok: false as const, error: "This item is no longer available." };
        if (product.sellerId === activeUser.id) return { ok: false as const, error: "You cannot buy your own listing." };
        groups = [
          {
            sellerId: product.sellerId,
            items: [{ product, quantity: Math.max(1, Math.min(input.quantity ?? 1, product.quantity)) }],
          },
        ];
        source = "buy_now";
      } else {
        const key = activeUser.id;
        const lines = current.carts[key] ?? [];
        if (!lines.length) return { ok: false as const, error: "Your cart is empty." };
        for (const line of lines) {
          const product = current.products.find((item) => item.id === line.productId);
          if (!product) return { ok: false as const, error: "An item in your cart no longer exists." };
          if (product.status !== "active" && product.status !== "reserved") {
            return { ok: false as const, error: `${product.title} is no longer available. Remove it from the cart.` };
          }
          if (product.sellerId === activeUser.id) {
            return { ok: false as const, error: "Remove your own listing from the cart." };
          }
          const group = groups.find((item) => item.sellerId === product.sellerId);
          if (group) group.items.push({ product, quantity: line.quantity });
          else groups.push({ sellerId: product.sellerId, items: [{ product, quantity: line.quantity }] });
        }
        source = "cart";
      }

      const next = clone(current);
      const checkoutGroupId = uid("cg");
      const orderIds: string[] = [];
      for (const [index, group] of groups.entries()) {
        const order = createOrder(next, {
          buyerId: activeUser.id,
          sellerId: group.sellerId,
          items: group.items,
          address,
          source,
          offerId: offer?.id,
          checkoutGroupId,
          platformFee: index === 0 ? BUYER_PLATFORM_FEE_PAISE : 0,
        });
        orderIds.push(order.id);
        pushNotification(
          next,
          group.sellerId,
          "order_created",
          "New order received",
          `${activeUser.name} placed order ${order.number}. Payment is pending.`,
          "#/seller?tab=orders",
        );
      }
      markProductsReserved(
        next,
        groups.flatMap((group) => group.items.map((item) => item.product.id)),
      );
      if (source === "cart") {
        const cartLines = next.carts[activeUser.id] ?? [];
        const purchased = new Set(groups.flatMap((group) => group.items.map((item) => item.product.id)));
        next.carts[activeUser.id] = cartLines.filter((line) => !purchased.has(line.productId));
      }
      if (offer) {
        const target = next.offers.find((item) => item.id === offer.id);
        if (target) target.status = "converted";
      }
      commit(next);
      return { ok: true as const, orderIds };
    },
    [commit],
  );

  const payOrders = useCallback(
    (orderIds: string[]): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!activeUser) return { ok: false, error: "Sign in to pay." };
      const targets = current.orders.filter(
        (order) => orderIds.includes(order.id) && order.buyerId === activeUser.id,
      );
      if (!targets.length) return { ok: false, error: "Order not found." };
      if (targets.some((order) => order.status !== "pending_payment")) {
        return { ok: false, error: "This order is not awaiting payment." };
      }
      const next = clone(current);
      // A customer who arrived through a link but was already signed in gets
      // credited on their first paid order. First attribution always wins.
      const buyer = next.users.find((item) => item.id === activeUser.id);
      if (buyer && !buyer.referredBy) {
        const storedCode = getStoredRef();
        const account = storedCode ? findAffiliateByCode(storedCode, next.affiliates) : null;
        if (account && account.status === "active") buyer.referredBy = account.id;
      }
      for (const target of next.orders.filter((order) => orderIds.includes(order.id))) {
        target.status = "paid";
        target.paymentStatus = "paid";
        target.paidAt = nowIso();
        target.shipment = {
          status: "pending_pickup",
          events: [
            {
              status: "pending_pickup",
              at: nowIso(),
              note: "Payment confirmed. Seller notified to arrange pickup.",
            },
          ],
        };
        for (const item of target.items) {
          const product = next.products.find((candidate) => candidate.id === item.productId);
          if (!product) continue;
          if (product.quantity > item.quantity) {
            product.quantity -= item.quantity;
            product.status = "active";
          } else {
            product.quantity = 0;
            product.status = "sold";
          }
        }
        creditAffiliate(next, target);
        if (target.offerId) {
          const offer = next.offers.find((item) => item.id === target.offerId);
          if (offer) offer.status = "converted";
        }
        if (target.auctionId) {
          const auction = next.auctions.find((item) => item.id === target.auctionId);
          if (auction?.financial) {
            next.settlements.unshift({
              id: uid("s"),
              sellerId: target.sellerId,
              orderId: target.id,
              auctionId: target.auctionId,
              source: "auction",
              askingPrice: auction.financial.askingPrice,
              winningBid: auction.financial.winningBid,
              sellerPayout: auction.financial.sellerPayout,
              platformSubsidy: auction.financial.platformSubsidy,
              platformCommission: auction.financial.platformCommission,
              buyerPlatformFee: target.platformFee ?? 0,
              paymentFee: 0,
              status: "pending",
              createdAt: nowIso(),
            });
          }
        } else {
          const seller = next.users.find((u) => u.id === target.sellerId);
          const commission = sellerCommission(target.subtotal, seller?.sellerTier);
          next.settlements.unshift({
            id: uid("s"),
            sellerId: target.sellerId,
            orderId: target.id,
            source: target.source === "offer" ? "offer" : "marketplace",
            askingPrice: target.subtotal,
            sellerPayout: sellerNetPayout(target.subtotal, seller?.sellerTier),
            platformSubsidy: 0,
            platformCommission: commission,
            buyerPlatformFee: target.platformFee ?? 0,
            paymentFee: 0,
            status: "pending",
            createdAt: nowIso(),
          });
        }
        pushNotification(
          next,
          target.buyerId,
          "payment_confirmed",
          "Payment confirmed",
          `Order ${target.number} is confirmed. The seller will arrange pickup.`,
          `#/orders/${target.id}`,
        );
        pushNotification(
          next,
          target.sellerId,
          "order_paid",
          "Order paid",
          `Order ${target.number} is paid. Arrange pickup for the buyer.`,
          "#/seller?tab=orders",
        );
      }
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const cancelOrder = useCallback(
    (orderId: string): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      const order = current.orders.find((item) => item.id === orderId);
      if (!activeUser || !order) return { ok: false, error: "Order not found." };
      if (order.buyerId !== activeUser.id && order.sellerId !== activeUser.id && activeUser.role !== "admin") {
        return { ok: false, error: "Not your order." };
      }
      if (activeUser.role !== "admin" && order.source === "auction") {
        return { ok: false, error: "Auction wins are final. Auction orders can't be cancelled." };
      }
      if (["shipped", "delivered", "cancelled", "returned"].includes(order.status)) {
        return { ok: false, error: "This order can no longer be cancelled." };
      }
      if (
        order.shipment &&
        ["picked_up", "in_transit", "out_for_delivery", "delivered", "returned"].includes(order.shipment.status)
      ) {
        return { ok: false, error: "The parcel has been picked up. Orders can only be cancelled before pickup." };
      }
      const next = clone(current);
      const target = next.orders.find((item) => item.id === orderId)!;
      target.status = "cancelled";
      target.cancelledAt = nowIso();
      voidAffiliateForOrder(next, target.id);
      void Promise.resolve(supabase.rpc("cancel_order", { p_order_id: orderId, p_reason: "Cancelled by user/admin" })).catch((err: any) => console.warn("[Supabase cancel_order]:", err?.message));
      if (target.paymentStatus === "paid") target.paymentStatus = "refunded";
      for (const item of target.items) {
        const product = next.products.find((candidate) => candidate.id === item.productId);
        if (product && product.status !== "sold") product.status = "active";
      }
      pushNotification(
        next,
        target.buyerId === activeUser.id ? target.sellerId : target.buyerId,
        "order_cancelled",
        "Order cancelled",
        `Order ${target.number} was cancelled.`,
        `#/orders/${target.id}`,
      );
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const requestReturn = useCallback(
    (orderId: string): ActionResult => {
      const current = dbRef.current;
      const order = current.orders.find((item) => item.id === orderId);
      if (!order) return { ok: false, error: "Order not found." };
      if (order.buyerId !== current.sessionUserId) return { ok: false, error: "Not your order." };
      if (order.status !== "delivered") return { ok: false, error: "Only delivered orders can be returned." };
      if (order.source === "auction") {
        return {
          ok: false,
          error: "Auction wins are final. If the item is damaged or not as described, report the issue and our team will review it.",
        };
      }
      const next = clone(current);
      const target = next.orders.find((item) => item.id === orderId)!;
      target.status = "returned";
      voidAffiliateForOrder(next, target.id);
      if (target.shipment) {
        target.shipment.status = "returned";
        target.shipment.events.push({
          status: "returned",
          at: nowIso(),
          note: "Return requested by buyer.",
        });
      }
      pushNotification(
        next,
        target.sellerId,
        "return_requested",
        "Return requested",
        `The buyer requested a return for order ${target.number}.`,
        "#/seller?tab=orders",
      );
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const addReview = useCallback(
    (orderId: string, rating: number, comment: string): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      const order = current.orders.find((item) => item.id === orderId);
      if (!activeUser || !order) return { ok: false, error: "Order not found." };
      if (order.buyerId !== activeUser.id) return { ok: false, error: "Only the buyer can review this order." };
      if (order.status !== "delivered") return { ok: false, error: "Reviews open after delivery." };
      if (current.reviews.some((review) => review.orderId === orderId)) {
        return { ok: false, error: "You already reviewed this order." };
      }
      const next = clone(current);
      const review: Review = {
        id: uid("r"),
        orderId,
        productId: order.items[0]?.productId ?? "",
        buyerId: activeUser.id,
        sellerId: order.sellerId,
        rating,
        comment: comment.trim() || undefined,
        createdAt: nowIso(),
      };
      next.reviews.unshift(review);
      pushNotification(
        next,
        order.sellerId,
        "review_received",
        "New review",
        `${activeUser.name} left a ${rating}-star review.`,
        "#/seller?tab=overview",
      );
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const advanceShipment = useCallback(
    (
      orderId: string,
      status: NonNullable<Order["shipment"]>["status"],
      detail?: { provider?: string; awb?: string; trackingUrl?: string; note?: string },
    ): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      const order = current.orders.find((item) => item.id === orderId);
      if (!activeUser || !order) return { ok: false, error: "Order not found." };
      if (order.sellerId !== activeUser.id && activeUser.role !== "admin") {
        return { ok: false, error: "Only the seller or an admin can update delivery." };
      }
      if (order.status === "cancelled" || order.status === "expired") {
        return { ok: false, error: "This order is closed." };
      }
      const next = clone(current);
      const target = next.orders.find((item) => item.id === orderId)!;
      const shipment = target.shipment ?? { status, events: [] };
      shipment.status = status;
      void Promise.resolve(supabase.rpc("advance_shipment", { p_order_id: orderId, p_status: status, p_provider: detail?.provider || null, p_awb: detail?.awb || null, p_tracking_url: detail?.trackingUrl || null, p_note: detail?.note || "" })).catch((err: any) => console.warn("[Supabase advance_shipment]:", err?.message));
      if (detail?.provider) shipment.provider = detail.provider;
      if (detail?.awb) shipment.awb = detail.awb;
      if (detail?.trackingUrl) shipment.trackingUrl = detail.trackingUrl;
      shipment.events.push({
        status,
        at: nowIso(),
        note: detail?.note || `Status updated manually to ${status.replaceAll("_", " ")}.`,
      });
      target.shipment = shipment;
      if (["picked_up", "in_transit", "out_for_delivery"].includes(status)) {
        target.status = status === "picked_up" ? "awaiting_pickup" : "shipped";
      }
      if (status === "delivered") {
        target.status = "delivered";
        const deliveredAt = Date.now();
        for (const entry of next.affiliateCommissions ?? []) {
          if (entry.orderId === target.id && entry.status === "pending") {
            const days = entry.returnWindowDays ?? next.settings.returnWindowDays ?? 7;
            entry.eligibleAt = new Date(deliveredAt + days * 86_400_000).toISOString();
          }
        }
        pushNotification(
          next,
          target.buyerId,
          "delivery_confirmed",
          "Delivered",
          `Order ${target.number} was delivered. Leave a review for the seller.`,
          `#/orders/${target.id}`,
        );
      } else {
        pushNotification(
          next,
          target.buyerId,
          "shipment_update",
          "Delivery update",
          `Order ${target.number}: ${status.replaceAll("_", " ")}.`,
          `#/orders/${target.id}`,
        );
      }
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const createListing = useCallback(
    (input: ListingInput) => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!activeUser) return { ok: false as const, error: "Sign in to list an item." };
      if (!input.title.trim()) return { ok: false as const, error: "Add a title." };
      if (!input.description.trim()) return { ok: false as const, error: "Add a description." };
      if (!Number.isInteger(input.askingPrice) || input.askingPrice <= 0) {
        return { ok: false as const, error: "Enter a valid asking price." };
      }
      if (!Number.isInteger(input.quantity) || input.quantity < 1) {
        return { ok: false as const, error: "Quantity must be at least 1." };
      }
      if (!input.images.length) return { ok: false as const, error: "Add at least one photo." };
      const next = clone(current);
      const seller = next.users.find((item) => item.id === activeUser.id)!;
      seller.isSeller = true;
      if (seller.role === "buyer") seller.role = "seller";
      const product: Product = {
        id: uid("p"),
        sellerId: seller.id,
        sellerName: seller.name,
        title: input.title.trim(),
        description: input.description.trim(),
        brand: input.brand?.trim() || undefined,
        condition: input.condition,
        category: input.category,
        subcategory: input.subcategory,
        askingPrice: input.askingPrice,
        images: input.images,
        size: input.size?.trim() || undefined,
        quantity: input.quantity,
        isUnique: input.quantity === 1,
        location: input.location,
        shippingFee: input.shippingFee,
        status: next.settings.sellerAutoApprove ? "active" : "pending",
        allowOffers: input.allowOffers,
        auctionConsent: input.auctionConsent,
        createdAt: nowIso(),
        views: 0,
        color: "#e8e6df",
        moderationNote: next.settings.sellerAutoApprove
          ? undefined
          : "Waiting for admin approval.",
      };
      next.products.unshift(product);
      pushNotification(
        next,
        seller.id,
        "listing_created",
        product.status === "active" ? "Your listing is live" : "Your listing is in review",
        product.status === "active"
          ? `${product.title} is now visible on the marketplace.`
          : `${product.title} will go live after an admin review.`,
        "#/seller?tab=listings",
      );
      if (product.status === "pending") {
        for (const admin of next.users.filter((candidate) => candidate.role === "admin")) {
          pushNotification(
            next,
            admin.id,
            "product_pending",
            "A listing needs review",
            `${product.title} from ${seller.name} is waiting for approval.`,
            "#/admin?tab=listings",
          );
        }
      }
      commit(next);
      // Supabase Realtime Persistence
        (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
              const uploadedImages = await uploadListingImages(session.user.id, input.images);
              await supabase.rpc("save_listing", {
                p_payload: {
                  title: input.title.trim(),
                  description: input.description.trim(),
                  brand: input.brand?.trim() || null,
                  condition: UI_TO_CONDITION_MAP[input.condition] || "good",
                  category: input.category,
                  subcategory: input.subcategory || null,
                  asking_price_paise: input.askingPrice,
                  size: input.size?.trim() || null,
                  quantity: input.quantity,
                  location: input.location || "Trivandrum, Kerala",
                  shipping_fee_paise: input.shippingFee,
                  allow_offers: input.allowOffers,
                  auction_consent: input.auctionConsent,
                },
                p_images: uploadedImages,
              });
            }
          } catch (err) {
            console.warn("[Supabase save_listing error]:", err);
          }
        })();

        return { ok: true as const, productId: product.id };
    },
    [commit],
  );

  const updateListing = useCallback(
    (productId: string, patch: Partial<ListingInput> & { status?: ProductStatus }): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      const product = current.products.find((item) => item.id === productId);
      if (!activeUser || !product) return { ok: false, error: "Listing not found." };
      if (product.sellerId !== activeUser.id && activeUser.role !== "admin") {
        return { ok: false, error: "Not your listing." };
      }
      const next = clone(current);
      const target = next.products.find((item) => item.id === productId)!;
      if (patch.title !== undefined) target.title = patch.title.trim();
      if (patch.description !== undefined) target.description = patch.description.trim();
      if (patch.brand !== undefined) target.brand = patch.brand.trim() || undefined;
      if (patch.condition !== undefined) target.condition = patch.condition;
      if (patch.category !== undefined) target.category = patch.category;
      if (patch.subcategory !== undefined) target.subcategory = patch.subcategory;
      if (patch.askingPrice !== undefined) target.askingPrice = patch.askingPrice;
      if (patch.images !== undefined) target.images = patch.images;
      if (patch.size !== undefined) target.size = patch.size.trim() || undefined;
      if (patch.quantity !== undefined) {
        target.quantity = patch.quantity;
        target.isUnique = patch.quantity === 1;
      }
      if (patch.location !== undefined) target.location = patch.location;
      if (patch.shippingFee !== undefined) target.shippingFee = patch.shippingFee;
      if (patch.allowOffers !== undefined) target.allowOffers = patch.allowOffers;
      if (patch.auctionConsent !== undefined) target.auctionConsent = patch.auctionConsent;
      if (patch.status) target.status = patch.status;
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const removeListing = useCallback(
    (productId: string): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      const product = current.products.find((item) => item.id === productId);
      if (!activeUser || !product) return { ok: false, error: "Listing not found." };
      if (product.sellerId !== activeUser.id && activeUser.role !== "admin") {
        return { ok: false, error: "Not your listing." };
      }
      const next = clone(current);
      const target = next.products.find((item) => item.id === productId)!;
      target.status = "removed";
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const toggleListingAvailability = useCallback(
    (productId: string): ActionResult => {
      const current = dbRef.current;
      const product = current.products.find((item) => item.id === productId);
      if (!product) return { ok: false, error: "Listing not found." };
      if (product.sellerId !== current.sessionUserId) return { ok: false, error: "Not your listing." };
      const next = clone(current);
      const target = next.products.find((item) => item.id === productId)!;
      target.status = target.status === "active" ? "draft" : "active";
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const reportProduct = useCallback(
    (productId: string, reason: string, details?: string): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!activeUser) return { ok: false, error: "Sign in to report a listing." };
      if (!reason.trim()) return { ok: false, error: "Choose a reason." };
      const next = clone(current);
      const report: Report = {
        id: uid("rep"),
        productId,
        reporterId: activeUser.id,
        reason,
        details: details?.trim() || undefined,
        status: "open",
        createdAt: nowIso(),
      };
      next.reports.unshift(report);
      for (const admin of next.users.filter((candidate) => candidate.role === "admin")) {
        pushNotification(
          next,
          admin.id,
          "report_created",
          "New listing report",
          `A buyer reported a listing: ${reason}.`,
          "#/admin?tab=reports",
        );
      }
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const placeBid = useCallback(
    async (auctionId: string, amount: number): Promise<PlaceBidResult> => {
      if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Enter a valid bid." };
      if (amount > 200_000_000) return { ok: false, error: "Bid exceeds maximum allowed limit." };
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return { ok: false, error: "Sign in to bid." };
      const { data, error } = await supabase.rpc("place_bid", {
        p_auction_id: auctionId,
        p_amount_paise: amount,
      });
      if (error) return { ok: false, error: error.message };

      const [{ data: row }, { data: publicBids }] = await Promise.all([
        supabase.from("auctions").select("*").eq("id", auctionId).maybeSingle(),
        supabase.from("public_bids").select("*").eq("auction_id", auctionId).order("created_at", { ascending: false }),
      ]);
      if (row) {
        const next = clone(dbRef.current);
        const auction = next.auctions.find((item) => item.id === auctionId);
        if (auction) {
          auction.status = row.status;
          auction.startsAt = row.starts_at;
          auction.endsAt = row.ends_at;
          auction.currentBid = row.current_bid_paise ?? undefined;
          auction.highestBidderId = row.highest_bidder_id === authData.user.id
            ? next.users.find((item) => item.email.toLowerCase() === authData.user.email?.toLowerCase())?.id
            : row.highest_bidder_id ?? undefined;
          auction.bidCount = row.bid_count;
          auction.bids = (publicBids ?? []).map((bid: any) => ({
            id: bid.id,
            auctionId,
            bidderId: bid.bidder_id ?? "",
            amount: bid.amount_paise,
            alias: bid.alias,
            createdAt: bid.created_at,
          }));
          commit(next);
        }
      }
      return { ok: true, amount: data.amount_paise ?? amount, extended: Boolean(data.extended) };
    },
    [commit],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      const next = clone(dbRef.current);
      const target = next.notifications.find((item) => item.id === id);
      if (target && !target.readAt) {
        target.readAt = nowIso();
        commit(next);
      }
    },
    [commit],
  );

  const markAllNotificationsRead = useCallback(() => {
    const next = clone(dbRef.current);
    let changed = false;
    for (const notification of next.notifications) {
      if (notification.userId === next.sessionUserId && !notification.readAt) {
        notification.readAt = nowIso();
        changed = true;
      }
    }
    if (changed) commit(next);
  }, [commit]);

  const saveAddress = useCallback(
    (address: Omit<Address, "id"> & { id?: string }): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!activeUser) return { ok: false, error: "Sign in to save an address." };
      if (!address.line1.trim() || !address.pincode.trim()) {
        return { ok: false, error: "Address line and pincode are required." };
      }
      if (!isValidIndianPincode(address.pincode.trim())) {
        return { ok: false, error: "Enter a valid six-digit Indian PIN code." };
      }
      const next = clone(current);
      const user = next.users.find((item) => item.id === activeUser.id)!;
      if (address.id) {
        const index = user.addresses.findIndex((item) => item.id === address.id);
        if (index >= 0) user.addresses[index] = { ...user.addresses[index], ...address, id: address.id };
      } else {
        const created: Address = { ...address, id: uid("addr") };
        if (created.isDefault || !user.addresses.length) {
          user.addresses = user.addresses.map((item) => ({ ...item, isDefault: false }));
          created.isDefault = true;
        }
        user.addresses.push(created);
      }
      if (address.isDefault) {
        user.addresses = user.addresses.map((item) => ({
          ...item,
          isDefault: item.id === address.id,
        }));
      }
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const removeAddress = useCallback(
    (addressId: string) => {
      const next = clone(dbRef.current);
      const user = next.users.find((item) => item.id === next.sessionUserId);
      if (!user) return;
      user.addresses = user.addresses.filter((item) => item.id !== addressId);
      if (user.addresses.length && !user.addresses.some((item) => item.isDefault)) {
        user.addresses[0].isDefault = true;
      }
      commit(next);
    },
    [commit],
  );

  const updateOrderAddress = useCallback(
    (orderId: string, address: Address): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!activeUser) return { ok: false, error: "Sign in required." };
      const order = current.orders.find((item) => item.id === orderId);
      if (!order) return { ok: false, error: "Order not found." };
      if (order.buyerId !== activeUser.id && activeUser.role !== "admin") {
        return { ok: false, error: "Not your order." };
      }
      if (order.status !== "pending_payment") {
        return { ok: false, error: "Address can only be updated before payment." };
      }
      if (!isValidIndianPincode(address.pincode)) {
        return { ok: false, error: "Enter a valid six-digit Indian PIN code." };
      }
      const next = clone(current);
      const target = next.orders.find((item) => item.id === orderId);
      if (target) {
        target.address = address;
        commit(next);
      }
      return { ok: true };
    },
    [commit],
  );

  const updateProfile = useCallback(
    (patch: { name?: string; phone?: string; bio?: string; location?: string; auctionConsent?: boolean }): ActionResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!activeUser) return { ok: false, error: "Sign in first." };
      if (patch.name !== undefined && !patch.name.trim()) return { ok: false, error: "Name cannot be empty." };
      const next = clone(current);
      const user = next.users.find((item) => item.id === activeUser.id)!;
      if (patch.name !== undefined) user.name = patch.name.trim();
      if (patch.phone !== undefined) user.phone = patch.phone.trim();
      if (patch.bio !== undefined) user.bio = patch.bio.trim();
      if (patch.location !== undefined) user.location = patch.location.trim();
      if (patch.auctionConsent !== undefined) user.auctionConsent = patch.auctionConsent;
      if (user.isSeller) {
        next.products = next.products.map((product) =>
          product.sellerId === user.id ? { ...product, sellerName: user.name } : product,
        );
      }
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const approveProduct = useCallback(
    (productId: string) => {
      const next = clone(dbRef.current);
      const product = next.products.find((item) => item.id === productId);
      if (!product) return;
      product.status = "active";
      product.moderationNote = undefined;
      void Promise.resolve(supabase.rpc("admin_review_product", { p_product_id: productId, p_approved: true })).catch((err: any) => console.warn("[Supabase admin_review_product approve]:", err?.message));
      pushNotification(
        next,
        product.sellerId,
        "listing_approved",
        "Your listing is live",
        `${product.title} was approved and is now visible.`,
        "#/seller?tab=listings",
      );
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: "listing.approve",
        entityType: "product",
        entityId: productId,
        detail: `Approved ${product.title}.`,
        createdAt: nowIso(),
      });
      commit(next);
    },
    [commit],
  );

  const rejectProduct = useCallback(
    (productId: string, reason: string) => {
      const next = clone(dbRef.current);
      const product = next.products.find((item) => item.id === productId);
      if (!product) return;
      product.status = "rejected";
      product.rejectionReason = reason;
      void Promise.resolve(supabase.rpc("admin_review_product", { p_product_id: productId, p_approved: false, p_note: reason })).catch((err: any) => console.warn("[Supabase admin_review_product reject]:", err?.message));
      pushNotification(
        next,
        product.sellerId,
        "listing_rejected",
        "Listing needs changes",
        `${product.title} was not approved. Reason: ${reason}`,
        "#/seller?tab=listings",
      );
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: "listing.reject",
        entityType: "product",
        entityId: productId,
        detail: `Rejected ${product.title}: ${reason}`,
        createdAt: nowIso(),
      });
      commit(next);
    },
    [commit],
  );

  const setUserBlocked = useCallback(
    (userId: string, blocked: boolean) => {
      const next = clone(dbRef.current);
      const target = next.users.find((item) => item.id === userId);
      if (!target) return;
      target.blocked = blocked;
      void Promise.resolve(supabase.rpc("admin_set_user_blocked", { p_user_id: userId, p_blocked: blocked })).catch((err: any) => console.warn("[Supabase admin_set_user_blocked]:", err?.message));
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: blocked ? "user.block" : "user.unblock",
        entityType: "user",
        entityId: userId,
        detail: `${blocked ? "Blocked" : "Unblocked"} ${target.email}.`,
        createdAt: nowIso(),
      });
      commit(next);
    },
    [commit],
  );

  const updateSellerTier = useCallback(
    (userId: string, tier: SellerTier): ActionResult => {
      const next = clone(dbRef.current);
      const active = next.users.find((u) => u.id === next.sessionUserId);
      if (active?.role !== "admin") return { ok: false, error: "Admin access required." };
      const target = next.users.find((u) => u.id === userId);
      if (!target) return { ok: false, error: "User not found." };
      target.sellerTier = tier;
      void Promise.resolve(supabase.rpc("set_seller_tier", { p_user_id: userId, p_tier: tier })).catch((err: any) => console.warn("[Supabase set_seller_tier]:", err?.message));
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: "user.tier_update",
        entityType: "user",
        entityId: userId,
        detail: `Updated ${target.name} seller tier to ${tier}.`,
        createdAt: nowIso(),
      });
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const updateSettings = useCallback(
    (patch: Partial<PlatformSettings>) => {
      const next = clone(dbRef.current);
      next.settings = { ...next.settings, ...patch };
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: "settings.update",
        entityType: "settings",
        detail: Object.keys(patch).join(", "),
        createdAt: nowIso(),
      });
      commit(next);
    },
    [commit],
  );

  const generateAuctions = useCallback((): ActionResult => {
    const current = dbRef.current;
    const next = clone(current);
    const now = Date.now();
    const eligible = next.products.filter(
      (product) =>
        product.status === "active" &&
        product.quantity > 0 &&
        product.auctionConsent &&
        !next.auctions.some(
          (auction) =>
            auction.productId === product.id && ["scheduled", "live"].includes(auction.status),
        ),
    );
    if (eligible.length < 3) {
      return { ok: false, error: "Need at least 3 eligible listings with auction consent." };
    }
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const count = Math.min(next.settings.auctionDailyCount, shuffled.length);
    let created = 0;
    for (let index = 0; index < count; index += 1) {
      const product = shuffled[index];
      const startsAt = now + (25 + index * 42 + Math.floor(Math.random() * 15)) * 60_000;
      const endsAt = startsAt + next.settings.auctionDurationMinutes * 60_000;
      const startingPrice = Math.max(
        100,
        Math.round((product.askingPrice * 50) / 100 / 100) * 100,
      );
      const auction: Auction = {
        id: uid("a"),
        productId: product.id,
        sellerId: product.sellerId,
        status: "scheduled",
        startingPrice,
        askingPrice: product.askingPrice,
        bidCount: 0,
        minIncrement: next.settings.auctionMinIncrement,
        antiSnipeSeconds: next.settings.auctionAntiSnipeSeconds,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        originalEndsAt: new Date(endsAt).toISOString(),
        createdAt: nowIso(),
        bids: [],
      };
      next.auctions.unshift(auction);
      pushNotification(
        next,
        product.sellerId,
        "auction_selected",
        "Your item was selected for auction",
        `${product.title} is scheduled at ${new Date(startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}.`,
        "#/seller?tab=auctions",
      );
      created += 1;
    }
    next.auditLogs.unshift({
      id: uid("al"),
      actorId: next.sessionUserId ?? "",
      action: "auction.generate",
      entityType: "auction",
      detail: `Generated ${created} auction slots.`,
      createdAt: nowIso(),
    });
    commit(next);
    return { ok: true };
  }, [commit]);

  const scheduleAuction = useCallback(
    (productId: string, startsAt: string, durationMinutes?: number): ActionResult => {
      const current = dbRef.current;
      const product = current.products.find((item) => item.id === productId);
      if (!product) return { ok: false, error: "Listing not found." };
      if (product.status !== "active") return { ok: false, error: "Only active listings can be auctioned." };
      const next = clone(current);
      const duration = durationMinutes ?? next.settings.auctionDurationMinutes;
      const start = new Date(startsAt).getTime();
      if (Number.isNaN(start)) return { ok: false, error: "Choose a valid start time." };
      const auction: Auction = {
        id: uid("a"),
        productId,
        sellerId: product.sellerId,
        status: start <= Date.now() ? "live" : "scheduled",
        startingPrice: Math.max(
          100,
          Math.round((product.askingPrice * 50) / 100 / 100) * 100,
        ),
        askingPrice: product.askingPrice,
        bidCount: 0,
        minIncrement: next.settings.auctionMinIncrement,
        antiSnipeSeconds: next.settings.auctionAntiSnipeSeconds,
        startsAt: start <= Date.now() ? nowIso() : new Date(start).toISOString(),
        endsAt: new Date(Math.max(start, Date.now()) + duration * 60_000).toISOString(),
        originalEndsAt: new Date(Math.max(start, Date.now()) + duration * 60_000).toISOString(),
        createdAt: nowIso(),
        bids: [],
      };
      next.auctions.unshift(auction);
      pushNotification(
        next,
        product.sellerId,
        "auction_selected",
        "Your item was scheduled for auction",
        `${product.title} is scheduled for auction.`,
        "#/seller?tab=auctions",
      );
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: "auction.schedule",
        entityType: "auction",
        entityId: auction.id,
        detail: `Scheduled ${product.title}.`,
        createdAt: nowIso(),
      });
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const startAuctionNow = useCallback(
    (auctionId: string) => {
      const next = clone(dbRef.current);
      const auction = next.auctions.find((item) => item.id === auctionId);
      if (!auction || auction.status !== "scheduled") return;
      const start = Date.now();
      auction.status = "live";
      auction.startsAt = new Date(start).toISOString();
      auction.endsAt = new Date(start + next.settings.auctionDurationMinutes * 60_000).toISOString();
      auction.originalEndsAt = auction.endsAt;
      commit(next);
    },
    [commit],
  );

  const endAuctionNow = useCallback(
    (auctionId: string) => {
      const next = clone(dbRef.current);
      const auction = next.auctions.find((item) => item.id === auctionId);
      if (!auction || auction.status !== "live") return;
      auction.endsAt = new Date(Date.now() - 1000).toISOString();
      advance(next, Date.now());
      commit(next);
    },
    [commit],
  );

  const cancelAuction = useCallback(
    (auctionId: string, reason: string) => {
      const next = clone(dbRef.current);
      const auction = next.auctions.find((item) => item.id === auctionId);
      if (!auction) return;
      auction.status = "cancelled";
      auction.cancelledReason = reason;
      pushNotification(
        next,
        auction.sellerId,
        "auction_cancelled",
        "Auction cancelled",
        `An auction was cancelled. Reason: ${reason}`,
        "#/seller?tab=auctions",
      );
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: "auction.cancel",
        entityType: "auction",
        entityId: auctionId,
        detail: reason,
        createdAt: nowIso(),
      });
      commit(next);
    },
    [commit],
  );

  const markSettlementPaid = useCallback(
    async (settlementId: string): Promise<ActionResult> => {
      const { error } = await supabase.rpc("admin_mark_settlement_paid", { p_settlement_id: settlementId });
      if (error) return { ok: false, error: error.message };
      const next = clone(dbRef.current);
      const settlement = next.settlements.find((item) => item.id === settlementId);
      if (!settlement) return { ok: false, error: "Settlement not found." };
      settlement.status = "paid";
      settlement.paidAt = nowIso();
      pushNotification(
        next,
        settlement.sellerId,
        "settlement_paid",
        "Payout sent",
        `Your payout of ₹${(settlement.sellerPayout / 100).toLocaleString("en-IN")} was marked paid.`,
        "#/seller?tab=earnings",
      );
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const resolveReport = useCallback(
    (reportId: string, status: Report["status"]) => {
      const next = clone(dbRef.current);
      const report = next.reports.find((item) => item.id === reportId);
      if (!report) return;
      report.status = status;
      commit(next);
    },
    [commit],
  );

  const createAffiliate = useCallback(
    async (input: {
      name: string;
      email?: string;
      code?: string;
      kind: AffiliateAccount["kind"];
      commissionPct: number;
    }): Promise<{ ok: true; affiliateId: string } | { ok: false; error: string }> => {
      const current = dbRef.current;
      const actor = current.users.find((item) => item.id === current.sessionUserId);
      if (actor?.role !== "admin") return { ok: false, error: "Admins only." };

      const name = input.name.trim();
      if (name.length < 2) return { ok: false, error: "Add a name for this link." };

      const { data, error } = await supabase.rpc("admin_create_affiliate", {
        p_name: name,
        p_email: input.email?.trim() || null,
        p_code: input.code?.trim() || null,
        p_kind: input.kind,
        p_commission_pct: input.commissionPct,
      });
      if (error) return { ok: false, error: error.message };

      const next = clone(current);
      const account: AffiliateAccount = {
        id: data.id,
        name: data.display_name,
        code: data.code,
        kind: data.kind,
        email: data.contact_email || undefined,
        commissionRate: Number(data.commission_pct) / 100,
        status: data.status,
        createdAt: data.created_at,
      };
      next.affiliates = [...(next.affiliates ?? []), account];
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: "affiliate.create",
        entityType: "affiliate",
        entityId: account.id,
        detail: `${account.name} (${account.code}) at ${(account.commissionRate * 100).toFixed(1)}%`,
        createdAt: nowIso(),
      });
      commit(next);
      return { ok: true, affiliateId: account.id };
    },
    [commit],
  );

  const updateAffiliate = useCallback(
    async (
      affiliateId: string,
      patch: {
        name?: string;
        email?: string;
        code?: string;
        kind?: AffiliateAccount["kind"];
        commissionPct?: number;
        status?: AffiliateAccount["status"];
      },
    ): Promise<ActionResult> => {
      const current = dbRef.current;
      const actor = current.users.find((item) => item.id === current.sessionUserId);
      if (actor?.role !== "admin") return { ok: false, error: "Admins only." };

      const account = (current.affiliates ?? []).find((item) => item.id === affiliateId);
      if (!account) return { ok: false, error: "Link not found." };

      const nextCode = patch.code === undefined ? undefined : normaliseCode(patch.code);
      if (patch.code !== undefined && !nextCode) {
        return { ok: false, error: "Codes use 4–20 letters or numbers." };
      }
      if (
        nextCode &&
        (current.affiliates ?? []).some(
          (item) => item.id !== affiliateId && item.code === nextCode,
        )
      ) {
        return { ok: false, error: "That link code is already in use." };
      }

      const { error } = await supabase.rpc("admin_update_affiliate", {
        p_affiliate_id: affiliateId,
        p_name: patch.name ?? null,
        p_email: patch.email ?? null,
        p_code: patch.code ?? null,
        p_kind: patch.kind ?? null,
        p_commission_pct: patch.commissionPct ?? null,
        p_status: patch.status ?? null,
      });
      if (error) return { ok: false, error: error.message };

      const next = clone(current);
      const target = next.affiliates!.find((item) => item.id === affiliateId)!;
      if (patch.name !== undefined && patch.name.trim().length >= 2) target.name = patch.name.trim();
      if (patch.email !== undefined) target.email = patch.email.trim() || undefined;
      if (nextCode) target.code = nextCode;
      if (patch.kind) target.kind = patch.kind;
      if (patch.status) target.status = patch.status;
      if (patch.commissionPct !== undefined) {
        target.commissionRate = Math.min(50, Math.max(0, patch.commissionPct)) / 100;
      }

      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: "affiliate.update",
        entityType: "affiliate",
        entityId: target.id,
        detail: `${target.name} (${target.code}) at ${(target.commissionRate * 100).toFixed(1)}%`,
        createdAt: nowIso(),
      });
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const reviewAffiliateCommission = useCallback(
    async (commissionId: string, action: "approve" | "pay" | "void"): Promise<ActionResult> => {
      const current = dbRef.current;
      const actor = current.users.find((item) => item.id === current.sessionUserId);
      if (actor?.role !== "admin") return { ok: false, error: "Admins only." };

      const commission = (current.affiliateCommissions ?? []).find(
        (item) => item.id === commissionId,
      );
      if (!commission) return { ok: false, error: "Earning not found." };

      if (action === "approve") {
        if (commission.status !== "pending") {
          return { ok: false, error: "Only pending earnings can be approved." };
        }
        if (!commission.eligibleAt || new Date(commission.eligibleAt).getTime() > Date.now()) {
          return {
            ok: false,
            error: "The return window has not ended yet. This earning unlocks after delivery plus the return period.",
          };
        }
      }
      if (action === "pay" && commission.status !== "approved") {
        return { ok: false, error: "Release the earning before marking it paid." };
      }
      if (action === "void" && commission.status === "paid") {
        return { ok: false, error: "Paid earnings must be reversed by a payout adjustment." };
      }

      const { error } = await supabase.rpc("admin_review_affiliate_commission", {
        p_commission_id: commissionId,
        p_action: action,
      });
      if (error) return { ok: false, error: error.message };

      const next = clone(current);
      const target = next.affiliateCommissions!.find((item) => item.id === commissionId)!;
      if (action === "approve") {
        target.status = "approved";
        target.approvedAt = nowIso();
      } else if (action === "pay") {
        target.status = "paid";
        target.paidAt = nowIso();
      } else {
        target.status = "void";
      }
      next.auditLogs.unshift({
        id: uid("al"),
        actorId: next.sessionUserId ?? "",
        action: `affiliate.${action}`,
        entityType: "affiliate_commission",
        entityId: target.id,
        detail: `Order ${target.orderId} · ₹${(target.amount / 100).toLocaleString("en-IN")}`,
        createdAt: nowIso(),
      });
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const value: StoreValue = {
    db,
    user,
    cart,
    cartCount,
    cartSubtotal,
    favorites,
    notifications,
    unreadCount,
    refreshRemoteCommerce,
    login,
    register,
    signInWithGoogle,
    logout,
    switchAccount,
    resetDemo,
    addToCart,
    removeFromCart,
    setCartQuantity,
    clearCart,
    toggleFavorite,
    makeOffer,
    respondToOffer,
    counterOffer,
    cancelOffer,
    createOrders,
    payOrders,
    cancelOrder,
    requestReturn,
    addReview,
    advanceShipment,
    createListing,
    updateListing,
    removeListing,
    toggleListingAvailability,
    reportProduct,
    placeBid,
    markNotificationRead,
    markAllNotificationsRead,
    saveAddress,
    removeAddress,
    updateOrderAddress,
    updateProfile,
    approveProduct,
    rejectProduct,
    setUserBlocked,
    updateSellerTier,
    updateSettings,
    generateAuctions,
    scheduleAuction,
    startAuctionNow,
    endAuctionNow,
    cancelAuction,
    markSettlementPaid,
    resolveReport,
    createAffiliate,
    updateAffiliate,
    reviewAffiliateCommission,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
