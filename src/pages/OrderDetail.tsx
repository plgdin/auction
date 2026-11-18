import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Clock3,
  CreditCard,
  Gavel,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { AddressForm } from "../components/AddressForm";
import { Link, navigate } from "../components/Link";
import { Modal } from "../components/Modal";
import { Field, SelectMenu, StatusPill } from "../components/Ui";
import { formatDate, formatDateTime, formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Order } from "../lib/types";
import { payWithRazorpay } from "../lib/payments";
import { isValidIndianPincode } from "../lib/delivery";
import { supabase } from "../lib/supabase";

const shipmentSteps: NonNullable<Order["shipment"]>["status"][] = [
  "pending_pickup",
  "pickup_scheduled",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

const sellerShipmentOptions: { value: NonNullable<Order["shipment"]>["status"]; label: string }[] = [
  { value: "pickup_scheduled", label: "Pickup scheduled" },
  { value: "picked_up", label: "Picked up" },
  { value: "in_transit", label: "In transit" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
];

export function OrderDetailPage() {
  const route = useRoute();
  const {
    db,
    user,
    refreshRemoteCommerce,
    payOrders,
    cancelOrder,
    requestReturn,
    addReview,
    advanceShipment,
    reportProduct,
    updateOrderAddress,
  } = useStore();
  const orderId = route.path.split("/")[2] || "";
  const storeOrder = db.orders.find((item) => item.id === orderId);
  const [remoteOrder, setRemoteOrder] = useState<Order | null>(null);
  const order = storeOrder || remoteOrder;

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("Changed my mind");
  const [customReason, setCustomReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (storeOrder || !orderId) return;
    let mounted = true;
    async function fetchDirect() {
      try {
        const { data: row } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", orderId)
          .maybeSingle();

        if (row && mounted) {
          const addr = row.shipping_address ?? {};
          setRemoteOrder({
            id: row.id,
            number: row.order_number,
            checkoutGroupId: row.checkout_group_id,
            buyerId: row.buyer_id,
            sellerId: row.seller_id,
            items: (row.order_items ?? []).map((item: any) => ({
              id: item.id,
              productId: item.product_id ?? "",
              title: item.title_snapshot || "Item",
              image: item.image_snapshot || "/images/tee.jpg",
              price: item.price_paise,
              quantity: item.quantity,
              sellerName: "Seller",
            })),
            subtotal: row.subtotal_paise,
            shipping: row.shipping_paise,
            platformFee: row.buyer_platform_fee_paise ?? 1000,
            platformFeeGst: row.buyer_platform_fee_gst_paise ?? 180,
            total: row.total_paise,
            status: row.status,
            paymentStatus: row.payment_status,
            paymentMethod: row.payment_method ?? "upi",
            source: row.source,
            offerId: row.offer_id ?? undefined,
            auctionId: row.auction_id ?? undefined,
            address: {
              id: addr.id ?? "addr",
              label: addr.label ?? "Delivery",
              name: addr.name ?? addr.recipient_name ?? "Buyer",
              phone: addr.phone ?? "",
              line1: addr.line1 ?? "",
              line2: addr.line2 ?? undefined,
              city: addr.city ?? "",
              state: addr.state ?? "",
              pincode: addr.pincode ?? "",
            },
            createdAt: row.created_at,
            paidAt: row.paid_at ?? undefined,
            paymentDeadline: row.payment_deadline ?? undefined,
          });
          void refreshRemoteCommerce();
        }
      } catch (err) {
        console.warn("Direct order load failed:", err);
      }
    }
    void fetchDirect();
    return () => {
      mounted = false;
    };
  }, [storeOrder, orderId, refreshRemoteCommerce]);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);

  if (!order) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Package size={38} />
          <h2>Order not found.</h2>
          <Link href="#/account?tab=orders" className="button button-olive">
            My orders
          </Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <ShieldCheck size={38} />
          <h2>Sign in to view this order.</h2>
          <Link href="#/login" className="button button-olive">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const isBuyer = order.buyerId === user.id;
  const isSeller = order.sellerId === user.id;
  const isAdmin = user.role === "admin";
  const isAuction = order.source === "auction";
  if (!isBuyer && !isSeller && !isAdmin) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <ShieldCheck size={38} />
          <h2>This order is not yours.</h2>
          <Link href="#/account?tab=orders" className="button button-olive">
            My orders
          </Link>
        </div>
      </main>
    );
  }

  const seller = db.users.find((item) => item.id === order.sellerId);
  const buyer = db.users.find((item) => item.id === order.buyerId);
  const existingReview = db.reviews.find((review) => review.orderId === order.id);
  const activeIndex = order.shipment ? shipmentSteps.indexOf(order.shipment.status) : -1;
  const pickedUp = Boolean(
    order.shipment &&
      ["picked_up", "in_transit", "out_for_delivery", "delivered", "returned"].includes(order.shipment.status),
  );
  const canPay = isBuyer && order.status === "pending_payment";
  const needsAddress = Boolean(
    isBuyer &&
      order.status === "pending_payment" &&
      (!order.address?.line1?.trim() ||
        !isValidIndianPincode(order.address?.pincode) ||
        order.address?.id === "addr-needed"),
  );
  const canCancel =
    !isAuction &&
    (isBuyer || isSeller || isAdmin) &&
    ["pending_payment", "paid", "processing", "awaiting_pickup"].includes(order.status) &&
    !pickedUp;
  const canReturn = isBuyer && !isAuction && order.status === "delivered";
  const canReview = isBuyer && order.status === "delivered" && !existingReview;

  return (
    <main className="page-shell order-page">
      <div className="section-wrap">
        <div className="breadcrumbs">
          <Link href={isSeller ? "#/seller?tab=orders" : "#/account?tab=orders"}>
            <ArrowLeft size={14} /> {isSeller ? "Seller orders" : "My orders"}
          </Link>
          <span>/</span>
          <span>{order.number}</span>
        </div>

        <div className="order-header">
          <div>
            <div className="eyebrow">ORDER {order.number}</div>
            <h1>
              {order.status === "delivered" ? (
                <>
                  Delivered, <em>enjoy it.</em>
                </>
              ) : order.status === "pending_payment" ? (
                <>
                  Almost <em>yours.</em>
                </>
              ) : ["cancelled", "expired", "returned"].includes(order.status) ? (
                <>
                  This order is <em>closed.</em>
                </>
              ) : order.shipment &&
                ["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(
                  order.shipment.status,
                ) ? (
                <>
                  On its <em>way.</em>
                </>
              ) : (
                <>
                  Getting it <em>ready.</em>
                </>
              )}
            </h1>
            <p>
              Placed {formatDate(order.createdAt)} · {order.items.length}{" "}
              {order.items.length === 1 ? "piece" : "pieces"} ·{" "}
              {isSeller ? `Buyer ${buyer?.name ?? "—"}` : `From ${seller?.name ?? "seller"}`}
            </p>
          </div>
          <div className="order-status-stack">
            <StatusPill status={order.status} />
            {order.status !== order.paymentStatus && (
              <StatusPill
                status={order.paymentStatus}
                tone={order.paymentStatus === "paid" ? "good" : "warm"}
              />
            )}
          </div>
        </div>

        {order.status === "pending_payment" && order.paymentDeadline && (
          <div className="order-callout">
            <Clock3 size={17} />
            <span>
              Payment is due by {formatDateTime(order.paymentDeadline)}. The item stays reserved
              until then.
            </span>
          </div>
        )}

        {order.status === "paid" && (
          <div className="order-callout is-success">
            <BadgeCheck size={17} />
            <span>
              {isAuction
                ? "Payment confirmed for your auction win. We've asked the seller to arrange pickup — auction orders are final and can't be cancelled."
                : `Payment confirmed. We've asked ${seller?.name ?? "the seller"} to arrange pickup. You can cancel free of charge any time before the parcel is picked up.`}
            </span>
          </div>
        )}

        <div className="order-layout">
          <div className="order-main">
            <section className="panel">
              <div className="panel-head">
                <h2>Items</h2>
                <span>
                  {order.source === "auction"
                    ? "Auction win"
                    : order.source === "offer"
                      ? "Accepted offer"
                      : order.source === "buy_now"
                        ? "Buy now"
                        : "Cart checkout"}
                </span>
              </div>
              <div className="order-items">
                {order.items.map((item) => (
                  <div key={item.id} className="order-item">
                    <img src={item.image} alt={item.title} />
                    <div>
                      <Link href={`#/product/${item.productId}`}>{item.title}</Link>
                      <span>
                        {item.sellerName} · Qty {item.quantity}
                      </span>
                      {order.auctionId && <em>Winning bid price</em>}
                      {order.offerId && <em>Agreed private offer price</em>}
                    </div>
                    <strong>{formatMoney(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
              <div className="order-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatMoney(order.subtotal)}</strong>
                </div>
                {order.platformFee ? (
                  <div>
                    <span>Platform fee</span>
                    <strong>{formatMoney(order.platformFee)}</strong>
                  </div>
                ) : null}
                {order.platformFeeGst ? (
                  <div>
                    <span>GST on platform fee (18%)</span>
                    <strong>{formatMoney(order.platformFeeGst)}</strong>
                  </div>
                ) : null}
                <div className="is-total">
                  <span>Total</span>
                  <strong>{formatMoney(order.total)}</strong>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Delivery</h2>
                <span>{order.shipment ? "Manual tracking" : "Waiting for payment"}</span>
              </div>
              {order.shipment ? (
                <>
                  <ol className="timeline">
                    {shipmentSteps.map((step, index) => {
                      const event = order.shipment?.events.find((item) => item.status === step);
                      const done = activeIndex >= index;
                      return (
                        <li key={step} className={done ? "is-done" : ""}>
                          <span className="timeline-dot">{done ? <Check size={11} /> : index + 1}</span>
                          <div>
                            <strong>{step.replaceAll("_", " ")}</strong>
                            <span>
                              {event ? `${formatDateTime(event.at)} · ${event.note}` : "Pending"}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {order.shipment.provider && (
                    <p className="shipment-provider">
                      Provider: {order.shipment.provider}
                      {order.shipment.awb ? ` · AWB ${order.shipment.awb}` : ""}
                    </p>
                  )}
                  <p className="fineprint">
                    Delivery updates are set manually in this demo. No courier is connected.
                  </p>
                </>
              ) : (
                <p className="panel-empty">Delivery starts after payment is confirmed.</p>
              )}
            </section>

            {isSeller && order.paymentStatus === "paid" && !["delivered", "cancelled", "expired", "returned"].includes(order.status) && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Update delivery</h2>
                  <span>Seller action</span>
                </div>
                <div className="inline-form-row">
                  <Field label="New status">
                    <SelectMenu
                      value={shipmentStatus}
                      placeholder="Choose a status"
                      options={sellerShipmentOptions}
                      onChange={setShipmentStatus}
                    />
                  </Field>
                  <button
                    type="button"
                    className="button button-olive"
                    disabled={!shipmentStatus}
                    onClick={() => {
                      const result = advanceShipment(
                        order.id,
                        shipmentStatus as NonNullable<Order["shipment"]>["status"],
                      );
                      if (result.ok) {
                        toast("Delivery updated.", "success");
                        setShipmentStatus("");
                      } else {
                        toast(result.error, "error");
                      }
                    }}
                  >
                    Save update
                  </button>
                </div>
              </section>
            )}

            {canReview && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Review the seller</h2>
                  <span>Delivery complete</span>
                </div>
                <div className="review-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={star <= rating ? "is-active" : ""}
                      onClick={() => setRating(star)}
                      aria-label={`${star} star${star === 1 ? "" : "s"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <Field label="Comment" hint="Optional">
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Exactly as described. Packed with care."
                  />
                </Field>
                <button
                  type="button"
                  className="button button-olive"
                  onClick={() => {
                    const result = addReview(order.id, rating, comment);
                    if (result.ok) toast("Review posted. Thank you.", "success");
                    else toast(result.error, "error");
                  }}
                >
                  Post review
                </button>
              </section>
            )}

            {existingReview && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Your review</h2>
                  <span>{formatDate(existingReview.createdAt)}</span>
                </div>
                <div className="review-summary">
                  <strong>{"★".repeat(existingReview.rating)}</strong>
                  <p>{existingReview.comment || "No comment left."}</p>
                </div>
              </section>
            )}
          </div>

          <aside className="order-aside">
            <div className="summary-card">
              <h2>Order summary</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatMoney(order.subtotal)}</strong>
              </div>
              {order.platformFee ? (
                <div className="summary-row">
                  <span>Platform fee</span>
                  <strong>{formatMoney(order.platformFee)}</strong>
                </div>
              ) : null}
              {order.platformFeeGst ? (
                <div className="summary-row">
                  <span>GST on platform fee (18%)</span>
                  <strong>{formatMoney(order.platformFeeGst)}</strong>
                </div>
              ) : null}
              <div className="summary-row summary-total">
                <span>Total</span>
                <strong>{formatMoney(order.total)}</strong>
              </div>

              {canPay && (
                <button
                  type="button"
                  className="button button-olive summary-cta"
                  disabled={needsAddress}
                  onClick={async () => {
                    if (needsAddress) {
                      setEditingAddress(true);
                      toast("Please add a delivery address before completing payment.", "error");
                      return;
                    }
                    try {
                      const res = await payWithRazorpay(
                        {
                          ...(order.source === "auction" ? { orderId: order.id } : { checkoutGroupId: order.checkoutGroupId }),
                          amountPaise: Math.round(order.total),
                          orderNumber: order.number || order.id.slice(0, 8),
                        },
                        { name: user.name, email: user.email, contact: user.phone },
                      );

                      try {
                        await supabase.rpc("buyer_confirm_order_payment", {
                          p_order_id: order.id,
                          p_payment_id: res.razorpay_payment_id || null,
                        });
                      } catch {
                        // fallback
                      }

                      payOrders([order.id]);
                      await refreshRemoteCommerce();
                      toast("Payment confirmed. Your order is in progress.", "success");
                      navigate(`#/order-confirmed/${order.id}`);
                    } catch (error: any) {
                      navigate(`#/payment-failed/${order.id}`);
                      toast(error instanceof Error ? error.message : "Payment failed.", "error");
                    }
                  }}
                >
                  <CreditCard size={15} /> {needsAddress ? "Add delivery address to pay" : `Pay ${formatMoney(order.total)}`}
                </button>
              )}

              {canReturn && (
                <button
                  type="button"
                  className="button button-ghost summary-cta"
                  onClick={() => {
                    const result = requestReturn(order.id);
                    if (result.ok) toast("Return requested.");
                    else toast(result.error, "error");
                  }}
                >
                  <RotateCcw size={14} /> Request return
                </button>
              )}

              {canCancel && (
                <button
                  type="button"
                  className="button button-ghost summary-cta"
                  onClick={() => setShowCancelModal(true)}
                >
                  <X size={14} /> Cancel order
                </button>
              )}

              {isAuction && isBuyer && (
                <div className="auction-policy">
                  <h3>
                    <Gavel size={14} /> Auction win — final sale
                  </h3>
                  <p>
                    Bids are binding commitments, so auction orders can&apos;t be cancelled,
                    returned or refunded.
                  </p>
                  <p>
                    The one exception: if the item arrives damaged, is materially not as described,
                    or isn&apos;t what you bid on, report it and our team will review the case.
                  </p>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      const result = reportProduct(
                        order.items[0].productId,
                        "Item not as described",
                        `Auction order ${order.number}: the item did not match the listing.`,
                      );
                      if (result.ok) toast("Report sent. Our team will review it.", "success");
                      else toast(result.error, "error");
                    }}
                  >
                    Report an issue
                  </button>
                </div>
              )}

              {canPay && null}
            </div>

            <div className="panel order-address">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>
                  <MapPin size={14} /> Delivery address
                </h3>
                {isBuyer && order.status === "pending_payment" && (
                  <button
                    type="button"
                    className="text-link"
                    style={{ fontSize: 13 }}
                    onClick={() => setEditingAddress((prev) => !prev)}
                  >
                    {editingAddress ? "Cancel" : needsAddress ? "Add address" : "Change"}
                  </button>
                )}
              </div>
              {editingAddress ? (
                <div style={{ marginTop: 12 }}>
                  {user?.addresses && user.addresses.length > 0 && (
                    <div style={{ marginBottom: 14, display: "grid", gap: 8 }}>
                      <p style={{ fontSize: 12, color: "#6b5847", margin: 0 }}>Select a saved address:</p>
                      {user.addresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          className="button button-ghost"
                          style={{ textAlign: "left", justifyContent: "flex-start", padding: "8px 12px", height: "auto" }}
                          onClick={() => {
                            const res = updateOrderAddress(order.id, addr);
                            if (res.ok) {
                              setEditingAddress(false);
                              toast("Address updated.", "success");
                            } else {
                              toast(res.error, "error");
                            }
                          }}
                        >
                          <div>
                            <strong>{addr.label}</strong> — {addr.name}, {addr.line1}, {addr.city} {addr.pincode}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <AddressForm
                    initial={order.address?.id !== "addr-needed" ? order.address : undefined}
                    onSaved={() => {
                      const latestAddr = user?.addresses.find((a) => a.isDefault) || user?.addresses[user?.addresses.length - 1];
                      if (latestAddr) {
                        updateOrderAddress(order.id, latestAddr);
                      }
                      setEditingAddress(false);
                      toast("Delivery address saved.", "success");
                    }}
                    onCancel={() => setEditingAddress(false)}
                  />
                </div>
              ) : (
                <>
                  {needsAddress ? (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ color: "#c2410c", fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>
                        ⚠️ Delivery address required to complete payment.
                      </p>
                      <button
                        type="button"
                        className="button button-olive"
                        onClick={() => setEditingAddress(true)}
                      >
                        Add address now
                      </button>
                    </div>
                  ) : (
                    <>
                      <strong>{order.address.name}</strong>
                      <p>
                        {order.address.line1}
                        {order.address.line2 ? `, ${order.address.line2}` : ""}
                        <br />
                        {order.address.city}, {order.address.state} {order.address.pincode}
                      </p>
                      <span>{order.address.phone}</span>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="panel order-contact">
              <h3>
                <Truck size={14} /> {isSeller ? "Buyer" : "Seller"}
              </h3>
              <strong>{isSeller ? buyer?.name : seller?.name}</strong>
              <span>{isSeller ? buyer?.email : seller?.email}</span>
              {!isSeller && seller && (
                <Link href={`#/products?q=${encodeURIComponent(seller.name)}`} className="text-link">
                  See their shop <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          </aside>
        </div>

        <div className="order-footnote">
          <ShieldCheck size={15} />
          <span>
            Keep the delivery address accurate. Auctions and accepted offers have a limited payment
            window. Auction wins are final — no cancellation, return or refund unless the item is
            genuinely damaged or not as described.
          </span>
          <button
            type="button"
            className="text-link"
            onClick={() => navigate(isSeller ? "#/seller?tab=orders" : "#/account?tab=orders")}
          >
            All orders
          </button>
        </div>
      </div>

      {showCancelModal && (
        <Modal title="Cancel order" onClose={() => setShowCancelModal(false)}>
          <div style={{ display: "grid", gap: 16, padding: "8px 0" }}>
            {["paid", "processing"].includes(order.status) || order.paymentStatus === "paid" ? (
              <div
                style={{
                  background: "#FAF4EB",
                  border: "1px solid #D5C2A5",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 13.5,
                  color: "#4A5438",
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ display: "block", marginBottom: 4, color: "#28180E" }}>Refund Notice:</strong>
                Your payment of <strong>{formatMoney(order.total)}</strong> has been confirmed. If you cancel this order, your refund will be credited back to your original payment method within <strong>7 to 10 working days</strong>.
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: "#6D533E" }}>
                Are you sure you want to cancel this order?
              </p>
            )}

            <Field label="Reason for cancellation">
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              >
                <option value="Changed my mind">Changed my mind</option>
                <option value="Found a better price elsewhere">Found a better price elsewhere</option>
                <option value="Ordered by mistake">Ordered by mistake</option>
                <option value="Delivery address needs correction">Delivery address needs correction</option>
                <option value="Taking too long to dispatch">Taking too long to dispatch</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            {cancelReason === "Other" && (
              <Field label="Specify reason">
                <input
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Tell us why you are cancelling…"
                  required
                />
              </Field>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="button button-olive"
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  const reason = cancelReason === "Other" ? (customReason.trim() || "Other") : cancelReason;
                  try {
                    try {
                      await supabase.rpc("buyer_cancel_order", {
                        p_order_id: order.id,
                        p_reason: reason,
                      });
                    } catch {
                      // fallback
                    }

                    const result = cancelOrder(order.id);
                    await refreshRemoteCommerce();
                    if (result.ok) {
                      setShowCancelModal(false);
                      const isPaid = ["paid", "processing"].includes(order.status) || order.paymentStatus === "paid";
                      toast(
                        isPaid
                          ? "Order cancelled. Refund will be credited within 7 to 10 working days."
                          : "Order cancelled.",
                        "success",
                      );
                    } else {
                      toast(result.error, "error");
                    }
                  } finally {
                    setCancelling(false);
                  }
                }}
              >
                {cancelling ? "Cancelling…" : "Confirm cancellation"}
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowCancelModal(false)}
              >
                Keep order
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
