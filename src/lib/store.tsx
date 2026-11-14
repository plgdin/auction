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
import { PRODUCT_IMAGE_BUCKET, onlinePaymentsEnabled, supabase } from "./supabase";
import { toast } from "./toast";
import type {
  Address,
  Auction,
  AuctionFinancial,
  Bid,
  CartLine,
  Database,
  Notification,
  Offer,
  Order,
  OrderItem,
  PlatformSettings,
  Product,
  Report,
  Review,
  Settlement,
  Shipment,
  User,
} from "./types";

/** Shapes returned by PostgREST. Kept loose because the schema is migrated separately. */
type Row = Record<string, any>;

const CONDITION_TO_UI: Record<string, Product["condition"]> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

const UI_TO_CONDITION: Record<Product["condition"], string> = {
  New: "new",
  "Like new": "like_new",
  Good: "good",
  Fair: "fair",
};

const CATEGORY_NAMES = [
  "Clothing",
  "Footwear",
  "Bags & accessories",
  "Electronics",
  "Mobile & tablets",
  "Computers & gaming",
  "Home & living",
  "Furniture",
  "Kitchen & dining",
  "Books & media",
  "Sports & outdoors",
  "Toys & games",
  "Beauty & care",
  "Art & collectibles",
  "Music & instruments",
  "Other",
] as const;

const DEFAULT_SETTINGS: PlatformSettings = {
  auctionEngineEnabled: true,
  auctionDailyCount: 4,
  auctionStartPct: 50,
  auctionDurationMinutes: 45,
  auctionMinIncrement: 5000,
  auctionAntiSnipeSeconds: 120,
  auctionAntiSnipeTriggerSeconds: 120,
  auctionPaymentDeadlineHours: 1,
  auctionBudget: 5000000,
  offerValidityHours: 48,
  offerCheckoutHours: 24,
  sellerAutoApprove: true,
  shippingFee: 4900,
  freeShippingThreshold: 199900,
  platformCommissionPct: 5,
  bidRateLimitPerMinute: 20,
  serviceablePrefixes: ["695"],
};

const SETTINGS_TO_DB: Record<keyof PlatformSettings, string> = {
  auctionEngineEnabled: "auction_engine_enabled",
  auctionDailyCount: "auction_daily_count",
  auctionStartPct: "auction_start_pct",
  auctionDurationMinutes: "auction_duration_minutes",
  auctionMinIncrement: "auction_min_increment_paise",
  auctionAntiSnipeSeconds: "auction_anti_snipe_seconds",
  auctionAntiSnipeTriggerSeconds: "auction_anti_snipe_trigger_seconds",
  auctionPaymentDeadlineHours: "auction_payment_deadline_hours",
  auctionBudget: "auction_budget_paise",
  offerValidityHours: "offer_validity_hours",
  offerCheckoutHours: "offer_checkout_hours",
  sellerAutoApprove: "seller_auto_approve",
  shippingFee: "shipping_fee_paise",
  freeShippingThreshold: "free_shipping_threshold_paise",
  platformCommissionPct: "platform_commission_pct",
  bidRateLimitPerMinute: "bid_rate_limit_per_minute",
  serviceablePrefixes: "serviceable_pincode_prefixes",
};

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
  const commission = Math.floor(((winningBid - askingPrice) * commissionPct) / 100);
  return {
    sellerPayout: winningBid - commission,
    platformSubsidy: 0,
    platformCommission: commission,
  };
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
type RegisterResult = ActionResult & { needsConfirmation?: boolean };

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
  loading: boolean;
  onlinePaymentsEnabled: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<ActionResult>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    asSeller: boolean;
  }) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  switchAccount: (userId: string) => void;
  resetDemo: () => void;
  addToCart: (productId: string, quantity?: number) => Promise<ActionResult>;
  removeFromCart: (productId: string) => Promise<void>;
  setCartQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleFavorite: (productId: string) => Promise<void>;
  makeOffer: (productId: string, amount: number, message?: string) => Promise<ActionResult>;
  respondToOffer: (offerId: string, accept: boolean) => Promise<ActionResult>;
  cancelOffer: (offerId: string) => Promise<ActionResult>;
  createOrders: (input: {
    addressId: string;
    productId?: string;
    offerId?: string;
    quantity?: number;
    paymentMethod?: "upi" | "card" | "cod";
  }) => Promise<{ ok: true; orderIds: string[] } | { ok: false; error: string }>;
  payOrders: (orderIds: string[]) => Promise<ActionResult>;
  cancelOrder: (orderId: string) => Promise<ActionResult>;
  acceptOrder: (orderId: string) => Promise<ActionResult>;
  openDispute: (orderId: string, reason: string, description: string, photos?: string[]) => Promise<ActionResult>;
  setProxyBid: (auctionId: string, maxAmount: number) => Promise<ActionResult>;
  bookCourierPickup: (orderId: string) => Promise<ActionResult>;
  requestReturn: (orderId: string) => Promise<ActionResult>;
  addReview: (orderId: string, rating: number, comment: string) => Promise<ActionResult>;
  advanceShipment: (
    orderId: string,
    status: NonNullable<Order["shipment"]>["status"],
    detail?: { provider?: string; awb?: string; trackingUrl?: string; note?: string },
  ) => Promise<ActionResult>;
  confirmCodPayment: (orderId: string) => Promise<ActionResult>;
  createListing: (
    input: ListingInput,
  ) => Promise<{ ok: true; productId: string } | { ok: false; error: string }>;
  updateListing: (
    productId: string,
    patch: Partial<ListingInput>,
  ) => Promise<ActionResult>;
  removeListing: (productId: string) => Promise<ActionResult>;
  toggleListingAvailability: (productId: string) => Promise<ActionResult>;
  reportProduct: (productId: string, reason: string, details?: string) => Promise<ActionResult>;
  placeBid: (auctionId: string, amount: number) => Promise<PlaceBidResult>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  saveAddress: (address: Omit<Address, "id"> & { id?: string }) => Promise<ActionResult>;
  removeAddress: (addressId: string) => Promise<void>;
  updateProfile: (patch: {
    name?: string;
    phone?: string;
    bio?: string;
    location?: string;
    auctionConsent?: boolean;
  }) => Promise<ActionResult>;
  becomeSeller: (displayName?: string) => Promise<ActionResult>;
  approveProduct: (productId: string) => Promise<ActionResult>;
  rejectProduct: (productId: string, reason: string) => Promise<ActionResult>;
  setUserBlocked: (userId: string, blocked: boolean) => Promise<ActionResult>;
  updateSettings: (patch: Partial<PlatformSettings>) => Promise<ActionResult>;
  generateAuctions: () => Promise<ActionResult>;
  scheduleAuction: (
    productId: string,
    startsAt: string,
    durationMinutes?: number,
  ) => Promise<ActionResult>;
  startAuctionNow: (auctionId: string) => Promise<void>;
  endAuctionNow: (auctionId: string) => Promise<void>;
  cancelAuction: (auctionId: string, reason: string) => Promise<void>;
  markSettlementPaid: (settlementId: string) => Promise<ActionResult>;
  resolveReport: (reportId: string, status: Report["status"]) => Promise<ActionResult>;
}

const StoreContext = createContext<StoreValue | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function messageOf(error: unknown): string {
  if (!error) return "Something went wrong.";
  if (typeof error === "string") return error;
  const candidate = error as { message?: string; details?: string; hint?: string; error_description?: string };
  return (
    candidate.message ||
    candidate.error_description ||
    candidate.details ||
    candidate.hint ||
    "Something went wrong."
  );
}

function mapProduct(row: Row): Product {
  const category = (CATEGORY_NAMES as readonly string[]).includes(row.category)
    ? (row.category as Product["category"])
    : "Other";
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name ?? "Seller",
    title: row.title,
    description: row.description ?? "",
    brand: row.brand ?? undefined,
    condition: CONDITION_TO_UI[row.condition] ?? "Good",
    category,
    askingPrice: row.asking_price ?? 0,
    images: row.images ?? [],
    size: row.size ?? undefined,
    quantity: row.quantity ?? 1,
    isUnique: Boolean(row.is_unique),
    location: row.location ?? "",
    shippingFee: row.shipping_fee ?? 0,
    status: row.status,
    allowOffers: Boolean(row.allow_offers),
    auctionConsent: Boolean(row.auction_consent),
    createdAt: row.created_at,
    views: row.views ?? 0,
    tag: row.tag ?? undefined,
    color: row.color ?? "#e8e6df",
    measurements: row.measurements ?? {},
    flaws: row.flaws ?? [],
    hasFlaws: Boolean(row.has_flaws),
    gender: row.gender ?? undefined,
    fit: row.fit ?? undefined,
    countryOfOrigin: row.country_of_origin ?? undefined,
    weightGrams: row.weight_grams ?? undefined,
    moderationNote: row.moderation_note ?? undefined,
    rejectionReason: row.moderation_note ?? undefined,
  };
}

function mapOffer(row: Row): Offer {
  return {
    id: row.id,
    productId: row.product_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amount: row.amount_paise,
    message: row.message ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? undefined,
    expiresAt: row.expires_at,
    checkoutExpiresAt: row.checkout_expires_at ?? undefined,
  };
}

function mapAddress(row: Row): Address {
  return {
    id: row.id,
    label: row.label ?? "Home",
    name: row.recipient_name ?? row.name ?? "",
    phone: row.phone ?? "",
    line1: row.line1 ?? "",
    line2: row.line2 ?? undefined,
    city: row.city ?? "",
    state: row.state ?? "",
    pincode: row.pincode ?? "",
    isDefault: Boolean(row.is_default),
  };
}

function mapOrderItem(item: Row, orderSellerId: string, sellerName: string): OrderItem {
  return {
    id: item.id,
    productId: item.product_id ?? "",
    title: item.title_snapshot,
    image: item.image_snapshot ?? "",
    price: item.price_paise,
    quantity: item.quantity,
    sellerId: orderSellerId,
    sellerName,
  };
}

function mapShipment(row: Row | null | undefined): Shipment | undefined {
  if (!row) return undefined;
  const events = (row.shipment_events ?? [])
    .slice()
    .sort((a: Row, b: Row) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((event: Row) => ({ status: event.status, at: event.created_at, note: event.note ?? "" }));
  return {
    status: row.status,
    provider: row.provider ?? undefined,
    awb: row.awb ?? undefined,
    trackingUrl: row.tracking_url ?? undefined,
    events,
  };
}

function mapOrder(row: Row, sellerNames: Map<string, string>): Order {
  const shipmentRow = Array.isArray(row.shipments) ? row.shipments[0] : row.shipments;
  const addressRow = row.shipping_address ?? {};
  return {
    id: row.id,
    number: row.order_number,
    checkoutGroupId: row.checkout_group_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    items: (row.order_items ?? []).map((item: Row) =>
      mapOrderItem(item, row.seller_id, sellerNames.get(row.seller_id) ?? "Seller"),
    ),
    subtotal: row.subtotal_paise,
    shipping: row.shipping_paise,
    total: row.total_paise,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method ?? undefined,
    source: row.source,
    offerId: row.offer_id ?? undefined,
    auctionId: row.auction_id ?? undefined,
    address: mapAddress({ ...addressRow, id: addressRow.id ?? row.id }),
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
    paymentDeadline: row.payment_deadline ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    shipment: mapShipment(shipmentRow),
  };
}

function mapNotification(row: Row): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body ?? "",
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined,
    href: row.data?.href ?? undefined,
  };
}

function mapSettlement(row: Row): Settlement {
  return {
    id: row.id,
    sellerId: row.seller_id,
    orderId: row.order_id ?? undefined,
    auctionId: row.auction_id ?? undefined,
    source: row.source,
    askingPrice: row.asking_price_paise,
    winningBid: row.winning_bid_paise ?? undefined,
    sellerPayout: row.seller_payout_paise,
    platformSubsidy: row.platform_subsidy_paise ?? 0,
    platformCommission: row.platform_commission_paise ?? 0,
    paymentFee: row.payment_fee_paise ?? 0,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
  };
}

function mapReport(row: Row): Report {
  return {
    id: row.id,
    productId: row.product_id,
    reporterId: row.reporter_id ?? "",
    reason: row.reason,
    details: row.details ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapReview(row: Row): Review {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id ?? "",
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    rating: row.rating,
    comment: row.comment ?? undefined,
    createdAt: row.created_at,
  };
}

function mapSettings(rows: Row[]): PlatformSettings {
  const next = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const entry = Object.entries(SETTINGS_TO_DB).find(([, dbKey]) => dbKey === row.key);
    if (!entry) continue;
    (next as Record<string, unknown>)[entry[0]] = row.value;
  }
  return next;
}

function mapSellerUser(row: Row): User {
  return {
    id: row.id,
    name: row.full_name || "Seller",
    email: "",
    password: "",
    role: "seller",
    isSeller: true,
    avatar: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    location: row.location ?? undefined,
    addresses: [],
    joinedAt: row.created_at,
  };
}

function mapProfileUser(
  row: Row,
  seller: Row | undefined,
  selfId: string | null,
  addresses: Address[],
): User {
  const isSelf = row.id === selfId;
  return {
    id: row.id,
    name: row.full_name || "Member",
    email: row.email ?? "",
    password: "",
    role: row.role === "admin" ? "admin" : row.is_seller ? "seller" : "buyer",
    isSeller: Boolean(row.is_seller),
    phone: row.phone ?? undefined,
    avatar: row.avatar_url ?? undefined,
    bio: seller?.bio ?? undefined,
    location: seller?.location ?? undefined,
    auctionConsent: undefined,
    blocked: Boolean(row.is_blocked),
    addresses: isSelf ? addresses : [],
    joinedAt: row.created_at,
  };
}

async function uploadListingImages(uid: string, images: string[]): Promise<string[]> {
  const uploaded: string[] = [];
  for (const image of images) {
    if (!image.startsWith("data:")) {
      uploaded.push(image);
      continue;
    }
    const blob = await (await fetch(image)).blob();
    const extension = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${uid}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
    uploaded.push(data.publicUrl);
  }
  return uploaded;
}

function loadRazorpay(): Promise<any> {
  return new Promise((resolve, reject) => {
    const existing = (window as any).Razorpay;
    if (existing) {
      resolve(existing);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve((window as any).Razorpay);
    script.onerror = () => reject(new Error("Could not load the payment window."));
    document.body.appendChild(script);
  });
}

function openRazorpay(key: string, payload: Row, orderId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    loadRazorpay()
      .then((Razorpay) => {
        const checkout = new Razorpay({
          key,
          order_id: payload.razorpayOrderId,
          amount: payload.amountPaise,
          currency: "INR",
          name: "lelam.co",
          description: `Order ${payload.orderNumber ?? orderId}`,
          handler: async (response: Row) => {
            try {
              const { error } = await supabase.functions.invoke("razorpay-verify-payment", {
                body: { orderId, ...response },
              });
              if (error) throw error;
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
        });
        checkout.open();
      })
      .catch(reject);
  });
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [accountRows, setAccountRows] = useState<Row[]>([]);
  const [sellerRows, setSellerRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [auditLogs, setAuditLogs] = useState<Database["auditLogs"]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sessionRef = useRef<string | null>(null);
  const refreshTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user.id ?? null;
      sessionRef.current = uid;
      setSessionUserId(uid);

      const [productResult, sellerResult, reviewResult, settingResult, auctionResult, bidResult] =
        await Promise.all([
          supabase.from("public_products").select("*").order("created_at", { ascending: false }),
          supabase.from("public_sellers").select("*"),
          supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(500),
          supabase.from("platform_settings").select("key,value"),
          supabase.from("auctions").select("*").order("created_at", { ascending: false }),
          supabase.from("public_bids").select("*").order("created_at", { ascending: true }),
        ]);

      if (productResult.error) console.warn("[products]", productResult.error.message);
      if (sellerResult.error) console.warn("[sellers]", sellerResult.error.message);
      if (reviewResult.error) console.warn("[reviews]", reviewResult.error.message);
      if (settingResult.error) console.warn("[settings]", settingResult.error.message);

      const productRows: Row[] = productResult.data ?? [];
      const sellerData: Row[] = sellerResult.data ?? [];
      const reviewRows: Row[] = reviewResult.data ?? [];

      setProducts(productRows.map(mapProduct));
      setSellerRows(sellerData);
      setReviews(reviewRows.map(mapReview));
      setSettings(mapSettings((settingResult.data ?? []) as Row[]));

      const bidsByAuction = new Map<string, Bid[]>();
      for (const row of (bidResult.data ?? []) as Row[]) {
        const bid: Bid = {
          id: row.id,
          auctionId: row.auction_id,
          bidderId: "",
          amount: row.amount_paise,
          alias: row.alias ?? `Bidder #${row.anonymous_number}`,
          createdAt: row.created_at,
        };
        if (!bidsByAuction.has(row.auction_id)) bidsByAuction.set(row.auction_id, []);
        bidsByAuction.get(row.auction_id)!.push(bid);
      }
      setAuctions(
        ((auctionResult.data ?? []) as Row[]).map((row) => ({
          id: row.id,
          productId: row.product_id,
          sellerId: row.seller_id,
          status: row.status,
          startingPrice: row.starting_price_paise,
          askingPrice: row.asking_price_paise,
          currentBid: row.current_bid_paise ?? undefined,
          highestBidderId: row.highest_bidder_id ?? undefined,
          bidCount: row.bid_count ?? 0,
          minIncrement: row.min_increment_paise ?? 5000,
          antiSnipeSeconds: row.anti_snipe_seconds ?? 120,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          originalEndsAt: row.original_ends_at,
          bids: bidsByAuction.get(row.id) ?? [],
          createdAt: row.created_at,
          cancelledReason: row.cancelled_reason ?? undefined,
          extended: row.ends_at !== row.original_ends_at,
        })),
      );

      if (!uid) {
        setAccountRows([]);
        setOffers([]);
        setOrders([]);
        setNotifications([]);
        setSettlements([]);
        setReports([]);
        setAuditLogs([]);
        setAddresses([]);
        setCartLines([]);
        setFavorites([]);
        return;
      }

      const [profileResult, addressResult, cartResult, savedResult, offerResult, orderResult] =
        await Promise.all([
          supabase.from("profiles").select("*"),
          supabase.from("addresses").select("*").order("is_default", { ascending: false }),
          supabase
            .from("carts")
            .select("id, cart_items(product_id, quantity)")
            .eq("user_id", uid)
            .maybeSingle(),
          supabase.from("saved_products").select("product_id"),
          supabase.from("offers").select("*").order("created_at", { ascending: false }),
          supabase
            .from("orders")
            .select("*, order_items(*), shipments(*, shipment_events(*))")
            .order("created_at", { ascending: false }),
        ]);

      const [notifResult, settlementResult, reportResult, auditResult, financialResult, ownBidResult] =
        await Promise.all([
          supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200),
          supabase.from("seller_settlements").select("*").order("created_at", { ascending: false }),
          supabase.from("product_reports").select("*").order("created_at", { ascending: false }),
          supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
          supabase.from("auction_financial_records").select("*"),
          supabase.from("bids").select("id,bidder_id"),
        ]);

      if (profileResult.error) console.warn("[profiles]", profileResult.error.message);
      if (addressResult.error) console.warn("[addresses]", addressResult.error.message);
      if (cartResult.error) console.warn("[cart]", cartResult.error.message);
      if (savedResult.error) console.warn("[favorites]", savedResult.error.message);
      if (offerResult.error) console.warn("[offers]", offerResult.error.message);
      if (orderResult.error) console.warn("[orders]", orderResult.error.message);

      setAccountRows((profileResult.data ?? []) as Row[]);
      setAddresses(((addressResult.data ?? []) as Row[]).map(mapAddress));

      const cartRow = cartResult.data as Row | null;
      setCartLines(
        ((cartRow?.cart_items ?? []) as Row[]).map((item) => ({
          productId: item.product_id,
          quantity: item.quantity,
        })),
      );
      setFavorites(((savedResult.data ?? []) as Row[]).map((row) => row.product_id));

      setOffers(((offerResult.data ?? []) as Row[]).map(mapOffer));

      const sellerNames = new Map<string, string>();
      for (const seller of sellerData) sellerNames.set(seller.id, seller.full_name);
      for (const row of (profileResult.data ?? []) as Row[]) {
        if (row.full_name) sellerNames.set(row.id, row.full_name);
      }
      setOrders(
        ((orderResult.data ?? []) as Row[]).map((row) => mapOrder(row, sellerNames)),
      );

      setNotifications(((notifResult.data ?? []) as Row[]).map(mapNotification));
      setSettlements(((settlementResult.data ?? []) as Row[]).map(mapSettlement));
      setReports(((reportResult.data ?? []) as Row[]).map(mapReport));
      setAuditLogs(
        ((auditResult.data ?? []) as Row[]).map((row) => ({
          id: row.id,
          actorId: row.actor_id ?? "",
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id ?? undefined,
          detail: row.metadata ? JSON.stringify(row.metadata) : undefined,
          createdAt: row.created_at,
        })),
      );

      const ownBidMap = new Map<string, string>();
      for (const row of (ownBidResult.data ?? []) as Row[]) {
        ownBidMap.set(row.id, row.bidder_id);
      }
      const finByAuction = new Map<string, AuctionFinancial>();
      for (const row of (financialResult.data ?? []) as Row[]) {
        finByAuction.set(row.auction_id, {
          askingPrice: row.asking_price_paise,
          startingPrice: row.starting_price_paise,
          winningBid: row.winning_bid_paise ?? undefined,
          sellerPayout: row.seller_payout_paise,
          platformSubsidy: row.platform_subsidy_paise ?? 0,
          platformCommission: row.platform_commission_paise ?? 0,
          outcome: row.outcome,
        });
      }
      setAuctions((previous) =>
        previous.map((auction) => ({
          ...auction,
          bids: auction.bids.map((bid) => ({
            ...bid,
            bidderId: ownBidMap.get(bid.id) ?? bid.bidderId,
          })),
          financial: finByAuction.get(auction.id) ?? auction.financial,
          winnerId:
            auction.status === "completed" ? auction.highestBidderId : auction.winnerId,
        })),
      );
    } catch (error) {
      console.warn("[supabase] refresh failed", messageOf(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh();

    // Never leave the shell on the boot screen if the backend is unreachable.
    // Slow requests can still finish later and hydrate the store.
    const bootTimer = window.setTimeout(() => setLoading(false), 8_000);

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        if (active) void refresh();
      }, 0);
    });

    return () => {
      active = false;
      window.clearTimeout(bootTimer);
      subscription.subscription.unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    const schedule = () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        refreshTimer.current = null;
        void refresh();
      }, 600);
    };

    const channel = supabase
      .channel("lelam-marketplace")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "offers" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, schedule)
      .subscribe();

    return () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const user = useMemo(() => {
    if (!sessionUserId) return null;
    const account = accountRows.find((row) => row.id === sessionUserId);
    if (!account) return null;
    const seller = sellerRows.find((row) => row.id === sessionUserId);
    return mapProfileUser(account, seller, sessionUserId, addresses);
  }, [accountRows, sellerRows, sessionUserId, addresses]);

  const users = useMemo(() => {
    const list = accountRows.map((row) =>
      mapProfileUser(
        row,
        sellerRows.find((seller) => seller.id === row.id),
        sessionUserId,
        addresses,
      ),
    );
    for (const seller of sellerRows) {
      if (!list.some((entry) => entry.id === seller.id)) {
        list.push(mapSellerUser(seller));
      }
    }
    return list;
  }, [accountRows, sellerRows, sessionUserId, addresses]);

  const key = sessionUserId ?? "guest";

  const cart = useMemo(() => {
    return cartLines
      .map((line) => {
        const product = products.find((item) => item.id === line.productId);
        return product ? { line, product } : null;
      })
      .filter((entry): entry is { line: CartLine; product: Product } => Boolean(entry));
  }, [cartLines, products]);

  const cartCount = cart.reduce((total, entry) => total + entry.line.quantity, 0);
  const cartSubtotal = cart.reduce(
    (total, entry) => total + entry.product.askingPrice * entry.line.quantity,
    0,
  );

  const db: Database = useMemo(
    () => ({
      version: 1,
      users,
      products,
      offers,
      orders,
      auctions,
      notifications,
      settlements,
      reports,
      reviews,
      auditLogs,
      settings,
      sessionUserId,
      carts: { [key]: cartLines },
      favorites: { [key]: favorites },
    }),
    [
      users,
      products,
      offers,
      orders,
      auctions,
      notifications,
      settlements,
      reports,
      reviews,
      auditLogs,
      settings,
      sessionUserId,
      key,
      cartLines,
      favorites,
    ],
  );

  const needUser = useCallback((): string => {
    const uid = sessionRef.current;
    if (!uid) throw new Error("Sign in to continue.");
    return uid;
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { ok: false, error: messageOf(error) };

        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (uid) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_blocked")
            .eq("id", uid)
            .maybeSingle();
          if (profile?.is_blocked) {
            await supabase.auth.signOut();
            await refresh();
            return { ok: false, error: "This account is blocked." };
          }
        }

        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      asSeller: boolean;
    }): Promise<RegisterResult> => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: input.email.trim(),
          password: input.password,
          options: {
            data: {
              full_name: input.name.trim(),
              as_seller: input.asSeller,
            },
          },
        });
        if (error) return { ok: false, error: messageOf(error) };
        if (!data.session) {
          return { ok: true, needsConfirmation: true };
        }
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    sessionRef.current = null;
    setSessionUserId(null);
    await refresh();
  }, [refresh]);

  const addToCart = useCallback(
    async (productId: string, quantity = 1): Promise<ActionResult> => {
      try {
        const uid = needUser();
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("id, status, quantity, seller_id")
          .eq("id", productId)
          .maybeSingle();
        if (productError) return { ok: false, error: messageOf(productError) };
        if (!product) return { ok: false, error: "Listing not found." };
        if (product.status !== "active") {
          return { ok: false, error: "This item is no longer available." };
        }
        if (product.seller_id === uid) {
          return { ok: false, error: "You cannot buy your own listing." };
        }

        const { data: cartRow, error: cartError } = await supabase
          .from("carts")
          .upsert({ user_id: uid }, { onConflict: "user_id" })
          .select("id")
          .single();
        if (cartError) return { ok: false, error: messageOf(cartError) };

        const existing = cartLines.find((line) => line.productId === productId);
        const nextQuantity = Math.max(
          1,
          Math.min(existing ? existing.quantity + quantity : quantity, product.quantity),
        );

        const { error } = await supabase.from("cart_items").upsert(
          { cart_id: cartRow.id, product_id: productId, quantity: nextQuantity },
          { onConflict: "cart_id,product_id" },
        );
        if (error) return { ok: false, error: messageOf(error) };

        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [cartLines, needUser, refresh],
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      const uid = sessionRef.current;
      if (!uid) return;
      const { data: cartRow } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      if (!cartRow) return;
      await supabase
        .from("cart_items")
        .delete()
        .eq("cart_id", cartRow.id)
        .eq("product_id", productId);
      await refresh();
    },
    [refresh],
  );

  const setCartQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const uid = sessionRef.current;
      if (!uid) return;
      const { data: cartRow } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      if (!cartRow) return;

      if (quantity < 1) {
        await supabase
          .from("cart_items")
          .delete()
          .eq("cart_id", cartRow.id)
          .eq("product_id", productId);
      } else {
        await supabase
          .from("cart_items")
          .update({ quantity })
          .eq("cart_id", cartRow.id)
          .eq("product_id", productId);
      }
      await refresh();
    },
    [refresh],
  );

  const clearCart = useCallback(async () => {
    const uid = sessionRef.current;
    if (!uid) return;
    const { data: cartRow } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", uid)
      .maybeSingle();
    if (!cartRow) return;
    await supabase.from("cart_items").delete().eq("cart_id", cartRow.id);
    await refresh();
  }, [refresh]);

  const toggleFavorite = useCallback(
    async (productId: string) => {
      const uid = sessionRef.current;
      if (!uid) return;
      const exists = favorites.includes(productId);
      if (exists) {
        await supabase
          .from("saved_products")
          .delete()
          .eq("user_id", uid)
          .eq("product_id", productId);
      } else {
        await supabase
          .from("saved_products")
          .insert({ user_id: uid, product_id: productId });
      }
      await refresh();
    },
    [favorites, refresh],
  );

  const makeOffer = useCallback(
    async (productId: string, amount: number, message?: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("make_offer", {
          p_product_id: productId,
          p_amount_paise: amount,
          p_message: message ?? null,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const respondToOffer = useCallback(
    async (offerId: string, accept: boolean): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("respond_to_offer", {
          p_offer_id: offerId,
          p_accept: accept,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const cancelOffer = useCallback(
    async (offerId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("cancel_offer", { p_offer_id: offerId });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const createOrders = useCallback(
    async (input: {
      addressId: string;
      productId?: string;
      offerId?: string;
      quantity?: number;
      paymentMethod?: "upi" | "card" | "cod";
    }): Promise<{ ok: true; orderIds: string[] } | { ok: false; error: string }> => {
      try {
        needUser();
        const { data, error } = await supabase.rpc("place_order", {
          p_address_id: input.addressId,
          p_product_id: input.productId ?? null,
          p_offer_id: input.offerId ?? null,
          p_quantity: input.quantity ?? 1,
          p_payment_method: input.paymentMethod ?? "cod",
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true, orderIds: (data?.orderIds ?? []) as string[] };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [needUser, refresh],
  );

  const payOrders = useCallback(
    async (orderIds: string[]): Promise<ActionResult> => {
      if (!onlinePaymentsEnabled) {
        return {
          ok: false,
          error: "Online payments are not configured yet. Choose cash on delivery.",
        };

      }
      try {
        const key = import.meta.env.VITE_RAZORPAY_KEY_ID as string;
        for (const orderId of orderIds) {
          const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
            body: { orderId },
          });
          if (error) return { ok: false, error: messageOf(error) };
          await openRazorpay(key, data as Row, orderId);
        }
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const cancelOrder = useCallback(
    async (orderId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("cancel_order", {
          p_order_id: orderId,
          p_reason: null,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const acceptOrder = useCallback(
    async (orderId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("accept_order", { p_order_id: orderId });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const openDispute = useCallback(
    async (
      orderId: string,
      reason: string,
      description: string,
      photos: string[] = [],
    ): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("open_dispute", {
          p_order_id: orderId,
          p_reason: reason,
          p_description: description,
          p_photo_evidence: photos,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const setProxyBid = useCallback(
    async (auctionId: string, maxAmount: number): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("set_proxy_bid", {
          p_auction_id: auctionId,
          p_max_amount_paise: maxAmount,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const bookCourierPickup = useCallback(
    async (orderId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("book_courier_pickup", { p_order_id: orderId });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const requestReturn = useCallback(
    async (orderId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("request_return", {
          p_order_id: orderId,
          p_reason: null,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const addReview = useCallback(
    async (orderId: string, rating: number, comment: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("create_review", {
          p_order_id: orderId,
          p_rating: rating,
          p_comment: comment ?? null,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const advanceShipment = useCallback(
    async (
      orderId: string,
      status: NonNullable<Order["shipment"]>["status"],
      detail?: { provider?: string; awb?: string; trackingUrl?: string; note?: string },
    ): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("advance_shipment", {
          p_order_id: orderId,
          p_status: status,
          p_provider: detail?.provider ?? null,
          p_awb: detail?.awb ?? null,
          p_tracking_url: detail?.trackingUrl ?? null,
          p_note: detail?.note ?? null,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const confirmCodPayment = useCallback(
    async (orderId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("confirm_cod_payment", {
          p_order_id: orderId,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const createListing = useCallback(
    async (
      input: ListingInput,
    ): Promise<{ ok: true; productId: string } | { ok: false; error: string }> => {
      try {
        const uid = needUser();
        const images = await uploadListingImages(uid, input.images);
        const { data, error } = await supabase.rpc("save_listing", {
          p_payload: {
            title: input.title,
            description: input.description,
            brand: input.brand ?? null,
            condition: UI_TO_CONDITION[input.condition],
            category: input.category,
            asking_price_paise: input.askingPrice,
            size: input.size ?? null,
            quantity: input.quantity,
            location: input.location,
            shipping_fee_paise: input.shippingFee,
            allow_offers: input.allowOffers,
            auction_consent: input.auctionConsent,
          },
          p_images: images,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true, productId: String(data) };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }

    },
    [needUser, refresh],
  );

  const updateListing = useCallback(
    async (
      productId: string,
      patch: Partial<ListingInput>,
    ): Promise<ActionResult> => {
      try {
        const uid = needUser();
        const current = products.find((product) => product.id === productId);
        if (!current) return { ok: false, error: "Listing not found." };

        const merged: ListingInput = {
          title: patch.title ?? current.title,
          description: patch.description ?? current.description,
          brand: patch.brand ?? current.brand,
          condition: patch.condition ?? current.condition,
          category: patch.category ?? current.category,
          askingPrice: patch.askingPrice ?? current.askingPrice,
          images: patch.images ?? current.images,
          size: patch.size ?? current.size,
          quantity: patch.quantity ?? current.quantity,
          location: patch.location ?? current.location,
          shippingFee: patch.shippingFee ?? current.shippingFee,
          allowOffers: patch.allowOffers ?? current.allowOffers,
          auctionConsent: patch.auctionConsent ?? current.auctionConsent,
        };

        const images = await uploadListingImages(uid, merged.images);
        const { error } = await supabase.rpc("save_listing", {
          p_payload: {
            id: productId,
            title: merged.title,
            description: merged.description,
            brand: merged.brand ?? null,
            condition: UI_TO_CONDITION[merged.condition],
            category: merged.category,
            asking_price_paise: merged.askingPrice,
            size: merged.size ?? null,
            quantity: merged.quantity,
            location: merged.location,
            shipping_fee_paise: merged.shippingFee,
            allow_offers: merged.allowOffers,
            auction_consent: merged.auctionConsent,
          },
          p_images: images,
        });
        if (error) return { ok: false, error: messageOf(error) };

        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }

    },
    [needUser, products, refresh],
  );

  const removeListing = useCallback(
    async (productId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("remove_listing", { p_product_id: productId });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const toggleListingAvailability = useCallback(
    async (productId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("toggle_listing_availability", {
          p_product_id: productId,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const reportProduct = useCallback(
    async (productId: string, reason: string, details?: string): Promise<ActionResult> => {
      try {
        const uid = needUser();
        const { error } = await supabase.from("product_reports").insert({
          product_id: productId,
          reporter_id: uid,
          reason,
          details: details ?? null,
        });
        if (error) return { ok: false, error: messageOf(error) };
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [needUser],
  );

  const placeBid = useCallback(
    async (auctionId: string, amount: number): Promise<PlaceBidResult> => {
      try {
        needUser();
        const { data, error } = await supabase.rpc("place_bid", {
          p_auction_id: auctionId,
          p_amount_paise: amount,
        });
        if (error) return { ok: false, error: messageOf(error) };
        const row = Array.isArray(data) ? data[0] : data;
        await refresh();
        return {
          ok: true,
          amount: Number(row?.amount_paise ?? amount),
          extended: Boolean(row?.extended),
        };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [needUser, refresh],
  );

  const generateAuctions = useCallback(async (): Promise<ActionResult> => {
    try {
      needUser();
      const { error } = await supabase.rpc("generate_auctions");
      if (error) return { ok: false, error: messageOf(error) };
      await refresh();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: messageOf(error) };
    }
  }, [needUser, refresh]);

  const scheduleAuction = useCallback(
    async (productId: string, startsAt: string, durationMinutes?: number): Promise<ActionResult> => {
      try {
        needUser();
        const { error } = await supabase.rpc("schedule_auction", {
          p_product_id: productId,
          p_starts_at: startsAt,
          p_duration_minutes: durationMinutes ?? null,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [needUser, refresh],
  );

  const startAuctionNow = useCallback(
    async (auctionId: string) => {
      try {
        const { error } = await supabase.rpc("start_auction", { p_auction_id: auctionId });
        if (error) {
          toast(messageOf(error), "error");
          return;
        }
        await refresh();
      } catch (error) {
        toast(messageOf(error), "error");
      }
    },
    [refresh],
  );

  const endAuctionNow = useCallback(
    async (auctionId: string) => {
      try {
        const { error } = await supabase.rpc("end_auction", { p_auction_id: auctionId });
        if (error) {
          toast(messageOf(error), "error");
          return;
        }
        await refresh();
      } catch (error) {
        toast(messageOf(error), "error");
      }
    },
    [refresh],
  );

  const cancelAuction = useCallback(
    async (auctionId: string, reason: string) => {
      try {
        const { error } = await supabase.rpc("cancel_auction", {
          p_auction_id: auctionId,
          p_reason: reason,
        });
        if (error) {
          toast(messageOf(error), "error");
          return;
        }
        await refresh();
      } catch (error) {
        toast(messageOf(error), "error");
      }
    },
    [refresh],
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      const uid = sessionRef.current;
      if (!uid) return;
      setNotifications((previous) =>
        previous.map((item) => (item.id === id ? { ...item, readAt: nowIso() } : item)),
      );
      await supabase
        .from("notifications")
        .update({ read_at: nowIso() })
        .eq("id", id)
        .eq("user_id", uid);
    },
    [],
  );

  const markAllNotificationsRead = useCallback(async () => {
    const uid = sessionRef.current;
    if (!uid) return;
    setNotifications((previous) =>
      previous.map((item) => (item.readAt ? item : { ...item, readAt: nowIso() })),
    );
    await supabase
      .from("notifications")
      .update({ read_at: nowIso() })
      .eq("user_id", uid)
      .is("read_at", null);
  }, []);

  const saveAddress = useCallback(
    async (address: Omit<Address, "id"> & { id?: string }): Promise<ActionResult> => {
      try {
        const uid = needUser();
        if (address.isDefault) {
          await supabase
            .from("addresses")
            .update({ is_default: false })
            .eq("user_id", uid);
        }

        const payload = {
          user_id: uid,
          label: address.label,
          recipient_name: address.name,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2 ?? null,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          is_default: Boolean(address.isDefault),
        };

        const { error } = address.id
          ? await supabase.from("addresses").update(payload).eq("id", address.id)
          : await supabase.from("addresses").insert(payload);
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [needUser, refresh],
  );

  const removeAddress = useCallback(
    async (addressId: string) => {
      await supabase.from("addresses").delete().eq("id", addressId);
      await refresh();
    },
    [refresh],
  );

  const updateProfile = useCallback(
    async (patch: {
      name?: string;
      phone?: string;
      bio?: string;
      location?: string;
      auctionConsent?: boolean;
    }): Promise<ActionResult> => {
      try {
        const uid = needUser();
        const { error } = await supabase
          .from("profiles")
          .update({
            ...(patch.name !== undefined ? { full_name: patch.name } : {}),
            ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
          })
          .eq("id", uid);
        if (error) return { ok: false, error: messageOf(error) };

        const touchesSellerProfile =
          patch.bio !== undefined ||
          patch.location !== undefined ||
          patch.auctionConsent !== undefined;

        if (touchesSellerProfile) {
          // Never promote a buyer just because they edited a profile field.
          const { data: account } = await supabase
            .from("profiles")
            .select("is_seller")
            .eq("id", uid)
            .maybeSingle();

          if (account?.is_seller) {
            const { error: updateError } = await supabase
              .from("seller_profiles")
              .update({
                ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
                ...(patch.location !== undefined ? { location: patch.location } : {}),
                ...(patch.auctionConsent !== undefined
                  ? { auction_consent: patch.auctionConsent }
                  : {}),
              })
              .eq("user_id", uid);
            if (updateError) return { ok: false, error: messageOf(updateError) };
          }
        }

        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [needUser, refresh],
  );

  const becomeSeller = useCallback(
    async (displayName?: string): Promise<ActionResult> => {
      try {
        needUser();
        const { error } = await supabase.rpc("become_seller", {
          p_display_name: displayName ?? null,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [needUser, refresh],
  );

  const approveProduct = useCallback(
    async (productId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("admin_review_product", {
          p_product_id: productId,
          p_approve: true,
          p_reason: null,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const rejectProduct = useCallback(
    async (productId: string, reason: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("admin_review_product", {
          p_product_id: productId,
          p_approve: false,
          p_reason: reason,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const setUserBlocked = useCallback(
    async (userId: string, blocked: boolean): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("admin_set_user_blocked", {
          p_user_id: userId,
          p_blocked: blocked,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const updateSettings = useCallback(
    async (patch: Partial<PlatformSettings>): Promise<ActionResult> => {
      try {
        for (const [key, value] of Object.entries(patch)) {
          const dbKey = SETTINGS_TO_DB[key as keyof PlatformSettings];
          if (!dbKey) continue;
          const { error } = await supabase.rpc("admin_update_setting", {
            p_key: dbKey,
            p_value: value as never,
          });
          if (error) return { ok: false, error: messageOf(error) };
        }
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const markSettlementPaid = useCallback(
    async (settlementId: string): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("admin_mark_settlement_paid", {
          p_settlement_id: settlementId,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const resolveReport = useCallback(
    async (reportId: string, status: Report["status"]): Promise<ActionResult> => {
      try {
        const { error } = await supabase.rpc("admin_resolve_report", {
          p_report_id: reportId,
          p_status: status,
        });
        if (error) return { ok: false, error: messageOf(error) };
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      }
    },
    [refresh],
  );

  const value: StoreValue = {
    db,
    user,
    cart,
    cartCount,
    cartSubtotal,
    favorites,
    notifications,
    unreadCount: notifications.filter((item) => !item.readAt).length,
    loading,
    onlinePaymentsEnabled,
    refresh,
    login,
    register,
    logout,
    switchAccount: () => undefined,
    resetDemo: () => undefined,
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
    acceptOrder,
    openDispute,
    setProxyBid,
    bookCourierPickup,
    requestReturn,
    addReview,
    advanceShipment,
    confirmCodPayment,
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
    becomeSeller,
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
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
