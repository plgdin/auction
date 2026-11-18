import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { Link } from "../components/Link";
import { formatMoney, formatDate } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import type { Order } from "../lib/types";

export function OrderConfirmationPage() {
  const route = useRoute();
  const { db, refreshRemoteCommerce } = useStore();
  const orderId = route.path.split("/")[2] || "";

  const [remoteOrder, setRemoteOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. Try local store
  const storeOrder = db.orders.find((item) => item.id === orderId);

  // 2. Fallback: load directly from Supabase if local store hasn't synced yet
  useEffect(() => {
    if (storeOrder || !orderId) return;

    let mounted = true;
    setLoading(true);

    async function fetchOrder() {
      try {
        const { data: row, error } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", orderId)
          .maybeSingle();

        if (error || !row || !mounted) return;

        const addr = row.shipping_address ?? {};
        const parsed: Order = {
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
        };

        if (mounted) {
          setRemoteOrder(parsed);
          void refreshRemoteCommerce();
        }
      } catch (err) {
        console.warn("Failed fetching direct order:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void fetchOrder();

    return () => {
      mounted = false;
    };
  }, [orderId, storeOrder, refreshRemoteCommerce]);

  const order = storeOrder || remoteOrder;

  if (loading && !order) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Clock size={36} className="animate-spin text-olive" />
          <h2>Confirming your order…</h2>
          <p>Please wait a moment while we retrieve your order details.</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Package size={38} />
          <h2>Order Placed!</h2>
          <p>Your order reference is #{orderId.slice(0, 8)}.</p>
          <div className="modal-actions center">
            <Link href="#/account?tab=orders" className="button button-olive">
              View my orders
            </Link>
            <Link href="#/products" className="button button-ghost">
              Continue shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isCod = order.paymentMethod === "cod";
  const orderNum = order.number || order.id.slice(0, 8).toUpperCase();

  return (
    <main className="page-shell order-success-page">
      <div className="section-wrap" style={{ maxWidth: 840, margin: "0 auto", paddingBottom: 60 }}>
        {/* Celebration Hero Card */}
        <div
          style={{
            background: "#FAF4EB",
            border: "1px solid #D5C2A5",
            borderRadius: 24,
            padding: "36px 32px",
            textAlign: "center",
            boxShadow: "0 12px 36px rgba(50, 36, 22, 0.08)",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#4A5438",
              color: "#FFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
              boxShadow: "0 6px 16px rgba(74, 84, 56, 0.25)",
            }}
          >
            <CheckCircle2 size={36} strokeWidth={2.4} />
          </div>

          <div
            style={{
              display: "inline-block",
              background: "#E8E2D4",
              color: "#4A5438",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.08em",
              padding: "4px 12px",
              borderRadius: 20,
              marginBottom: 12,
              textTransform: "uppercase",
            }}
          >
            Order Confirmed
          </div>

          <h1
            style={{
              fontFamily: "var(--serif, Georgia, serif)",
              fontSize: "clamp(28px, 4vw, 40px)",
              color: "#28180E",
              margin: "0 0 10px",
              fontWeight: 600,
            }}
          >
            Thank you for your order!
          </h1>

          <p
            style={{
              color: "#6D533E",
              fontSize: 15,
              maxWidth: 520,
              margin: "0 auto 20px",
              lineHeight: 1.5,
            }}
          >
            We&apos;ve received your order and alerted the seller to arrange doorstep pickup.
            {isCod ? " Please keep cash ready when the parcel arrives." : " Your payment is safely held until delivery."}
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 16,
              background: "#FFF",
              border: "1px solid #E4D8C4",
              borderRadius: 12,
              padding: "10px 20px",
              fontSize: 14,
              color: "#332417",
            }}
          >
            <span>
              Order ID: <strong>{orderNum}</strong>
            </span>
            <span style={{ color: "#D5C2A5" }}>|</span>
            <span>
              Placed: <strong>{formatDate(order.createdAt)}</strong>
            </span>
            <span style={{ color: "#D5C2A5" }}>|</span>
            <span>
              Payment:{" "}
              <strong style={{ color: isCod ? "#8B5E3C" : "#4A5438" }}>
                {isCod ? "Cash on Delivery" : "Paid Online"}
              </strong>
            </span>
          </div>
        </div>

        {/* 2-Column Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* Delivery Details */}
          <div
            style={{
              background: "#FAF4EB",
              border: "1px solid #D5C2A5",
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#6D533E",
                marginBottom: 16,
              }}
            >
              <MapPin size={16} /> Delivery Address
            </div>

            <div style={{ color: "#28180E", fontSize: 15, lineHeight: 1.6 }}>
              <strong style={{ display: "block", fontSize: 16, marginBottom: 2 }}>
                {order.address.name}
              </strong>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6D533E", fontSize: 14, marginBottom: 8 }}>
                <Phone size={14} /> +91 {order.address.phone}
              </div>
              <p style={{ margin: 0, color: "#4F3C2C" }}>
                {order.address.line1}
                {order.address.line2 ? `, ${order.address.line2}` : ""}
                <br />
                {order.address.city}, {order.address.state} — <strong>{order.address.pincode}</strong>
              </p>
            </div>

            <div
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid #EBDDC8",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#4A5438",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Truck size={16} /> Estimated Delivery: 3–5 Business Days
            </div>
          </div>

          {/* Payment & Order Summary */}
          <div
            style={{
              background: "#FAF4EB",
              border: "1px solid #D5C2A5",
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#6D533E",
                marginBottom: 16,
              }}
            >
              <ShoppingBag size={16} /> Payment Summary
            </div>

            <div style={{ display: "grid", gap: 8, fontSize: 14, color: "#4F3C2C" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <strong>{formatMoney(order.subtotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Delivery</span>
                <strong>{order.shipping ? formatMoney(order.shipping) : "Free"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Platform fee</span>
                <strong>{formatMoney(order.platformFee || 1000)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>GST on platform fee (18%)</span>
                <strong>{formatMoney(order.platformFeeGst || 180)}</strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#28180E",
                  paddingTop: 10,
                  borderTop: "1px solid #EBDDC8",
                  marginTop: 4,
                }}
              >
                <span>Total</span>
                <span>{formatMoney(order.total)}</span>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: "10px 14px",
                background: "#F2EBE0",
                borderRadius: 10,
                fontSize: 12.5,
                color: "#6D533E",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ShieldCheck size={16} style={{ color: "#4A5438", flexShrink: 0 }} />
              <span>3-day doorstep buyer inspection window applies to all purchases.</span>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div
          style={{
            background: "#FAF4EB",
            border: "1px solid #D5C2A5",
            borderRadius: 20,
            padding: 24,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#6D533E",
              marginBottom: 16,
            }}
          >
            Items in this order ({order.items.length})
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: 12,
                  background: "#FFF",
                  border: "1px solid #EBDDC8",
                  borderRadius: 12,
                }}
              >
                <img
                  src={item.image}
                  alt={item.title}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 8,
                    background: "#EEE",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 15, color: "#28180E" }}>
                    {item.title}
                  </strong>
                  <span style={{ fontSize: 13, color: "#6D533E" }}>
                    Qty: {item.quantity} · Sold by {item.sellerName || "Seller"}
                  </span>
                </div>
                <strong style={{ fontSize: 16, color: "#28180E" }}>
                  {formatMoney(item.price * item.quantity)}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`#/orders/${order.id}`}
            className="button button-olive"
            style={{ minHeight: 48, padding: "0 28px", fontSize: 15 }}
          >
            View & Track Order <ArrowRight size={16} />
          </Link>

          <Link
            href="#/products"
            className="button button-ghost"
            style={{ minHeight: 48, padding: "0 24px", fontSize: 15 }}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
