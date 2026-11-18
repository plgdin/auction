// Creates a Razorpay order for a pending lelam order owned by the caller.
// Deploy with: supabase functions deploy razorpay-create-order
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(request) });
  }

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization) return json({ error: "Sign in required" }, 401, request);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ error: "Sign in required" }, 401, request);

    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId ?? "");
    const checkoutGroupId = String(body.checkoutGroupId ?? "");
    if (!orderId && !checkoutGroupId) return json({ error: "orderId or checkoutGroupId is required" }, 400, request);

    let ordersQuery = caller
      .from("orders")
      .select("id, order_number, total_paise, payment_status, status, payment_method");
    ordersQuery = orderId
      ? ordersQuery.eq("id", orderId).eq("buyer_id", user.id)
      : ordersQuery.eq("checkout_group_id", checkoutGroupId).eq("buyer_id", user.id);
    const { data: orders, error: orderError } = await ordersQuery;

    if (orderError || !orders?.length) return json({ error: "Order not found" }, 404, request);
    if (orders.some((order) => order.payment_method === "cod")) return json({ error: "Cash-on-delivery orders are not paid online" }, 400, request);
    if (orders.some((order) => order.payment_status === "paid")) return json({ error: "This order is already paid" }, 400, request);
    if (orders.some((order) => order.status !== "pending_payment")) return json({ error: "This order is not awaiting payment" }, 400, request);
    const amountPaise = orders.reduce((sum, order) => sum + order.total_paise, 0);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) return json({ error: "Invalid order total" }, 400, request);
    const receipt = orders.length === 1 ? orders[0].order_number : `checkout-${checkoutGroupId.slice(0, 24)}`;

    const admin = createClient(url, serviceKey);

    // Rate limiting: max 10 attempts per order/group per hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    let countQuery = admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneHourAgo);
    countQuery = orderId
      ? countQuery.eq("order_id", orderId)
      : countQuery.eq("checkout_group_id", checkoutGroupId);
    const { count, error: countError } = await countQuery;
    if (!countError && typeof count === "number" && count >= 10) {
      return json({ error: "Too many payment attempts. Please wait a few minutes." }, 429, request);
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      return json({ error: "Razorpay is not configured" }, 503, request);
    }

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: orderId ? { order_id: orderId } : { checkout_group_id: checkoutGroupId },
      }),
    });

    const razorpayOrder = await response.json();
    if (!response.ok) {
      console.error("razorpay order failed", razorpayOrder);
      return json({ error: "Could not start payment" }, 502, request);
    }

    // Every provider order must have a matching server-side payment row before it can be confirmed.
    const previousAttempts = orderId
      ? admin.from("payments").update({ status: "failed" }).eq("order_id", orderId).eq("status", "created")
      : admin.from("payments").update({ status: "failed" }).eq("checkout_group_id", checkoutGroupId).eq("status", "created");
    const { error: previousError } = await previousAttempts;
    if (previousError) {
      console.error("could not close prior Razorpay attempt", previousError);
      return json({ error: "Could not record payment attempt" }, 500, request);
    }
    const { error: paymentError } = await admin.from("payments").insert({
      order_id: orderId || (orders.length === 1 ? orders[0].id : null),
      checkout_group_id: orderId ? null : checkoutGroupId,
      provider: "razorpay",
      provider_order_id: razorpayOrder.id,
      amount_paise: amountPaise,
      status: "created",
      signature_verified: false,
      raw: razorpayOrder,
    });
    if (paymentError) {
      console.error("could not record Razorpay order", paymentError);
      return json({ error: "Could not record payment attempt" }, 500, request);
    }

    return json({
      razorpayOrderId: razorpayOrder.id,
      amountPaise,
      orderNumber: receipt,
      checkoutGroupId: orderId ? undefined : checkoutGroupId,
      orderId: orderId || undefined,
      keyId,
    }, 200, request);
  } catch (error) {
    console.error("razorpay-create-order", error);
    return json({ error: String(error) }, 500, request);
  }
});
