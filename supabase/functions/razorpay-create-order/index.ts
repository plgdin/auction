// Creates a Razorpay order for a pending lelam order owned by the caller.
// Deploy with: supabase functions deploy razorpay-create-order
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization) return json({ error: "Sign in required" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ error: "Sign in required" }, 401);

    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId ?? "");
    if (!orderId) return json({ error: "orderId is required" }, 400);

    // RLS lets the buyer read only their own order.
    const { data: order, error: orderError } = await caller
      .from("orders")
      .select("id, order_number, total_paise, payment_status, status, payment_method")
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .maybeSingle();

    if (orderError || !order) return json({ error: "Order not found" }, 404);
    if (order.payment_method === "cod") {
      return json({ error: "This order is cash on delivery" }, 400);
    }
    if (order.payment_status === "paid") {
      return json({ error: "This order is already paid" }, 400);
    }
    if (order.status !== "pending_payment") {
      return json({ error: "This order is not awaiting payment" }, 400);
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      return json({ error: "Razorpay is not configured" }, 503);
    }

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      },
      body: JSON.stringify({
        amount: order.total_paise,
        currency: "INR",
        receipt: order.order_number,
        notes: { order_id: order.id },
      }),
    });

    const razorpayOrder = await response.json();
    if (!response.ok) {
      console.error("razorpay order failed", razorpayOrder);
      return json({ error: "Could not start payment" }, 502);
    }

    // Record the attempt for auditing; failures here must not block checkout.
    const admin = createClient(url, serviceKey);
    await admin
      .from("payments")
      .update({ status: "failed" })
      .eq("order_id", order.id)
      .eq("status", "created");
    await admin.from("payments").insert({
      order_id: order.id,
      provider: "razorpay",
      provider_order_id: razorpayOrder.id,
      amount_paise: order.total_paise,
      status: "created",
      signature_verified: false,
      raw: razorpayOrder,
    });

    return json({
      razorpayOrderId: razorpayOrder.id,
      amountPaise: order.total_paise,
      orderNumber: order.order_number,
      keyId,
    });
  } catch (error) {
    console.error("razorpay-create-order", error);
    return json({ error: String(error) }, 500);
  }
});
