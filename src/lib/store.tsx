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
import type {
  Address,
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
  User,
} from "./types";

const STORAGE_KEY = "lelam-marketplace-v1";

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clone(db: Database): Database {
  return structuredClone(db);
}

function loadDatabase(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    /* fall through to a clean seed */
  }
  const seeded = createSeedDatabase();
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
  askingPrice: number,
  winningBid: number,
  commissionPct: number,
): Pick<AuctionFinancial, "sellerPayout" | "platformSubsidy" | "platformCommission"> {
  if (winningBid < askingPrice) {
    return {
      sellerPayout: askingPrice,
      platformSubsidy: askingPrice - winningBid,
      platformCommission: 0,
    };
  }
  if (winningBid === askingPrice) {
    return { sellerPayout: askingPrice, platformSubsidy: 0, platformCommission: 0 };
  }
  const commission = Math.floor(((winningBid - askingPrice) * commissionPct) / 100);
  return {
    sellerPayout: winningBid - commission,
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
  return `LEL-${24200 + next.orders.length + Math.floor(Math.random() * 40)}`;
}

function shippingFor(
  items: { product: Product; quantity: number }[],
  settings: PlatformSettings,
): number {
  const subtotal = items.reduce((total, item) => total + item.product.askingPrice * item.quantity, 0);
  if (subtotal >= settings.freeShippingThreshold) return 0;
  return Math.max(...items.map((item) => item.product.shippingFee ?? settings.shippingFee));
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
  },
): Order {
  const subtotal = input.items.reduce(
    (total, item) => total + (item.unitPrice ?? item.product.askingPrice) * item.quantity,
    0,
  );
  const shipping = shippingFor(input.items, next.settings);
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
    shipping,
    total: subtotal + shipping,
    status: "pending_payment",
    paymentStatus: "pending",
    source: input.source,
    offerId: input.offerId,
    auctionId: input.auctionId,
    address: input.address,
    createdAt: nowIso(),
    paymentDeadline: futureIso(next.settings.auctionPaymentDeadlineHours),
  };
  next.orders.unshift(order);
  return order;
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
      const settlement = computeAuctionSettlement(
        auction.askingPrice,
        winnerBid.amount,
        next.settings.platformCommissionPct,
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
          city: "Trivandrum",
          state: "Kerala",
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
          `${product.title} ended at a winning bid. Your guaranteed payout is protected.`,
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
  login: (email: string, password: string) => ActionResult;
  register: (input: {
    name: string;
    email: string;
    password: string;
    asSeller: boolean;
  }) => ActionResult;
  logout: () => void;
  switchAccount: (userId: string) => void;
  resetDemo: () => void;
  addToCart: (productId: string, quantity?: number) => ActionResult;
  removeFromCart: (productId: string) => void;
  setCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  makeOffer: (productId: string, amount: number, message?: string) => ActionResult;
  respondToOffer: (offerId: string, accept: boolean) => ActionResult;
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
  placeBid: (auctionId: string, amount: number) => PlaceBidResult;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  saveAddress: (address: Omit<Address, "id"> & { id?: string }) => ActionResult;
  removeAddress: (addressId: string) => void;
  updateProfile: (patch: { name?: string; phone?: string; bio?: string; location?: string; auctionConsent?: boolean }) => ActionResult;
  approveProduct: (productId: string) => void;
  rejectProduct: (productId: string, reason: string) => void;
  setUserBlocked: (userId: string, blocked: boolean) => void;
  updateSettings: (patch: Partial<PlatformSettings>) => void;
  generateAuctions: () => ActionResult;
  scheduleAuction: (productId: string, startsAt: string, durationMinutes?: number) => ActionResult;
  startAuctionNow: (auctionId: string) => void;
  endAuctionNow: (auctionId: string) => void;
  cancelAuction: (auctionId: string, reason: string) => void;
  markSettlementPaid: (settlementId: string) => void;
  resolveReport: (reportId: string, status: Report["status"]) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(loadDatabase);
  const dbRef = useRef(db);

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

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Database;
        if (parsed.version === 1) {
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
    (email: string, password: string): ActionResult => {
      const current = dbRef.current;
      const found = current.users.find(
        (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!found || found.password !== password) {
        return { ok: false, error: "Email or password is incorrect." };
      }
      if (found.blocked) return { ok: false, error: "This account is blocked." };
      const next = clone(current);
      const guestCart = next.carts.guest ?? [];
      next.carts[found.id] = [...(next.carts[found.id] ?? []), ...guestCart];
      next.carts.guest = [];
      const guestFavorites = next.favorites.guest ?? [];
      next.favorites[found.id] = [
        ...new Set([...(next.favorites[found.id] ?? []), ...guestFavorites]),
      ];
      next.favorites.guest = [];
      next.sessionUserId = found.id;
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const register = useCallback(
    (input: { name: string; email: string; password: string; asSeller: boolean }): ActionResult => {
      const current = dbRef.current;
      if (current.users.some((candidate) => candidate.email.toLowerCase() === input.email.trim().toLowerCase())) {
        return { ok: false, error: "An account with this email already exists." };
      }
      if (input.password.length < 8) {
        return { ok: false, error: "Use at least 8 characters for your password." };
      }
      const next = clone(current);
      const newUser: User = {
        id: uid("u"),
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        role: input.asSeller ? "seller" : "buyer",
        isSeller: input.asSeller,
        addresses: [],
        joinedAt: nowIso(),
        auctionConsent: input.asSeller,
        location: "Trivandrum, Kerala",
      };
      next.users.push(newUser);
      const guestCart = next.carts.guest ?? [];
      next.carts[newUser.id] = guestCart;
      next.carts.guest = [];
      next.sessionUserId = newUser.id;
      pushNotification(
        next,
        newUser.id,
        "welcome",
        "Welcome to lelam.co",
        "Browse the rail, make an offer, or list something from your own closet.",
        "#/products",
      );
      commit(next);
      return { ok: true };
    },
    [commit],
  );

  const logout = useCallback(() => {
    const next = clone(dbRef.current);
    next.sessionUserId = null;
    commit(next);
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
    (productId: string, amount: number, message?: string): ActionResult => {
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
        message: message?.trim() || undefined,
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
      if (offer.sellerId !== activeUser.id) return { ok: false, error: "Only the seller can respond." };
      if (offer.status !== "pending") return { ok: false, error: "This offer is no longer pending." };
      const product = current.products.find((item) => item.id === offer.productId);
      if (!product) return { ok: false, error: "Listing not found." };
      const next = clone(current);
      const target = next.offers.find((item) => item.id === offerId)!;
      target.respondedAt = nowIso();
      if (accept) {
        target.status = "accepted";
        target.checkoutExpiresAt = futureIso(next.settings.offerCheckoutHours);
        for (const other of next.offers) {
          if (
            other.id !== target.id &&
            other.productId === target.productId &&
            other.status === "pending"
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
        pushNotification(
          next,
          target.buyerId,
          "offer_accepted",
          "Your offer was accepted",
          `${activeUser.name} accepted your offer on ${product.title}. Complete payment within ${next.settings.offerCheckoutHours} hours.`,
          "#/account?tab=offers",
        );
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
        pushNotification(
          next,
          target.buyerId,
          "offer_rejected",
          "Offer not accepted",
          `The seller passed on your offer for ${product.title}. The listing is still available.`,
          "#/account?tab=offers",
        );
      }
      commit(next);
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
      const serviceable = current.settings.serviceablePrefixes.some((prefix) =>
        address.pincode.startsWith(prefix),
      );
      if (!serviceable) {
        return {
          ok: false as const,
          error: `We do not deliver to ${address.pincode} yet. Service area: ${current.settings.serviceablePrefixes.map((prefix) => `${prefix}xxx`).join(", ")}.`,
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
        if (product.status !== "active") return { ok: false as const, error: "This item is no longer available." };
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
          if (product.status !== "active") {
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
      for (const group of groups) {
        const order = createOrder(next, {
          buyerId: activeUser.id,
          sellerId: group.sellerId,
          items: group.items,
          address,
          source,
          offerId: offer?.id,
          checkoutGroupId,
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
              paymentFee: 0,
              status: "pending",
              createdAt: nowIso(),
            });
          }
        } else {
          next.settlements.unshift({
            id: uid("s"),
            sellerId: target.sellerId,
            orderId: target.id,
            source: target.source === "offer" ? "offer" : "marketplace",
            askingPrice: target.subtotal,
            sellerPayout: target.subtotal,
            platformSubsidy: 0,
            platformCommission: 0,
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
      if (["shipped", "delivered", "cancelled", "returned"].includes(order.status)) {
        return { ok: false, error: "This order can no longer be cancelled." };
      }
      const next = clone(current);
      const target = next.orders.find((item) => item.id === orderId)!;
      target.status = "cancelled";
      target.cancelledAt = nowIso();
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
      const next = clone(current);
      const target = next.orders.find((item) => item.id === orderId)!;
      target.status = "returned";
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
    (auctionId: string, amount: number): PlaceBidResult => {
      const current = dbRef.current;
      const activeUser = current.users.find((item) => item.id === current.sessionUserId);
      if (!activeUser) return { ok: false, error: "Sign in to bid." };
      const auction = current.auctions.find((item) => item.id === auctionId);
      if (!auction) return { ok: false, error: "Auction not found." };
      const product = current.products.find((item) => item.id === auction.productId);
      if (!product) return { ok: false, error: "Listing not found." };
      if (auction.status !== "live" || new Date(auction.endsAt).getTime() <= Date.now()) {
        return { ok: false, error: "Bidding has closed for this auction." };
      }
      if (auction.sellerId === activeUser.id) return { ok: false, error: "You cannot bid on your own item." };
      if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Enter a valid bid." };
      const minimum = (auction.currentBid ?? auction.startingPrice - auction.minIncrement) + auction.minIncrement;
      if (amount < minimum) return { ok: false, error: `Minimum next bid is ₹${(minimum / 100).toLocaleString("en-IN")}.` };
      const oneMinuteAgo = Date.now() - 60_000;
      const recentBids = auction.bids.filter(
        (bid) => bid.bidderId === activeUser.id && new Date(bid.createdAt).getTime() > oneMinuteAgo,
      );
      if (recentBids.length >= current.settings.bidRateLimitPerMinute) {
        return { ok: false, error: "Too many bids in a short time. Wait a minute." };
      }
      if (auction.bids.some((bid) => bid.bidderId === activeUser.id && bid.amount === amount)) {
        return { ok: false, error: "You already placed that exact bid." };
      }
      const next = clone(current);
      const target = next.auctions.find((item) => item.id === auctionId)!;
      const previousLeader = target.highestBidderId;
      const existingAlias = target.bids.find((bid) => bid.bidderId === activeUser.id)?.alias;
      const used = new Set(target.bids.map((bid) => bid.alias));
      let alias = existingAlias;
      if (!alias) {
        let number = 1000 + Math.floor(Math.random() * 9000);
        while (used.has(`Anonymous Bidder #${number}`)) number = 1000 + Math.floor(Math.random() * 9000);
        alias = `Anonymous Bidder #${number}`;
      }
      const now = Date.now();
      const endsAt = new Date(target.endsAt).getTime();
      const remaining = endsAt - now;
      let extended = false;
      if (remaining <= next.settings.auctionAntiSnipeTriggerSeconds * 1000) {
        const newEnd = now + next.settings.auctionAntiSnipeSeconds * 1000;
        if (newEnd > endsAt) {
          target.endsAt = new Date(newEnd).toISOString();
          extended = true;
        }
      }
      target.bids.unshift({
        id: uid("b"),
        auctionId,
        bidderId: activeUser.id,
        amount,
        alias,
        createdAt: nowIso(),
      });
      target.currentBid = amount;
      target.highestBidderId = activeUser.id;
      target.bidCount = target.bids.length;
      target.extended = target.extended || extended;
      if (previousLeader && previousLeader !== activeUser.id) {
        pushNotification(
          next,
          previousLeader,
          "outbid",
          "You were outbid",
          `A higher bid came in for ${product.title}. Bid again to stay in.`,
          `#/auction/${auctionId}`,
        );
      }
      pushNotification(
        next,
        target.sellerId,
        "new_bid",
        "New bid on your auction",
        `${product.title} received a new anonymous bid.`,
        "#/seller?tab=auctions",
      );
      commit(next);
      return { ok: true, amount, extended };
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
      if (!/^\d{6}$/.test(address.pincode.trim())) {
        return { ok: false, error: "Enter a 6-digit pincode." };
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
        Math.round((product.askingPrice * next.settings.auctionStartPct) / 100 / 100) * 100,
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
          Math.round((product.askingPrice * next.settings.auctionStartPct) / 100 / 100) * 100,
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
    (settlementId: string) => {
      const next = clone(dbRef.current);
      const settlement = next.settlements.find((item) => item.id === settlementId);
      if (!settlement) return;
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

  const value: StoreValue = {
    db,
    user,
    cart,
    cartCount,
    cartSubtotal,
    favorites,
    notifications,
    unreadCount,
    login,
    register,
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
    updateProfile,
    approveProduct,
    rejectProduct,
    setUserBlocked,
    updateSettings,
    generateAuctions,
    scheduleAuction,
    startAuctionNow,
    endAuctionNow,
    cancelAuction,
    markSettlementPaid,
    resolveReport,
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
