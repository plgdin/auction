import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  Heart,
  MapPin,
  Package,
  Plus,
  Tag,
  Truck,
  UserRound,
} from "lucide-react";
import { Link, navigate } from "../components/Link";
import { AddressForm } from "../components/AddressForm";
import { EmptyState, Field, StatusPill, Tabs } from "../components/Ui";
import { ProductCard } from "../components/ProductCard";
import { formatDate, formatDateTime, formatMoney, timeAgo } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";

export function AccountPage() {
  const {
    db,
    user,
    favorites,
    notifications,
    unreadCount,
    cancelOffer,
    addReview,
    removeAddress,
    updateProfile,
    markNotificationRead,
    markAllNotificationsRead,
  } = useStore();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get("tab") || "orders");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [profile, setProfile] = useState({ name: "", phone: "", bio: "", location: "" });
  const [reviewOrder, setReviewOrder] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    setTab(route.query.get("tab") || "orders");
  }, [route.query]);

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
  const pendingOffers = myOffers.filter((offer) => offer.status === "pending");
  const savedProducts = db.products.filter((product) => favorites.includes(product.id));
  const openOrders = myOrders.filter(
    (order) => !["delivered", "cancelled", "expired", "returned"].includes(order.status),
  );

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
              <div className="eyebrow">MY ACCOUNT</div>
              <h1>{user.name}</h1>
              <p>
                {user.email} · Joined {formatDate(user.joinedAt)} · {user.role}
              </p>
            </div>
          </div>
          <div className="account-header-actions">
            {user.isSeller && (
              <Link href="#/seller" className="button button-ghost">
                Seller dashboard
              </Link>
            )}
            {user.role === "admin" && (
              <Link href="#/admin" className="button button-ghost">
                Admin panel
              </Link>
            )}
            <Link href="#/products" className="button button-olive">
              Keep shopping <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: "orders", label: "Orders", count: myOrders.length },
            { id: "offers", label: "Offers", count: pendingOffers.length },
            { id: "saved", label: "Saved", count: savedProducts.length },
            { id: "addresses", label: "Addresses", count: user.addresses.length },
            { id: "notifications", label: "Notifications", count: unreadCount },
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
                              : "Awaiting payment"}
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

        {tab === "offers" && (
          <div className="account-section">
            <div className="account-section-head">
              <h2>Your private offers</h2>
              <span>Offers are never visible to other buyers.</span>
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
                        <span>Your offer</span>
                        <strong>{formatMoney(offer.amount)}</strong>
                      </div>
                      <div className="offer-status">
                        <StatusPill status={offer.status} />
                        <span>
                          {offer.status === "pending"
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

        {tab === "saved" && (
          <div className="account-section">
            <div className="account-section-head">
              <h2>Saved pieces</h2>
              <span>We alert you if a saved piece goes to auction.</span>
            </div>
            {savedProducts.length ? (
              <div className="product-grid">
                {savedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
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
                onClick={() => setShowAddressForm((open) => !open)}
              >
                <Plus size={14} /> {showAddressForm ? "Close" : "Add address"}
              </button>
            </div>

            {showAddressForm && (
              <div className="panel address-form-panel">
                <AddressForm
                  onSaved={() => setShowAddressForm(false)}
                  onCancel={() => setShowAddressForm(false)}
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
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<MapPin size={34} />}
                title="No address yet."
                body="Add a Trivandrum address to check out. Pincodes start with 695."
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
                  <strong>{user.role}</strong>
                </div>
                <div>
                  <span>Seller</span>
                  <strong>{user.isSeller ? "Yes" : "No"}</strong>
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
