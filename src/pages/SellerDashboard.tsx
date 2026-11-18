import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gavel,
  Package,
  Plus,
  Store,
  Tag,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, navigate } from "../components/Link";
import { Countdown } from "../components/Countdown";
import { EmptyState, ScheduleDateTime, SelectMenu, StatusPill, Tabs } from "../components/Ui";
import { formatDate, formatMoney, timeAgo } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Order, Product } from "../lib/types";

const shipmentOptions: { value: NonNullable<Order["shipment"]>["status"]; label: string }[] = [
  { value: "pickup_scheduled", label: "Pickup scheduled" },
  { value: "picked_up", label: "Picked up" },
  { value: "in_transit", label: "In transit" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Delivery failed" },
  { value: "returned", label: "Returned" },
];

const shipmentPath = shipmentOptions.filter((option) => !["failed", "returned"].includes(option.value));

function listingStatusNote(status: Product["status"]) {
  switch (status) {
    case "pending":
      return "Waiting on review. Nobody can see it yet.";
    case "active":
      return "Live in the shop. Buyers can buy it or send an offer.";
    case "draft":
      return "Paused by you. Turn it back on any time.";
    case "removed":
      return "Off the shop for good.";
    case "sold":
    case "reserved":
      return "Sold — the piece has found its buyer.";
    default:
      return "Rejected in review. See the listing for the reason.";
  }
}

export function SellerDashboardPage() {
  const {
    db,
    user,
    respondToOffer,
    advanceShipment,
    scheduleAuction,
    startAuctionNow,
    endAuctionNow,
    cancelAuction,
    toggleListingAvailability,
    removeListing,
  } = useStore();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get("tab") || "overview");
  const [shipmentDraft, setShipmentDraft] = useState<Record<string, string>>({});
  const [auctionProduct, setAuctionProduct] = useState("");
  const [auctionStart, setAuctionStart] = useState("");

  useEffect(() => {
    setTab(route.query.get("tab") || "overview");
  }, [route.query]);

  if (!user) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Store size={38} />
          <h2>Sign in to your seller dashboard.</h2>
          <Link href="#/login" className="button button-olive">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const myProducts = db.products.filter((product) => product.sellerId === user.id);
  const myOffers = db.offers.filter((offer) => offer.sellerId === user.id);
  const myOrders = db.orders.filter((order) => order.sellerId === user.id);
  const myAuctions = db.auctions.filter((auction) => auction.sellerId === user.id);
  const mySettlements = db.settlements.filter((settlement) => settlement.sellerId === user.id);
  const pendingOffers = myOffers.filter((offer) => offer.status === "pending");
  const paidOrders = myOrders.filter((order) =>
    ["paid", "processing", "awaiting_pickup", "shipped", "delivered"].includes(order.status),
  );
  const revenue = mySettlements.reduce(
    (total, settlement) => total + (settlement.status === "paid" ? settlement.sellerPayout : 0),
    0,
  );
  const pendingPayout = mySettlements
    .filter((settlement) => settlement.status !== "paid")
    .reduce((total, settlement) => total + settlement.sellerPayout, 0);
  const liveAuctions = myAuctions.filter((auction) => auction.status === "live");
  const activeListings = myProducts.filter((product) => product.status === "active");
  const pendingListings = myProducts.filter((product) => product.status === "pending");
  const deliveredCount = myOrders.filter((order) => order.status === "delivered").length;

  const journeySteps = [
    {
      key: "listed",
      title: "List it",
      icon: Camera,
      done: myProducts.length > 0,
      badge: "Milestone 1",
      headline: "Create and publish your vintage listing",
      description: "Take 3–6 clear photos in natural daylight, set your price, and describe the piece accurately. You can allow private buyer offers or schedule an auction.",
      checklist: [
        "Upload crisp photos taken in soft natural lighting",
        "Describe materials, patina, and honest vintage condition",
        "Enable private buyer offers or schedule a live auction",
      ],
      primaryAction: {
        label: "List an item now",
        action: "#/sell?start=1",
      },
      secondaryAction: {
        label: "View all listings",
        tab: "listings",
      },
      line:
        myProducts.length > 0
          ? `${myProducts.length} listing${myProducts.length === 1 ? "" : "s"} saved`
          : "Add your first piece from the button above",
    },
    {
      key: "live",
      title: "Live in the shop",
      icon: Store,
      done: activeListings.length > 0,
      badge: "Milestone 2",
      headline: "Curated verification & live shop showcase",
      description: "Our curation team reviews every piece within 2–4 hours for authentic description, clear photos, and fair market pricing.",
      checklist: [
        "Verified listings appear on the main shop rail & search",
        "Buyers across India can bookmark and send offers",
        "Pause, edit, or adjust pricing at any time",
      ],
      primaryAction: {
        label: "Manage shop listings",
        tab: "listings",
      },
      secondaryAction: {
        label: "Browse live marketplace",
        action: "#/products",
      },
      line:
        activeListings.length > 0
          ? `${activeListings.length} visible to buyers${pendingListings.length ? ` · ${pendingListings.length} waiting on review` : ""}`
          : pendingListings.length > 0
            ? `${pendingListings.length} waiting on review — gone over before it goes live`
            : "Nothing visible to buyers yet",
    },
    {
      key: "sold",
      title: "Sold",
      icon: Tag,
      done: paidOrders.length > 0,
      badge: "Milestone 3",
      headline: "Secured buyer payment & order confirmation",
      description: "Payment is captured upfront and held securely in escrow before you pack. You will never ship without 100% confirmed payment.",
      checklist: [
        "Zero payment risk: funds are collected before pickup",
        "Instant notification via WhatsApp, email, and dashboard",
        "Accept, decline, or counter private buyer offers",
      ],
      primaryAction: {
        label: "Review orders",
        tab: "orders",
      },
      secondaryAction: {
        label: "Check buyer offers",
        tab: "offers",
      },
      line:
        paidOrders.length > 0
          ? `${paidOrders.length} paid order${paidOrders.length === 1 ? "" : "s"} to hand over`
          : "A sale happens when a buyer pays",
    },
    {
      key: "delivered",
      title: "Delivered",
      icon: Truck,
      done: deliveredCount > 0,
      badge: "Milestone 4",
      headline: "Doorstep courier pickup & insured transit",
      description: "No traveling to courier hubs. A designated rider arrives at your doorstep to collect the parcel with pre-printed labels.",
      checklist: [
        "Schedule rider pickup at your preferred date & time slot",
        "End-to-end tracked transit from your door to the buyer",
        "Transit insurance protection for vintage & delicate pieces",
      ],
      primaryAction: {
        label: "Track shipments",
        tab: "orders",
      },
      secondaryAction: {
        label: "Packaging guidelines",
        action: "#/policies",
      },
      line:
        deliveredCount > 0
          ? `${deliveredCount} piece${deliveredCount === 1 ? "" : "s"} in their hands`
          : "We pick up, pack and deliver for you",
    },
    {
      key: "paid",
      title: "Paid out",
      icon: Wallet,
      done: revenue > 0,
      badge: "Milestone 5",
      headline: "Direct bank account payout",
      description: "Once the buyer confirms delivery, your earnings are automatically transferred directly into your registered bank account.",
      checklist: [
        "Transparent 10% platform commission (inclusive of GST)",
        "Direct NEFT / IMPS transfer within 24–48 hours of delivery",
        "Downloadable tax invoice and payout ledger anytime",
      ],
      primaryAction: {
        label: "View payouts & earnings",
        tab: "earnings",
      },
      secondaryAction: {
        label: "Bank details in profile",
        action: "#/account?tab=profile",
      },
      line:
        revenue > 0
          ? `${formatMoney(revenue)} marked paid`
          : pendingPayout > 0
            ? `${formatMoney(pendingPayout)} queued — admin approves payouts`
            : "Money lands here once a sale is settled",
    },
  ];
  const firstTodo = journeySteps.findIndex((step) => !step.done);
  const completedCount = journeySteps.filter((step) => step.done).length;
  const progressPercent = Math.round((completedCount / journeySteps.length) * 100);
  const [selectedStep, setSelectedStep] = useState<number | null>(firstTodo >= 0 ? firstTodo : 0);

  const setTabAndHash = (next: string) => {
    setTab(next);
    window.location.hash = `#/seller?tab=${next}`;
  };

  return (
    <main className="page-shell dashboard-page">
      <div className="section-wrap">
        <div className="page-header">
          <div>
            <h1>
              Your <em>shop.</em>
            </h1>
            <p>
              {user.name} · {myProducts.length} listings · {liveAuctions.length} live auctions
            </p>
          </div>
          <Link href="#/sell?start=1" className="button button-olive">
            <Plus size={15} /> New listing
          </Link>
        </div>

        <section className="journey-panel">
          <div className="panel-head">
            <div>
              <h2>Selling, end to end</h2>
              <p className="journey-summary">
                {completedCount === 0
                  ? "Start by adding your first piece to the shop"
                  : completedCount === 5
                    ? "All 5 milestones achieved! Your shop is fully active"
                    : `Next step (${firstTodo + 1} of 5): ${journeySteps[firstTodo]?.title}`}
              </p>
            </div>
            <div className="journey-progress-wrap">
              <span className="journey-progress-label">
                {completedCount} of {journeySteps.length} complete
              </span>
              <div className="journey-progress-bar">
                <div
                  className="journey-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="seller-journey-grid">
            {journeySteps.map((step, index) => {
              const isDone = step.done;
              const isCurrent = index === firstTodo;
              const isSelected = selectedStep === index;
              const StepIcon = step.icon;
              const statusLabel = isDone
                ? "Completed"
                : isCurrent
                  ? "In Progress"
                  : "Upcoming";
              const statusTone = isDone
                ? "good"
                : isCurrent
                  ? "warm"
                  : "neutral";

              return (
                <div
                  key={step.key}
                  className={`journey-card ${isDone ? "is-done" : isCurrent ? "is-current" : "is-todo"} ${isSelected ? "is-selected" : ""}`}
                  onClick={() => setSelectedStep(isSelected ? null : index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedStep(isSelected ? null : index);
                    }
                  }}
                  aria-expanded={isSelected}
                >
                  <div className="journey-card-top">
                    <span className="journey-dot">
                      {isDone ? <Check size={14} /> : <StepIcon size={14} />}
                    </span>
                    <StatusPill status={statusLabel} tone={statusTone} />
                  </div>
                  <div className="journey-copy">
                    <strong>
                      {index + 1}. {step.title}
                    </strong>
                    <span>{step.line}</span>
                  </div>
                  <div className="journey-card-foot">
                    <span>{isSelected ? "Hide guide ▲" : "Inspect step →"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {selectedStep !== null && journeySteps[selectedStep] && (
              <motion.div
                key={selectedStep}
                className="journey-detail-tray"
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {(() => {
                  const step = journeySteps[selectedStep];
                  const StepIcon = step.icon;
                  const isDone = step.done;
                  const isCurrent = selectedStep === firstTodo;
                  const statusLabel = isDone
                    ? "Completed"
                    : isCurrent
                      ? "In Progress"
                      : "Upcoming";
                  const statusTone = isDone ? "good" : isCurrent ? "warm" : "neutral";

                  return (
                    <div className="journey-detail-inner">
                      <div className="journey-detail-head">
                        <div className="journey-detail-meta">
                          <span className="journey-detail-icon">
                            <StepIcon size={18} />
                          </span>
                          <div>
                            <div className="journey-detail-eyebrow">
                              <span>{step.badge}</span>
                              <StatusPill status={statusLabel} tone={statusTone} />
                            </div>
                            <h3>{step.headline}</h3>
                            <p>{step.description}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="journey-detail-close"
                          onClick={() => setSelectedStep(null)}
                          aria-label="Close step guide"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="journey-detail-body">
                        <div className="journey-checklist">
                          <strong>Key highlights for this step:</strong>
                          <ul>
                            {step.checklist.map((item, i) => (
                              <li key={i}>
                                <CheckCircle2 size={15} />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="journey-actions">
                          {step.primaryAction.action ? (
                            <Link href={step.primaryAction.action} className="button button-olive">
                              {step.primaryAction.label} <ArrowRight size={14} />
                            </Link>
                          ) : step.primaryAction.tab ? (
                            <button
                              type="button"
                              className="button button-olive"
                              onClick={() => setTabAndHash(step.primaryAction.tab!)}
                            >
                              {step.primaryAction.label} <ArrowRight size={14} />
                            </button>
                          ) : null}

                          {step.secondaryAction?.action ? (
                            <Link href={step.secondaryAction.action} className="button button-ghost">
                              {step.secondaryAction.label}
                            </Link>
                          ) : step.secondaryAction?.tab ? (
                            <button
                              type="button"
                              className="button button-ghost"
                              onClick={() => setTabAndHash(step.secondaryAction!.tab!)}
                            >
                              {step.secondaryAction.label}
                            </button>
                          ) : null}

                          {selectedStep < journeySteps.length - 1 && (
                            <button
                              type="button"
                              className="journey-next-btn"
                              onClick={() => setSelectedStep(selectedStep + 1)}
                            >
                              Next: {journeySteps[selectedStep + 1].title} <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <div className="stat-grid">
          <div className="stat-card">
            <span>
              <Package size={15} /> Active listings
            </span>
            <strong>{myProducts.filter((product) => product.status === "active").length}</strong>
            <em>
              {pendingListings.length > 0
                ? `${pendingListings.length} waiting on review`
                : "Nothing waiting on review"}
            </em>
          </div>
          <div className="stat-card">
            <span>
              <Tag size={15} /> Pending offers
            </span>
            <strong>{pendingOffers.length}</strong>
            <em>Accept and the buyer pays right away</em>
          </div>
          <div className="stat-card">
            <span>
              <Truck size={15} /> Orders to ship
            </span>
            <strong>
              {paidOrders.filter((order) => !["delivered", "returned"].includes(order.status)).length}
            </strong>
            <em>Your part: schedule the pickup</em>
          </div>
          <div className="stat-card">
            <span>
              <Wallet size={15} /> Paid out
            </span>
            <strong>{formatMoney(revenue)}</strong>
            <em>
              {pendingPayout > 0
                ? `${formatMoney(pendingPayout)} waiting for approval`
                : "Nothing pending right now"}
            </em>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "listings", label: "Listings", count: myProducts.length },
            { id: "offers", label: "Offers", count: pendingOffers.length },
            { id: "orders", label: "Orders", count: myOrders.length },
            { id: "auctions", label: "Auctions", count: myAuctions.length },
            { id: "earnings", label: "Earnings" },
          ]}
          active={tab}
          onChange={setTabAndHash}
        />

        {tab === "overview" && (
          <div className="dashboard-section">
            <div className="dashboard-two-col">
              <section className="panel">
                <div className="panel-head">
                  <h2>Needs attention</h2>
                  <span>Today</span>
                </div>
                {pendingOffers.length === 0 &&
                paidOrders.filter((order) => order.status === "paid").length === 0 ? (
                  <div className="panel-empty-state">
                    <span className="panel-empty-icon">
                      <CheckCircle2 size={22} />
                    </span>
                    <strong>All caught up</strong>
                    <span>Nothing urgent needs your attention. Your shop is tidy.</span>
                  </div>
                ) : (
                  <ul className="attention-list">
                    {pendingOffers.slice(0, 3).map((offer) => {
                      const product = db.products.find((item) => item.id === offer.productId);
                      return (
                        <li key={offer.id}>
                          <Tag size={15} />
                          <div>
                            <strong>{formatMoney(offer.amount)} offer</strong>
                            <span>
                              {product?.title} · asking {product ? formatMoney(product.askingPrice) : "—"} ·
                              leave it unanswered and it expires {formatDate(offer.expiresAt)}
                            </span>
                          </div>
                          <button type="button" className="text-link" onClick={() => setTabAndHash("offers")}>
                            Review
                          </button>
                        </li>
                      );
                    })}
                    {paidOrders
                      .filter((order) => order.status === "paid")
                      .slice(0, 3)
                      .map((order) => (
                        <li key={order.id}>
                          <Truck size={15} />
                          <div>
                            <strong>Order {order.number} is paid</strong>
                            <span>The buyer is waiting — your part is scheduling the pickup</span>
                          </div>
                          <button type="button" className="text-link" onClick={() => setTabAndHash("orders")}>
                            Open
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Recent activity</h2>
                  <span>History</span>
                </div>
                <ul className="activity-list">
                  {[...myOrders]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 5)
                    .map((order) => (
                      <li key={order.id}>
                        <span className={`activity-dot ${order.status}`} />
                        <div>
                          <strong>{order.items[0]?.title ?? "Order"}</strong>
                          <span>
                            {order.number} · {formatDate(order.createdAt)}
                          </span>
                        </div>
                        <StatusPill status={order.status} />
                      </li>
                    ))}
                  {myOrders.length === 0 && (
                    <div className="panel-empty-state">
                      <span className="panel-empty-icon">
                        <Clock3 size={22} />
                      </span>
                      <strong>No recent activity</strong>
                      <span>Customer orders and status updates will appear here.</span>
                    </div>
                  )}
                </ul>
              </section>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Your live auctions</h2>
                <Link href="#/auctions" className="text-link">
                  Marketplace <ArrowUpRight size={14} />
                </Link>
              </div>
              {liveAuctions.length ? (
                <div className="mini-auction-grid">
                  {liveAuctions.map((auction) => {
                    const product = db.products.find((item) => item.id === auction.productId);
                    if (!product) return null;
                    return (
                      <Link key={auction.id} href={`#/auction/${auction.id}`} className="mini-auction">
                        <img src={product.images[0]} alt={product.title} />
                        <div>
                          <strong>{product.title}</strong>
                          <span>
                            {formatMoney(auction.currentBid ?? auction.startingPrice)} · {auction.bidCount} bids
                          </span>
                          <Countdown to={auction.endsAt} compact />
                        </div>
                        <ArrowUpRight size={15} />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="panel-empty-state">
                  <span className="panel-empty-icon">
                    <Gavel size={22} />
                  </span>
                  <strong>No live auctions right now</strong>
                  <span>Opt in to auctions when listing a piece, or schedule an auction from your listings tab.</span>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "listings" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>All listings</h2>
              <Link href="#/sell?start=1" className="text-link">
                <Plus size={14} /> Add listing
              </Link>
            </div>
            <div className="seller-explain">
              <p>
                Every listing is in exactly one of these states: <strong>in review</strong> (we check it
                before it goes live), <strong>live</strong> (buyers see and buy it), <strong>paused</strong>{" "}
                (hidden by you, back on any time), or <strong>removed</strong> (off the shop for good). The
                Status column on each row tells you where that piece stands.
              </p>
            </div>
            {myProducts.length ? (
              <div className="listing-table">
                <div className="table-head">
                  <span>Piece</span>
                  <span>Price</span>
                  <span>Status</span>
                  <span>Views</span>
                  <span>Actions</span>
                </div>
                {myProducts.map((product) => (
                  <div key={product.id} className="table-row">
                    <div className="table-product">
                      <img src={product.images[0]} alt={product.title} />
                      <div>
                        <strong>{product.title}</strong>
                        <span>
                          {product.category} · {product.condition} · {product.quantity} in stock
                        </span>
                      </div>
                    </div>
                    <strong>{formatMoney(product.askingPrice)}</strong>
                    <div className="table-status">
                      <StatusPill status={product.status} />
                      <span>{listingStatusNote(product.status)}</span>
                    </div>
                    <span>{product.views}</span>
                    <div className="table-actions">
                      <Link href={`#/product/${product.id}`} className="text-link">
                        View
                      </Link>
                      <Link href={`#/sell?edit=${product.id}`} className="text-link">
                        Edit
                      </Link>
                      {["active", "draft"].includes(product.status) && (
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => {
                            const result = toggleListingAvailability(product.id);
                            if (!result.ok) toast(result.error, "error");
                          }}
                        >
                          {product.status === "active" ? "Pause" : "Activate"}
                        </button>
                      )}
                      {product.status !== "removed" && (
                        <button
                          type="button"
                          className="text-link danger"
                          onClick={() => {
                            if (!window.confirm("Remove this listing?")) return;
                            const result = removeListing(product.id);
                            if (!result.ok) toast(result.error, "error");
                            else toast("Listing removed.");
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Package size={34} />}
                title="No listings yet."
                body="Add the first piece and it will appear on the rail."
                action="Create a listing"
                actionHref="#/sell?start=1"
              />
            )}
          </div>
        )}

        {tab === "offers" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Offers received</h2>
              <span>Accept and the buyer pays right away · unanswered offers expire</span>
            </div>
            {myOffers.length ? (
              <div className="offer-table">
                {myOffers.map((offer) => {
                  const product = db.products.find((item) => item.id === offer.productId);
                  const buyer = db.users.find((item) => item.id === offer.buyerId);
                  return (
                    <article key={offer.id} className="offer-row">
                      <div className="offer-product">
                        {product && <img src={product.images[0]} alt={product.title} />}
                        <div>
                          <strong>{product?.title ?? "Listing"}</strong>
                          <span>
                            Asking {product ? formatMoney(product.askingPrice) : "—"} ·{" "}
                            {offer.amount < (product?.askingPrice ?? offer.amount)
                              ? "below"
                              : "above"}{" "}
                            asking · from {buyer?.name ?? "a buyer"}
                          </span>
                        </div>
                      </div>
                      <div className="offer-amount">
                        <span>Offer</span>
                        <strong>{formatMoney(offer.amount)}</strong>
                      </div>
                      <div className="offer-status">
                        <StatusPill status={offer.status} />
                        <span>
                          {offer.status === "pending"
                            ? `Expires ${formatDate(offer.expiresAt)}`
                            : offer.respondedAt
                              ? formatDate(offer.respondedAt)
                              : timeAgo(offer.createdAt)}
                        </span>
                      </div>
                      {offer.status === "pending" ? (
                        <div className="offer-actions">
                          <button
                            type="button"
                            className="button button-olive"
                            onClick={() => {
                              const result = respondToOffer(offer.id, true);
                              if (result.ok) toast("Offer accepted. The buyer can pay now.", "success");
                              else toast(result.error, "error");
                            }}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="button button-ghost"
                            onClick={() => {
                              const result = respondToOffer(offer.id, false);
                              if (result.ok) toast("Offer declined.");
                              else toast(result.error, "error");
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="offer-closed">
                          {offer.status === "converted" ? "Paid and converted to an order" : "Closed"}
                        </span>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Tag size={34} />}
                title="No offers yet."
                body="When a buyer sends a private offer, it lands here."
                action="View listings"
                actionHref="#/seller?tab=listings"
              />
            )}
          </div>
        )}

        {tab === "orders" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Orders</h2>
              <span>Paid orders land here with the delivery address</span>
            </div>
            {myOrders.length ? (
              <div className="seller-order-list">
                {myOrders.map((order) => {
                  const buyer = db.users.find((item) => item.id === order.buyerId);
                  const nextStatus = shipmentDraft[order.id] || "";
                  const shippedIndex = shipmentPath.findIndex(
                    (step) => step.value === order.shipment?.status,
                  );
                  const failedShipment =
                    order.shipment && ["failed", "returned"].includes(order.shipment.status);
                  return (
                    <article key={order.id} className="seller-order">
                      <div className="seller-order-head">
                        <div>
                          <strong>{order.number}</strong>
                          <span>
                            {formatDate(order.createdAt)} · {buyer?.name ?? "Buyer"}
                          </span>
                        </div>
                        <StatusPill status={order.status} />
                        <StatusPill status={order.paymentStatus} tone={order.paymentStatus === "paid" ? "good" : "warm"} />
                        <Link href={`#/orders/${order.id}`} className="text-link">
                          Details
                        </Link>
                      </div>
                      <div className="seller-order-track">
                        {order.paymentStatus !== "paid" ? (
                          <p className="track-waiting">
                            Waiting on the buyer's payment. Delivery starts once it is paid.
                          </p>
                        ) : failedShipment ? (
                          <p className="track-waiting is-warm">
                            Delivery hit a snag. Set the right status below so the buyer knows.
                          </p>
                        ) : (
                          <>
                            <ol className="shipment-track">
                              {shipmentPath.map((step, index) => {
                                const reached = shippedIndex >= 0 && index <= shippedIndex;
                                return (
                                  <li key={step.value} className={reached ? "is-reached" : ""}>
                                    <span className="track-dot" />
                                    <span>{step.label}</span>
                                  </li>
                                );
                              })}
                            </ol>
                            {!order.shipment && (
                              <p className="track-waiting">
                                Your part now: schedule a pickup with the courier below.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="seller-order-body">
                        <div className="seller-order-items">
                          {order.items.map((item) => (
                            <div key={item.id}>
                              <img src={item.image} alt={item.title} />
                              <span>
                                <strong>{item.title}</strong>
                                <em>
                                  Qty {item.quantity} · {formatMoney(item.price)}
                                </em>
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="seller-order-address">
                          <span>Ship to</span>
                          <strong>{order.address.name}</strong>
                          <p>
                            {order.address.line1}
                            {order.address.line2 ? `, ${order.address.line2}` : ""}
                            <br />
                            {order.address.city} {order.address.pincode}
                          </p>
                          <span>{order.address.phone}</span>
                        </div>
                        <div className="seller-order-total">
                          <span>Order total</span>
                          <strong>{formatMoney(order.total)}</strong>
                          <em>
                            {order.source === "auction"
                              ? "Auction win"
                              : order.source === "offer"
                                ? "Accepted offer"
                                : "Marketplace sale"}
                          </em>
                        </div>
                      </div>
                      {order.paymentStatus === "paid" &&
                        !["cancelled", "expired", "returned"].includes(order.status) && (
                          <div className="shipment-update">
                            <label>
                              <span>
                                Update delivery
                                {!failedShipment &&
                                shippedIndex >= 0 &&
                                shippedIndex < shipmentPath.length - 1
                                  ? ` · suggested next: ${shipmentPath[shippedIndex + 1].label}`
                                  : !order.shipment
                                    ? " · suggested next: Pickup scheduled"
                                    : ""}
                              </span>
                              <SelectMenu
                                value={nextStatus}
                                placeholder="Choose a status"
                                options={shipmentOptions}
                                onChange={(value) =>
                                  setShipmentDraft((previous) => ({
                                    ...previous,
                                    [order.id]: value,
                                  }))
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className="button button-olive"
                              disabled={!nextStatus}
                              onClick={() => {
                                const result = advanceShipment(
                                  order.id,
                                  nextStatus as NonNullable<Order["shipment"]>["status"],
                                );
                                if (result.ok) {
                                  toast("Delivery status updated.", "success");
                                  setShipmentDraft((previous) => ({ ...previous, [order.id]: "" }));
                                } else {
                                  toast(result.error, "error");
                                }
                              }}
                            >
                              Save update
                            </button>
                            <p>
                              Delivery updates are manual in this demo. The money from this order is
                              already queued under Earnings — an admin marks the payout paid.
                            </p>
                          </div>
                        )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Truck size={34} />}
                title="No orders yet."
                body="Paid orders appear here with the buyer's delivery address."
                action="View marketplace"
                actionHref="#/products"
              />
            )}
          </div>
        )}

        {tab === "auctions" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Auctions</h2>
              <span>Optional live lots</span>
            </div>

            <div className="seller-explain">
              <p>
                How an auction pays you: bidding opens at {db.settings.auctionStartPct}% of your asking
                price, so buyers have room to win. Your payout is 90% of the final winning bid,
                whether it lands above or below your asking price.
              </p>
            </div>

            <section className="panel auction-schedule-panel">
              <h3>Schedule an auction</h3>
              <p>
                Pick one of your active listings and a start time. Bidding opens at{" "}
                {db.settings.auctionStartPct}% of the asking price. A 10% commission applies to the
                full winning bid.
              </p>
              <div className="auction-schedule-form">
                <label>
                  <span>Listing</span>
                  <SelectMenu
                    value={auctionProduct}
                    placeholder="Choose a listing"
                    options={myProducts
                      .filter((product) => product.status === "active")
                      .map((product) => ({
                        value: product.id,
                        label: `${product.title} · ${formatMoney(product.askingPrice)}`,
                      }))}
                    onChange={setAuctionProduct}
                  />
                </label>
                <label>
                  <span>Starts</span>
                  <ScheduleDateTime
                    value={auctionStart}
                    onChange={setAuctionStart}
                  />
                </label>
                <button
                  type="button"
                  className="button button-olive"
                  disabled={!auctionProduct || !auctionStart}
                  onClick={() => {
                    const result = scheduleAuction(
                      auctionProduct,
                      new Date(auctionStart).toISOString(),
                    );
                    if (result.ok) {
                      toast("Auction scheduled.", "success");
                      setAuctionProduct("");
                      setAuctionStart("");
                    } else {
                      toast(result.error, "error");
                    }
                  }}
                >
                  Schedule <Gavel size={15} />
                </button>
              </div>
            </section>

            {myAuctions.length ? (
              <div className="seller-auction-list">
                {myAuctions.map((auction) => {
                  const product = db.products.find((item) => item.id === auction.productId);
                  if (!product) return null;
                  return (
                    <article key={auction.id} className="seller-auction">
                      <img src={product.images[0]} alt={product.title} />
                      <div className="seller-auction-info">
                        <div>
                          <strong>{product.title}</strong>
                          <span>
                            Asking {formatMoney(auction.askingPrice)} · start{" "}
                            {formatMoney(auction.startingPrice)}
                          </span>
                          {auction.status === "scheduled" && (
                            <span className="auction-state">Bids open at the scheduled time.</span>
                          )}
                          {auction.status === "live" && (
                            <span className="auction-state">
                              Highest bid wins. A 10% commission applies to the full winning bid.
                            </span>
                          )}
                          {auction.status === "completed" && (
                            <span className="auction-state">Settled below — the numbers are final.</span>
                          )}
                          {auction.status === "cancelled" && (
                            <span className="auction-state">Cancelled — the listing is back on the shelf.</span>
                          )}
                        </div>
                        <div className="seller-auction-stats">
                          <span>{formatMoney(auction.currentBid ?? auction.startingPrice)}</span>
                          <em>{auction.bidCount} bids</em>
                          {auction.status === "live" && <Countdown to={auction.endsAt} compact />}
                          {auction.status === "scheduled" && <Countdown to={auction.startsAt} prefix="Opens" compact />}
                        </div>
                      </div>
                      <div className="seller-auction-actions">
                        <StatusPill status={auction.status} tone={auction.status === "live" ? "live" : undefined} />
                        {auction.status === "scheduled" && (
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => {
                              startAuctionNow(auction.id);
                              toast("Auction started.", "success");
                            }}
                          >
                            Start now
                          </button>
                        )}
                        {auction.status === "live" && (
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => {
                              endAuctionNow(auction.id);
                              toast("Auction ended and settled.", "success");
                            }}
                          >
                            End now
                          </button>
                        )}
                        {["scheduled", "live"].includes(auction.status) && (
                          <button
                            type="button"
                            className="text-link danger"
                            onClick={() => {
                              if (!window.confirm("Cancel this auction?")) return;
                              cancelAuction(auction.id, "Cancelled by seller.");
                              toast("Auction cancelled.");
                            }}
                          >
                            Cancel
                          </button>
                        )}
                        <Link href={`#/auction/${auction.id}`} className="text-link">
                          View lot
                        </Link>
                      </div>
                      {auction.financial && (
                        <div className="seller-auction-finance">
                          <span>
                            Winning bid <strong>{formatMoney(auction.financial.winningBid)}</strong>
                          </span>
                          <span>
                            Your payout <strong>{formatMoney(auction.financial.sellerPayout)}</strong>
                          </span>
                          <span>
                            Commission{" "}
                            <strong>{formatMoney(auction.financial.platformCommission)}</strong>
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Gavel size={34} />}
                title="No auctions yet."
                body="Opt in when listing, or schedule one from an active listing above."
                action="Manage listings"
                actionHref="#/seller?tab=listings"
              />
            )}
          </div>
        )}

        {tab === "earnings" && (
          <div className="dashboard-section">
            <ol className="payout-flow">
              <li>
                <span className="payout-dot" />
                <div>
                  <strong>A sale settles</strong>
                  <span>A paid order or an ended auction moves here from Orders</span>
                </div>
              </li>
              <li>
                <span className="payout-dot" />
                <div>
                  <strong>Pending payout</strong>
                  <span>Sits below until an admin approves it — nothing for you to do</span>
                </div>
              </li>
              <li>
                <span className="payout-dot" />
                <div>
                  <strong>Paid</strong>
                  <span>The approved amount on the dark card, yours</span>
                </div>
              </li>
            </ol>

            <div className="earning-cards">
              <div className="stat-card is-dark">
                <span>
                  <Banknote size={15} /> Lifetime paid
                </span>
                <strong>{formatMoney(revenue)}</strong>
                <em>Settlements marked paid</em>
              </div>
              <div className="stat-card">
                <span>
                  <Clock3 size={15} /> Pending payout
                </span>
                <strong>{formatMoney(pendingPayout)}</strong>
                <em>Awaiting admin approval</em>
              </div>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Settlements</h2>
                <span>Payouts are manual in this demo</span>
              </div>
              {mySettlements.length ? (
                <div className="listing-table">
                  <div className="table-head">
                    <span>Source</span>
                    <span>Asking</span>
                    <span>Payout</span>
                    <span>Status</span>
                    <span>Date</span>
                  </div>
                  {mySettlements.map((settlement) => (
                    <div key={settlement.id} className="table-row">
                      <div className="table-product">
                        <div>
                          <strong>{settlement.source}</strong>
                          <span>
                            {settlement.orderId ? `Order ${settlement.orderId.slice(0, 8)}` : "Auction"}
                          </span>
                        </div>
                      </div>
                      <span>{formatMoney(settlement.askingPrice)}</span>
                      <strong>{formatMoney(settlement.sellerPayout)}</strong>
                      <StatusPill status={settlement.status} />
                      <span>{formatDate(settlement.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="panel-empty">No settlements yet. They appear after a paid order.</p>
              )}
            </section>
          </div>
        )}

        <div className="dashboard-footnote">
          <BadgeCheck size={15} />
          Demo dashboard. No real payouts, courier bookings, or payment captures happen here.
          <button type="button" className="text-link" onClick={() => navigate("#/products")}>
            Back to shop
          </button>
        </div>
      </div>
    </main>
  );
}
