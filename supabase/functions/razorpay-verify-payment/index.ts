// Verifies a Razorpay signature, then marks the order paid through the
// service-role RPC. Deploy with: supabase functions deploy razorpay-verify-payment
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

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
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!keySecret) return json({ error: "Razorpay is not configured" }, 503);

    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId ?? "");
    const razorpayOrderId = String(body.razorpay_order_id ?? "");
    const razorpayPaymentId = String(body.razorpay_payment_id ?? "");
    const razorpaySignature = String(body.razorpay_signature ?? "");

    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return json({ error: "Missing payment fields" }, 400);
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ error: "Sign in required" }, 401);

    // Only the buyer can complete payment for their own order.
    const { data: order } = await caller
      .from("orders")
      .select("id, buyer_id")
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);

    const expected = await hmacHex(
      keySecret,
      `${razorpayOrderId}|${razorpayPaymentId}`,
    );
    if (expected !== razorpaySignature) {
      return json({ error: "Payment signature is invalid" }, 400);
    }

    const admin = createClient(url, serviceKey);
    const { error } = await admin.rpc("confirm_order_payment", {
      p_order_id: orderId,
      p_provider: "razorpay",
      p_provider_order_id: razorpayOrderId,
      p_provider_payment_id: razorpayPaymentId,
    });
    if (error) {
      console.error("confirm_order_payment", error);
      return json({ error: error.message }, 400);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("razorpay-verify-payment", error);
    return json({ error: String(error) }, 500);
  }
});
