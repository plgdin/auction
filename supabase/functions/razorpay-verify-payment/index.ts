// Verifies a Razorpay signature, then marks the order paid through the
// service-role RPC. Deploy with: supabase functions deploy razorpay-verify-payment
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, json } from "../_shared/cors.ts";

async function hmacHex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

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
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!keySecret) return json({ error: "Razorpay is not configured" }, 503, request);

    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId ?? "");
    const checkoutGroupId = String(body.checkoutGroupId ?? "");
    const razorpayOrderId = String(body.razorpay_order_id ?? "");
    const razorpayPaymentId = String(body.razorpay_payment_id ?? "");
    const razorpaySignature = String(body.razorpay_signature ?? "");

    if ((!orderId && !checkoutGroupId) || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return json({ error: "Missing payment fields" }, 400, request);
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ error: "Sign in required" }, 401, request);

    // Only the buyer can complete payment for their own order.
    let ordersQuery = caller
      .from("orders")
      .select("id, buyer_id");
    ordersQuery = orderId
      ? ordersQuery.eq("id", orderId).eq("buyer_id", user.id)
      : ordersQuery.eq("checkout_group_id", checkoutGroupId).eq("buyer_id", user.id);
    const { data: orders } = await ordersQuery;
    if (!orders?.length) return json({ error: "Order not found" }, 404, request);

    const expected = await hmacHex(
      keySecret,
      `${razorpayOrderId}|${razorpayPaymentId}`,
    );
    if (!constantTimeEqual(expected, razorpaySignature)) {
      return json({ error: "Payment signature is invalid" }, 400, request);
    }

    const admin = createClient(url, serviceKey);
    const { error } = orderId
      ? await admin.rpc("confirm_order_payment", {
          p_order_id: orderId,
          p_provider: "razorpay",
          p_provider_order_id: razorpayOrderId,
          p_provider_payment_id: razorpayPaymentId,
        })
      : await admin.rpc("confirm_checkout_group_payment", {
          p_checkout_group_id: checkoutGroupId,
          p_provider_order_id: razorpayOrderId,
          p_provider_payment_id: razorpayPaymentId,
        });
    if (error) {
      console.error("confirm_order_payment", error);
      return json({ error: error.message }, 400, request);
    }

    return json({ ok: true }, 200, request);
  } catch (error) {
    console.error("razorpay-verify-payment", error);
    return json({ error: String(error) }, 500, request);
  }
});
