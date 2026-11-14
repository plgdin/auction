export type Condition = "New" | "Like new" | "Good" | "Fair";
export type ProductStatus =
  | "draft"
  | "pending"
  | "active"
  | "reserved"
  | "sold"
  | "removed"
  | "rejected";
export type Category = string;

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "buyer" | "seller" | "admin";
  isSeller: boolean;
  phone?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  auctionConsent?: boolean;
  blocked?: boolean;
  addresses: Address[];
  joinedAt: string;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface Product {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  brand?: string;
  condition: Condition;
  category: Category;
  subcategory?: string;
  askingPrice: number;
  images: string[];
  size?: string;
  quantity: number;
  isUnique: boolean;
  location: string;
  shippingFee: number;
  status: ProductStatus;
  allowOffers: boolean;
  auctionConsent: boolean;
  createdAt: string;
  views: number;
  tag?: string;
  color: string;
  measurements?: Record<string, number>;
  flaws?: string[];
  hasFlaws?: boolean;
  gender?: string;
  fit?: string;
  countryOfOrigin?: string;
  weightGrams?: number;
  moderationNote?: string;
  rejectionReason?: string;
}

export type OfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted"
  | "cancelled";

export interface Offer {
  id: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  message?: string;
  status: OfferStatus;
  createdAt: string;
  respondedAt?: string;
  expiresAt: string;
  checkoutExpiresAt?: string;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  alias: string;
  createdAt: string;
}

export type AuctionStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface Auction {
  id: string;
  productId: string;
  sellerId: string;
  status: AuctionStatus;
  startingPrice: number;
  askingPrice: number;
  currentBid?: number;
  highestBidderId?: string;
  bidCount: number;
  minIncrement: number;
  antiSnipeSeconds: number;
  startsAt: string;
  endsAt: string;
  originalEndsAt: string;
  bids: Bid[];
  createdAt: string;
  cancelledReason?: string;
  extended?: boolean;
  winnerId?: string;
  orderId?: string;
  financial?: AuctionFinancial;
}

export interface AuctionFinancial {
  askingPrice: number;
  startingPrice: number;
  winningBid: number;
  sellerPayout: number;
  platformSubsidy: number;
  platformCommission: number;
  outcome: "sold" | "unpaid" | "cancelled" | "no_bids";
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "awaiting_pickup"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"
  | "expired";

export type PaymentStatus = "pending" | "paid" | "refunded" | "failed" | "expired";

export interface OrderItem {
  id: string;
  productId: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
  sellerId: string;
  sellerName: string;
}

export interface Shipment {
  status:
    | "pending_pickup"
    | "pickup_scheduled"
    | "picked_up"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "failed"
    | "returned";
  provider?: string;
  awb?: string;
  trackingUrl?: string;
  events: { status: string; at: string; note: string }[];
}

export interface Order {
  id: string;
  number: string;
  checkoutGroupId: string;
  buyerId: string;
  sellerId: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: "upi" | "card" | "cod";
  source: "buy_now" | "cart" | "offer" | "auction";
  offerId?: string;
  auctionId?: string;
  address: Address;
  createdAt: string;
  paidAt?: string;
  paymentDeadline?: string;
  cancelledAt?: string;
  shipment?: Shipment;
}

export interface Settlement {
  id: string;
  sellerId: string;
  orderId?: string;
  auctionId?: string;
  source: "marketplace" | "offer" | "auction";
  askingPrice: number;
  winningBid?: number;
  sellerPayout: number;
  platformSubsidy: number;
  platformCommission: number;
  paymentFee: number;
  status: "pending" | "approved" | "paid" | "on_hold";
  createdAt: string;
  paidAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string;
  href?: string;
}

export interface Report {
  id: string;
  productId: string;
  reporterId: string;
  reason: string;
  details?: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
}

export interface Review {
  id: string;
  orderId: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  detail?: string;
  createdAt: string;
}

export interface PlatformSettings {
  auctionEngineEnabled: boolean;
  auctionDailyCount: number;
  auctionStartPct: number;
  auctionDurationMinutes: number;
  auctionMinIncrement: number;
  auctionAntiSnipeSeconds: number;
  auctionAntiSnipeTriggerSeconds: number;
  auctionPaymentDeadlineHours: number;
  auctionBudget: number;
  offerValidityHours: number;
  offerCheckoutHours: number;
  sellerAutoApprove: boolean;
  shippingFee: number;
  freeShippingThreshold: number;
  platformCommissionPct: number;
  bidRateLimitPerMinute: number;
  serviceablePrefixes: string[];
}

export interface OrderDispute {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
  description: string;
  photoEvidence: string[];
  unboxingVideoUrl?: string;
  status: "opened" | "seller_response" | "under_review" | "approved_refund" | "approved_return" | "rejected";
  sellerResponse?: string;
  adminNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface SecondChanceOffer {
  id: string;
  auctionId: string;
  productId: string;
  sellerId: string;
  buyerId: string;
  amountPaise: number;
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface Database {
  version: number;
  users: User[];
  products: Product[];
  offers: Offer[];
  orders: Order[];
  auctions: Auction[];
  notifications: Notification[];
  settlements: Settlement[];
  reports: Report[];
  reviews: Review[];
  auditLogs: AuditLog[];
  settings: PlatformSettings;
  sessionUserId: string | null;
  carts: Record<string, CartLine[]>;
  favorites: Record<string, string[]>;
  disputes?: OrderDispute[];
  secondChanceOffers?: SecondChanceOffer[];
}
