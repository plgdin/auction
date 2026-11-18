import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  MapPin,
} from "lucide-react";
import { Link, navigate } from "../components/Link";
import { formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { payWithRazorpay } from "../lib/payments";
import { toast } from "../lib/toast";
import type { Order } from "../lib/types";

export function PaymentFailedPage() {
  const route = useRoute();
  const { db, user, refreshRemoteCommerce, payOrders } = useStore();
  const orderId = route.path.split("/")[2] || route.query.get("order") || "";

  const [remoteOrder, setRemoteOrder] = useState<Order | null>(null);
  const [retrying, setRetrying] = useState(false);

  const storeOrder = db.orders.find((item) => item.id === orderId);

  useEffect(() => {
    if (storeOrder || !orderId) return;

    let mounted = true;
    async function fetchOrder() {
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
          });
        }
      } catch (err) {
        console.warn("Failed fetching order for failed payment:", err);
      }
    }
    void fetchOrder();
    return () => {
      mounted = false;
    };
  }, [orderId, storeOrder]);

  const order = storeOrder || remoteOrder;

  const retryPayment = async () => {
    if (!order) return;
    setRetrying(true);
    try {
      const res = await payWithRazorpay(
        {
          ...(order.source === "auction" ? { orderId: order.id } : { checkoutGroupId: order.checkoutGroupId }),
          amountPaise: Math.round(order.total),
          orderNumber: order.number || order.id.slice(0, 8),
        },
        { name: user?.name, email: user?.email, contact: user?.phone },
      );

      // Confirm in Supabase
      await supabase.rpc("buyer_confirm_order_payment", {
        p_order_id: order.id,
        p_payment_id: res.razorpay_payment_id || null,
      });

      payOrders([order.id]);
      await refreshRemoteCommerce();
      toast("Payment confirmed!", "success");
      navigate(`#/order-confirmed/${order.id}`);
    } catch (err: any) {
      toast(err?.message || "Payment was not completed.", "error");
    } finally {
      setRetrying(false);
    }
  };

  const orderNum = order?.number || orderId.slice(0, 8).toUpperCase() || "—";

  return (
    <main className="page-shell payment-failed-page">
      <div className="section-wrap" style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 60 }}>
        {/* Failed Alert Card */}
        <div
          style={{
            background: "#FAF4EB",
            border: "1px solid #D5C2A5",
            borderRadius: 24,
            padding: "clamp(24px, 5vw, 36px) clamp(16px, 4vw, 32px)",
            textAlign: "center",
            boxShadow: "0 12px 36px rgba(50, 36, 22, 0.08)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#A65D49",
              color: "#FFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
              boxShadow: "0 6px 16px rgba(166, 93, 73, 0.25)",
            }}
          >
            <AlertTriangle size={34} strokeWidth={2.3} />
          </div>

          <div
            style={{
              display: "inline-block",
              background: "#FCEEEA",
              color: "#A65D49",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.08em",
              padding: "4px 12px",
              borderRadius: 20,
              marginBottom: 12,
              textTransform: "uppercase",
            }}
          >
            Payment Incomplete
          </div>

          <h1
            style={{
              fontFamily: "var(--serif, Georgia, serif)",
              fontSize: "clamp(24px, 4vw, 36px)",
              color: "#28180E",
              margin: "0 0 10px",
              fontWeight: 600,
            }}
          >
            Your payment could not be processed
          </h1>

          <p
            style={{
              color: "#6D533E",
              fontSize: 15,
              maxWidth: 520,
              margin: "0 auto 20px",
              lineHeight: 1.55,
            }}
          >
            The transaction was cancelled or declined by your bank/UPI provider. If money was debited from your account, your bank will refund it within 24 to 48 hours.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 10,
              background: "#FFF",
              border: "1px solid #E4D8C4",
              borderRadius: 12,
              padding: "10px 16px",
              fontSize: 13.5,
              color: "#332417",
            }}
          >
            <span>
              Order: <strong>{orderNum}</strong>
            </span>
            <span style={{ color: "#D5C2A5" }}>•</span>
            <span>
              Amount:{" "}
              <strong style={{ color: "#A65D49" }}>
                {order ? formatMoney(order.total) : "—"}
              </strong>
            </span>
          </div>
        </div>

        {/* Order Items Info if available */}
        {order && (
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
                marginBottom: 14,
              }}
            >
              Order Details ({order.items.length} {order.items.length === 1 ? "piece" : "pieces"})
            </div>

            <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
              {order.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 10,
                    background: "#FFF",
                    border: "1px solid #EBDDC8",
                    borderRadius: 10,
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 6 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 14, color: "#28180E" }}>
                      {item.title}
                    </strong>
                    <span style={{ fontSize: 12, color: "#6D533E" }}>
                      Qty {item.quantity} · {formatMoney(item.price)}
                    </span>
                  </div>
                  <strong style={{ fontSize: 15, color: "#28180E" }}>
                    {formatMoney(item.price * item.quantity)}
                  </strong>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#6D533E",
                paddingTop: 12,
                borderTop: "1px solid #EBDDC8",
              }}
            >
              <MapPin size={15} />
              <span>
                Delivering to: {order.address.name}, {order.address.city} {order.address.pincode}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          {order && (
            <button
              type="button"
              className="button button-olive"
              style={{ minHeight: 48, padding: "0 28px", fontSize: 15 }}
              onClick={retryPayment}
              disabled={retrying}
            >
              <CreditCard size={16} /> {retrying ? "Opening checkout…" : `Retry Payment (${formatMoney(order.total)})`}
            </button>
          )}

          {order && (
            <Link
              href={`#/orders/${order.id}`}
              className="button button-ghost"
              style={{ minHeight: 48, padding: "0 22px", fontSize: 15 }}
            >
              View Order Details
            </Link>
          )}

          <Link
            href="#/products"
            className="button button-ghost"
            style={{ minHeight: 48, padding: "0 22px", fontSize: 15 }}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
