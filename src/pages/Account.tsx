import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  Copy,
  Heart,
  Link2,
  MapPin,
  MousePointerClick,
  Package,
  Plus,
  Tag,
  Truck,
  Store,
  UserPlus,
  UserRound,
  Wallet,
} from "lucide-react";
import { Link, navigate } from "../components/Link";
import { AddressForm } from "../components/AddressForm";
import { EmptyState, Field, StatusPill, Tabs } from "../components/Ui";
import { ShopCard } from "../components/ShopCard";
import { accountForUser, previewAccount, summariseAffiliate } from "../lib/affiliate";
import { formatDate, formatDateTime, formatMoney, timeAgo } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import { InventoryTab } from "./seller/InventoryTab";
import { OrdersTab as SellerOrdersTab } from "./seller/OrdersTab";
import { OffersTab as SellerOffersTab } from "./seller/OffersTab";
import { MoneyTab as EarningsTab } from "./seller/MoneyTab";

export function AccountPage({ defaultTab }: { defaultTab?: string } = {}) {
  const {
    db,
    user,
    favorites,
    notifications,
    unreadCount,
    cancelOffer,
    counterOffer,
    respondToOffer,
    addReview,
    removeAddress,
    updateProfile,
    markNotificationRead,
    markAllNotificationsRead,
  } = useStore();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get("tab") || defaultTab || "orders");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: "", phone: "", bio: "", location: "" });
  const [reviewOrder, setReviewOrder] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState<string>("");
  const [counterNote, setCounterNote] = useState<string>("");
  const [copiedAffiliate, setCopiedAffiliate] = useState(false);

  useEffect(() => {
    setTab(route.query.get("tab") || defaultTab || "orders");
  }, [route.query, defaultTab]);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name,
        phone: user.phone || "",
        bio: user.bio || "",
        location: user.location || "",
      });
    }
  }, [user]);

  if (!user) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <UserRound size={38} />
          <h2>Sign in to see your account.</h2>
          <p>Orders, offers, saved pieces, and addresses live here once you are signed in.</p>
          <div className="modal-actions center">
            <Link href="#/login" className="button button-olive">
              Sign in
            </Link>
            <Link href="#/register" className="button button-ghost">
              Create account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const setTabAndHash = (next: string) => {
    setTab(next);
    window.location.hash = `#/account?tab=${next}`;
  };

  const myOrders = db.orders.filter((order) => order.buyerId === user.id);
  const myOffers = db.offers.filter((offer) => offer.buyerId === user.id);
  const pendingOffers = myOffers.filter((offer) => ["pending", "counter_offered"].includes(offer.status));
  const savedProducts = db.products.filter((product) => favorites.includes(product.id));
  const openOrders = myOrders.filter(
    (order) => !["delivered", "cancelled", "expired", "returned"].includes(order.status),
  );

  const mySales = db.orders.filter((order) => order.sellerId === user.id);
  const myListings = db.products.filter((product) => product.sellerId === user.id);
  const sellerOffers = db.offers.filter((offer) => offer.sellerId === user.id);
  const pendingSellerOffers = sellerOffers.filter((offer) => ["pending", "counter_offered"].includes(offer.status));
  const mySettlements = db.settlements.filter((s) => s.sellerId === user.id);
  const lifetimeEarnings = mySettlements
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.sellerPayout, 0);
  const pendingSalesCount = mySales.filter((o) => ["paid", "processing", "awaiting_pickup"].includes(o.status)).length;

  const affiliateAccount = accountForUser(user, db.affiliates) ?? previewAccount(user, db.settings);
  const affiliate = summariseAffiliate(affiliateAccount, db);
  const commissionRatePct = Math.round(affiliateAccount.commissionRate * 1000) / 10;
  const commissions = [...(db.affiliateCommissions ?? [])]
    .filter((entry) => entry.affiliateId === affiliateAccount.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const copyAffiliateLink = async () => {
    try {
      await navigator.clipboard.writeText(affiliate.link);
      setCopiedAffiliate(true);
      toast("Affiliate link copied.", "success");
    } catch {
      toast("Could not copy the link. Select it and copy manually.", "error");
    }
  };

  const submitReview = () => {
    const result = addReview(reviewOrder, reviewRating, reviewComment);
    if (result.ok) {
      toast("Review posted. Thank you.", "success");
      setReviewOrder("");
      setReviewComment("");
      setReviewRating(5);
    } else {
      toast(result.error, "error");
    }
  };

  return (
    <main className="page-shell account-page">
      <div className="section-wrap">
        <div className="account-header">
          <div className="account-identity">
            <span className="account-avatar large">{user.name.slice(0, 1)}</span>
            <div>
              <h1>{user.name}</h1>
              <p>
                {user.email} · Member since {formatDate(user.joinedAt)}
              </p>
            </div>
          </div>
          <div className="account-header-actions">
            <Link href="#/sell?start=1" className="button button-olive">
              <Plus size={15} /> List an item
            </Link>
            <Link href="#/seller" className="button button-ghost">
              <Store size={15} /> Seller dashboard
            </Link>
            {user.role === "admin" && (
              <Link href="#/admin" className="button button-ghost">
                Admin panel
              </Link>
            )}
            <Link href="#/products" className="button button-ghost">
              Keep shopping <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>

        <div className="stat-grid" style={{ marginBottom: "2rem" }}>
          <div className="stat-card">
            <span><Package size={15} /> My Listings</span>
            <strong>{myListings.length}</strong>
            <em>{myListings.filter(p => p.status === "active").length} live for buyers</em>
          </div>
          <div className="stat-card">
            <span><Truck size={15} /> Sales to Ship</span>
            <strong>{pendingSalesCount}</strong>
            <em>{mySales.length} total orders received</em>
          </div>
          <div className="stat-card">
            <span><Tag size={15} /> Purchases</span>
            <strong>{myOrders.length}</strong>
            <em>{openOrders.length} in progress</em>
          </div>
          <div className="stat-card">
            <span><Wallet size={15} /> Paid Out</span>
            <strong>{formatMoney(lifetimeEarnings)}</strong>
            <em>10% seller commission, inclusive of GST</em>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: "orders", label: "Purchases", count: myOrders.length },
            { id: "sales", label: "My Sales", count: pendingSalesCount > 0 ? pendingSalesCount : undefined },
            { id: "listings", label: "My Listings", count: myListings.length },
            { id: "offers", label: "Offers", count: pendingOffers.length + pendingSellerOffers.length > 0 ? pendingOffers.length + pendingSellerOffers.length : undefined },
            { id: "earnings", label: "Earnings" },
            { id: "saved", label: "Saved", count: savedProducts.length },
            { id: "addresses", label: "Addresses", count: user.addresses.length },
            { id: "notifications", label: "Notifications", count: unreadCount },
            { id: "affiliate", label: "Affiliate" },
            { id: "profile", label: "Profile" },
          ]}
          active={tab}
          onChange={setTabAndHash}
        />

        {tab === "orders" && (
          <div className="account-section">
            {openOrders.length > 0 && (
              <div className="account-callout">
                <Truck size={17} />
                <span>
                  {openOrders.length} order{openOrders.length === 1 ? "" : "s"} still in progress.
                </span>
              </div>
            )}
            {myOrders.length ? (
              <div className="account-order-list">
                {[...myOrders]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((order) => {
                    const seller = db.users.find((item) => item.id === order.sellerId);
                    const canReview =
                      order.status === "delivered" &&
                      !db.reviews.some((review) => review.orderId === order.id);
                    return (
                      <article key={order.id} className="account-order">
                        <div className="account-order-head">
                          <div>
                            <strong>{order.number}</strong>
                            <span>
                              {formatDate(order.createdAt)} · from {seller?.name ?? "seller"}
                            </span>
                          </div>
                          <StatusPill status={order.status} />
                          <StatusPill
                            status={order.paymentStatus}
                            tone={order.paymentStatus === "paid" ? "good" : "warm"}
                          />
                          <strong>{formatMoney(order.total)}</strong>
                        </div>
                        <div className="account-order-items">
                          {order.items.map((item) => (
                            <div key={item.id} className="account-order-item">
                              <img src={item.image} alt={item.title} />
                              <div>
                                <strong>{item.title}</strong>
                                <span>
                                  Qty {item.quantity} · {formatMoney(item.price)}
                                </span>
                                <em>
                                  {order.source === "auction"
                                    ? "Won at auction"
                                    : order.source === "offer"
                                      ? "Accepted offer price"
                                      : "Marketplace purchase"}
                                </em>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="account-order-foot">
                          <span>
                            {order.shipment
                              ? order.shipment.events.at(-1)?.note
                              : order.paymentStatus !== "paid"
                                ? `${order.source === "auction" ? "Auction payment due" : "Awaiting payment"}${order.paymentDeadline ? ` · ${formatDateTime(order.paymentDeadline)}` : ""}`
                                : "Payment confirmed"}
                          </span>
                          <div>
                            {order.status === "pending_payment" && (
                              <Link href={`#/orders/${order.id}`} className="text-link">
                                Complete payment
                              </Link>
                            )}
                            {canReview && (
                              <button
                                type="button"
                                className="text-link"
                                onClick={() => {
                                  setReviewOrder(order.id);
                                  setReviewRating(5);
                                  setReviewComment("");
                                }}
                              >
                                Leave a review
                              </button>
                            )}
                            <Link href={`#/orders/${order.id}`} className="text-link">
                              View order <ArrowUpRight size={14} />
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
              </div>
            ) : (
              <EmptyState
                icon={<Package size={34} />}
                title="No orders yet."
                body="Buy something outright, win an auction, or accept an offer to see it here."
                action="Browse the rail"
                actionHref="#/products"
              />
            )}
          </div>
        )}

        {tab === "sales" && (
          <div className="account-section">
            <div className="account-section-head">
              <h2>Orders to Fulfill</h2>
              <span>When a buyer purchases one of your pieces, pack it and confirm rider pickup here.</span>
            </div>
            <SellerOrdersTab />
          </div>
        )}

        {tab === "listings" && (
          <div className="account-section">
            <div className="account-section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2>My Listings</h2>
                <span>Pieces you put up for sale on the shop.</span>
              </div>
              <Link href="#/sell?start=1" className="button button-olive">
                <Plus size={15} /> List an item
              </Link>
            </div>
            <InventoryTab />
          </div>
        )}

        {tab === "offers" && (
          <div className="account-section">
            <div style={{ marginBottom: "2rem" }}>
              <div className="account-section-head">
                <h2>Offers received on your items</h2>
                <span>Buyers sent you these private offers. Accept, decline, or counter.</span>
              </div>
              <SellerOffersTab />
            </div>

            <div className="account-section-head" style={{ marginTop: "2rem" }}>
              <h2>Offers you made to sellers</h2>
              <span>Offers you sent to other sellers on the rail.</span>
            </div>
            {myOffers.length ? (
              <div className="offer-table">
                {myOffers.map((offer) => {
                  const product = db.products.find((item) => item.id === offer.productId);
                  const seller = db.users.find((item) => item.id === offer.sellerId);
                  return (
                    <article key={offer.id} className="offer-row">
                      <div className="offer-product">
                        {product && <img src={product.images[0]} alt={product.title} />}
                        <div>
                          <strong>{product?.title ?? "Listing"}</strong>
                          <span>
                            {seller?.name ?? "Seller"} · asking{" "}
                            {product ? formatMoney(product.askingPrice) : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="offer-amount">
                        <span>{offer.status === "counter_offered" ? "Counter-offer" : "Your offer"}</span>
                        <strong>{formatMoney(offer.counterAmount ?? offer.amount)}</strong>
                        {offer.counterMessage && (
                          <span className="fineprint" style={{ fontStyle: "italic" }}>
                            "{offer.counterMessage}"
                          </span>
                        )}
                        {offer.message && !offer.counterMessage && (
                          <span className="fineprint">{offer.message}</span>
                        )}
                      </div>
                      <div className="offer-status">
                        <StatusPill status={offer.status} />
                        <span>
                          {offer.status === "counter_offered"
                            ? offer.lastCounterBy === "seller"
                              ? "Seller made a counter-offer"
                              : "Counter sent to seller"
                            : offer.status === "pending"
                              ? `Expires ${formatDate(offer.expiresAt)}`
                              : offer.status === "accepted" && offer.checkoutExpiresAt
                                ? `Pay by ${formatDateTime(offer.checkoutExpiresAt)}`
                                : formatDate(offer.respondedAt || offer.createdAt)}
                        </span>
                      </div>
                      <div className="offer-actions">
                        {offer.status === "accepted" && (
                          <button
                            type="button"
                            className="button button-olive"
                            onClick={() => navigate(`#/checkout?offer=${offer.id}`)}
                          >
                            Pay {formatMoney(offer.amount)}
                          </button>
                        )}
                        {offer.status === "counter_offered" && offer.lastCounterBy === "seller" && (
                          <>
                            <button
                              type="button"
                              className="button button-olive"
                              onClick={() => {
                                const result = respondToOffer(offer.id, true);
                                if (result.ok) toast("Counter-offer accepted! Proceed to checkout.", "success");
                                else toast(result.error, "error");
                              }}
                            >
                              Accept {formatMoney(offer.counterAmount ?? offer.amount)}
                            </button>
                            <button
                              type="button"
                              className="button button-ghost"
                              onClick={() => {
                                setCounterOfferId(offer.id);
                                setCounterAmount(String(Math.round(((offer.counterAmount ?? offer.amount) * 0.95) / 100)));
                                setCounterNote("");
                              }}
                            >
                              Counter / Negotiate
                            </button>
                            <button
                              type="button"
                              className="button button-ghost"
                              onClick={() => {
                                const result = respondToOffer(offer.id, false);
                                if (result.ok) toast("Counter-offer declined.");
                                else toast(result.error, "error");
                              }}
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {["pending", "accepted"].includes(offer.status) && (
                          <button
                            type="button"
                            className="button button-ghost"
                            onClick={() => {
                              const result = cancelOffer(offer.id);
                              if (result.ok) toast("Offer withdrawn.");
                              else toast(result.error, "error");
                            }}
                          >
                            Withdraw
                          </button>
                        )}
                        {product && (
                          <Link href={`#/product/${product.id}`} className="text-link">
                            View listing
                          </Link>
                        )}
                      </div>
                      {counterOfferId === offer.id && (
                        <div
                          className="counter-offer-box"
                          style={{
                            gridColumn: "1 / -1",
                            padding: "12px",
                            background: "var(--color-bg-subtle, #f7f7f5)",
                            borderRadius: "8px",
                            marginTop: "8px",
                          }}
                        >
                          <p style={{ margin: "0 0 8px 0", fontSize: "0.875rem", fontWeight: 600 }}>
                            Propose your counter-price to seller:
                          </p>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ position: "relative", width: "140px" }}>
                              <span
                                style={{
                                  position: "absolute",
                                  left: "8px",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  color: "#666",
                                }}
                              >
                                ₹
                              </span>
                              <input
                                type="number"
                                style={{
                                  width: "100%",
                                  paddingLeft: "24px",
                                  height: "36px",
                                  borderRadius: "6px",
                                  border: "1px solid #ccc",
                                }}
                                placeholder="Price"
                                value={counterAmount}
                                onChange={(e) => setCounterAmount(e.target.value)}
                              />
                            </div>
                            <input
                              type="text"
                              style={{
                                flex: 1,
                                minWidth: "180px",
                                height: "36px",
                                padding: "0 8px",
                                borderRadius: "6px",
                                border: "1px solid #ccc",
                              }}
                              placeholder="Add a note (optional)"
                              value={counterNote}
                              onChange={(e) => setCounterNote(e.target.value)}
                            />
                            <button
                              type="button"
                              className="button button-olive"
                              onClick={() => {
                                const val = Math.round(Number(counterAmount) * 100);
                                if (!val || val <= 0) {
                                  toast("Enter a valid price in rupees.", "error");
                                  return;
                                }
                                const res = counterOffer(offer.id, val, counterNote);
                                if (res.ok) {
                                  toast("Counter-offer sent to seller!", "success");
                                  setCounterOfferId(null);
                                } else {
                                  toast(res.error, "error");
                                }
                              }}
                            >
                              Send Counter
                            </button>
                            <button
                              type="button"
                              className="button button-ghost"
                              onClick={() => setCounterOfferId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Tag size={34} />}
                title="No offers yet."
                body="Find a piece you like and send the seller a private price."
                action="Find something"
                actionHref="#/products"
              />
            )}
          </div>
        )}

        {tab === "earnings" && (
          <div className="account-section">
            <div className="account-section-head">
              <h2>Earnings & Payouts</h2>
              <span>
                  Your sales earnings after a 10% seller commission, inclusive of GST.
              </span>
            </div>
            <EarningsTab />
          </div>
        )}

        {tab === "saved" && (
          <div className="account-section">
            <div className="account-section-head">
              <h2>Saved pieces</h2>
              <span>We alert you if a saved piece goes to auction.</span>
            </div>
            {savedProducts.length ? (
              <div className="product-grid">
                {savedProducts.map((product) => (
                  <ShopCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Heart size={34} />}
                title="Nothing saved yet."
                body="Tap the heart on any listing to keep it here."
                action="Browse the rail"
                actionHref="#/products"
              />
            )}
          </div>
        )}

        {tab === "addresses" && (
          <div className="account-section">
            <div className="account-section-head">
              <h2>Delivery addresses</h2>
              <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    setEditingAddressId(null);
                    setShowAddressForm((open) => !open);
                  }}
              >
                <Plus size={14} /> {showAddressForm ? "Close" : "Add address"}
              </button>
            </div>

            {showAddressForm && (
              <div className="panel address-form-panel">
                <AddressForm
                  initial={user.addresses.find((address) => address.id === editingAddressId)}
                  onSaved={() => {
                    setShowAddressForm(false);
                    setEditingAddressId(null);
                  }}
                  onCancel={() => {
                    setShowAddressForm(false);
                    setEditingAddressId(null);
                  }}
                />
              </div>
            )}

            {user.addresses.length ? (
              <div className="address-grid">
                {user.addresses.map((address) => (
                  <article key={address.id} className="address-card">
                    <div className="address-card-head">
                      <strong>{address.label}</strong>
                      {address.isDefault && <em>Default</em>}
                    </div>
                    <span>{address.name}</span>
                    <p>
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}
                      <br />
                      {address.city}, {address.state} {address.pincode}
                    </p>
                    <span>{address.phone}</span>
                    <div className="address-card-actions">
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => {
                          setEditingAddressId(address.id);
                          setShowAddressForm(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-link danger"
                        onClick={() => {
                          removeAddress(address.id);
                          toast("Address removed.");
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<MapPin size={34} />}
                title="No address yet."
                body="Add your Indian delivery address to continue. Enter a valid six-digit PIN code."
              />
            )}
          </div>
        )}

        {tab === "notifications" && (
          <div className="account-section">
            <div className="account-section-head">
              <h2>Notifications</h2>
              {unreadCount > 0 && (
                <button type="button" className="text-link" onClick={markAllNotificationsRead}>
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length ? (
              <ul className="notification-list">
                {notifications.map((notification) => (
                  <li key={notification.id} className={notification.readAt ? "" : "is-unread"}>
                    <span className="notification-dot">
                      {notification.readAt ? <Check size={13} /> : <Bell size={13} />}
                    </span>
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.body}</p>
                      <span>{timeAgo(notification.createdAt)}</span>
                    </div>
                    {notification.href ? (
                      <Link
                        href={notification.href}
                        className="text-link"
                        onClick={() => markNotificationRead(notification.id)}
                      >
                        Open <ArrowUpRight size={13} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => markNotificationRead(notification.id)}
                      >
                        Mark read
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Bell size={34} />}
                title="No notifications."
                body="Order updates, offers, outbid alerts, and auction results show up here."
              />
            )}
          </div>
        )}

        {tab === "affiliate" && (
          <div className="account-section">
            <div className="affiliate-hero">
              <div>
                <div className="eyebrow">AFFILIATE PROGRAM</div>
                <h2>
                  {affiliateAccount.kind === "college"
                    ? "Fund your community."
                    : "Share the rail."}{" "}
                  Earn {commissionRatePct}%
                </h2>
                <p>
                  When someone buys through your link, you earn {commissionRatePct}% of the item
                  subtotal. Earnings unlock after the {db.settings.returnWindowDays}-day return
                  window, so you are never paid for a piece that comes back.
                </p>
              </div>
              <span
                className={`status-pill ${
                  affiliateAccount.status === "active"
                    ? "status-good"
                    : affiliateAccount.status === "paused"
                      ? "status-warm"
                      : "status-bad"
                }`}
              >
                {affiliateAccount.status === "active"
                  ? "Active"
                  : affiliateAccount.status === "paused"
                    ? "Paused"
                    : "Closed"}
              </span>
            </div>

            <div className="affiliate-link-card">
              <label htmlFor="affiliate-link">YOUR LINK</label>
              <div className="affiliate-link-row">
                <input
                  id="affiliate-link"
                  readOnly
                  value={affiliate.link}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button type="button" className="button button-olive" onClick={copyAffiliateLink}>
                  {copiedAffiliate ? <Check size={16} /> : <Copy size={16} />}
                  {copiedAffiliate ? "Copied" : "Copy link"}
                </button>
              </div>
              <span className="fineprint">
                Code {affiliate.code} · first click credits you for 30 days.
              </span>
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <span>
                  <MousePointerClick size={13} /> Clicks
                </span>
                <strong>{affiliate.clicks}</strong>
                <em>All time</em>
              </div>
              <div className="stat-card">
                <span>
                  <UserPlus size={13} /> Signups
                </span>
                <strong>{affiliate.signups}</strong>
                <em>People who joined</em>
              </div>
              <div className="stat-card">
                <span>
                  <Package size={13} /> Paid orders
                </span>
                <strong>{affiliate.orders}</strong>
                <em>Completed purchases</em>
              </div>
              <div className="stat-card is-dark">
                <span>
                  <Wallet size={13} /> Available
                </span>
                <strong>{formatMoney(affiliate.available)}</strong>
                <em>
                  {formatMoney(affiliate.pending)} pending · {formatMoney(affiliate.paid)} paid
                </em>
              </div>
            </div>

            <div className="account-section-head">
              <h2>Recent earnings</h2>
              <span>{commissionRatePct}% of the item subtotal, excluding shipping.</span>
            </div>
            {commissions.length ? (
              <div className="affiliate-commission-list">
                {commissions.map((entry) => {
                  const order = db.orders.find((item) => item.id === entry.orderId);
                  const eligibleAt = entry.eligibleAt
                    ? new Date(entry.eligibleAt).getTime()
                    : null;
                  const daysLeft =
                    eligibleAt === null
                      ? null
                      : Math.max(0, Math.ceil((eligibleAt - Date.now()) / 86_400_000));
                  const timing =
                    entry.status === "paid"
                      ? `Paid ${entry.paidAt ? formatDate(entry.paidAt) : ""}`
                      : entry.status === "approved"
                        ? "Return window closed · ready to pay out"
                        : entry.status === "void"
                          ? "Voided — order was returned or cancelled"
                          : eligibleAt === null
                            ? `Unlocks after delivery + ${entry.returnWindowDays}-day return window`
                            : daysLeft && daysLeft > 0
                              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in return window`
                              : "Return window closed";
                  return (
                    <article key={entry.id} className="affiliate-commission">
                      <div>
                        <strong>{order?.number || "Order"}</strong>
                        <span>
                          {formatDate(entry.createdAt)} · {formatMoney(entry.subtotal)} subtotal
                          {" · "}
                          {timing}
                        </span>
                      </div>
                      <StatusPill
                        status={entry.status}
                        tone={
                          entry.status === "paid" || entry.status === "approved"
                            ? "good"
                            : entry.status === "void"
                              ? "bad"
                              : "warm"
                        }
                      />
                      <strong>{formatMoney(entry.amount)}</strong>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="account-callout">
                <Link2 size={17} />
                <span>
                  Share your link to start earning. Earnings appear here after a referred order is
                  paid, then unlock once the return window ends.
                </span>
              </div>
            )}

            <div className="affiliate-steps">
              <div>
                <em>01</em>
                <strong>Share your link</strong>
                <span>Send it to your college group, your audience, or a friend.</span>
              </div>
              <div>
                <em>02</em>
                <strong>They join and shop</strong>
                <span>The referral stays attached to their account for 30 days.</span>
              </div>
              <div>
                <em>03</em>
                <strong>You earn {commissionRatePct}%</strong>
                <span>
                  Pending during the {db.settings.returnWindowDays}-day return window, then ready
                  to pay out.
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div className="account-section">
            <div className="account-section-head">
              <h2>Profile</h2>
              <span>Only your name and seller bio are public.</span>
            </div>
            <div className="profile-layout">
              <form
                className="panel profile-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const result = updateProfile(profile);
                  if (result.ok) toast("Profile updated.", "success");
                  else toast(result.error, "error");
                }}
              >
                <Field label="Name">
                  <input
                    value={profile.name}
                    onChange={(event) =>
                      setProfile((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile((previous) => ({ ...previous, phone: event.target.value }))
                    }
                    inputMode="tel"
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={profile.location}
                    onChange={(event) =>
                      setProfile((previous) => ({ ...previous, location: event.target.value }))
                    }
                  />
                </Field>
                {user.isSeller && (
                  <Field label="Seller bio" hint="Shown on your listings.">
                    <textarea
                      rows={4}
                      value={profile.bio}
                      onChange={(event) =>
                        setProfile((previous) => ({ ...previous, bio: event.target.value }))
                      }
                    />
                  </Field>
                )}
                <button type="submit" className="button button-olive">
                  Save profile
                </button>
              </form>

              <div className="panel profile-summary">
                <h3>Account</h3>
                <div>
                  <span>Email</span>
                  <strong>{user.email}</strong>
                </div>
                <div>
                  <span>Role</span>
                  <strong>{user.role === "admin" ? "Admin" : "Member (Buyer & Seller)"}</strong>
                </div>
                <div>
                  <span>Auction consent</span>
                  <strong>{user.auctionConsent ? "Opted in" : "Not opted in"}</strong>
                </div>
                <p className="fineprint">
                  This demo keeps accounts in localStorage. Nothing is sent to a server.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {reviewOrder && (
        <div className="inline-review">
          <div className="panel review-panel">
            <div className="panel-head">
              <h2>Leave a review</h2>
              <button type="button" className="text-link" onClick={() => setReviewOrder("")}>
                Close
              </button>
            </div>
            <div className="review-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={star <= reviewRating ? "is-active" : ""}
                  onClick={() => setReviewRating(star)}
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <Field label="Comment" hint="Optional">
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="How was the piece and the delivery?"
              />
            </Field>
            <button type="button" className="button button-olive" onClick={submitReview}>
              Post review
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
