// Razorpay webhook. Closes the loop when the buyer's tab dies before
// razorpay-verify-payment runs, and records failures/refunds.
//
// Deploy with: supabase functions deploy razorpay-webhook --no-verify-jwt
// Secrets: RAZORPAY_WEBHOOK_SECRET (the same secret configured in the
// Razorpay dashboard), SUPABASE_SERVICE_ROLE_KEY (provided by Supabase).
import { createClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/cors.ts";

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
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) return json({ error: "Webhook is not configured" }, 503);

  // The signature covers the raw body byte-for-byte, so read it before parsing.
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = await hmacHex(secret, body);
  if (expected !== signature) {
    return json({ error: "Invalid webhook signature" }, 401);
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(body);
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const payment = event?.payload?.payment?.entity as Record<string, any> | undefined;
  const refund = event?.payload?.refund?.entity as Record<string, any> | undefined;

  try {
    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        const providerOrderId: string | undefined =
          payment?.order_id ?? refund?.order_id;
        if (!providerOrderId) return json({ ignored: true });

        const providerPaymentId: string | undefined =
          payment?.id ?? refund?.payment_id;
        if (!providerPaymentId) return json({ ignored: true });

        const { data: rows } = await admin
          .from("payments")
          .select("order_id")
          .eq("provider_order_id", providerOrderId)
          .limit(1);

        const orderId: string | undefined =
          payment?.notes?.order_id ?? rows?.[0]?.order_id;
        if (!orderId) return json({ ignored: true });

        const { error } = await admin.rpc("confirm_order_payment", {
          p_order_id: orderId,
          p_provider: "razorpay",
          p_provider_order_id: providerOrderId,
          p_provider_payment_id: providerPaymentId,
        });
        if (error) {
          // Returning 500 makes Razorpay retry the delivery.
          console.error("confirm_order_payment", error);
          return json({ error: error.message }, 500);
        }
        return json({ ok: true });
      }

      case "payment.failed": {
        if (payment?.order_id) {
          await admin
            .from("payments")
            .update({ status: "failed" })
            .eq("provider_order_id", payment.order_id)
            .in("status", ["created", "authorized"]);
        }
        return json({ ok: true });
      }

      case "refund.processed":
      case "refund.created": {
        const providerPaymentId: string | undefined =
          refund?.payment_id ?? payment?.id;
        if (!providerPaymentId) return json({ ignored: true });

        const { data: rows } = await admin
          .from("payments")
          .select("order_id")
          .eq("provider_payment_id", providerPaymentId)
          .limit(1);

        await admin
          .from("payments")
          .update({ status: "refunded" })
          .eq("provider_payment_id", providerPaymentId);

        const orderId: string | undefined = rows?.[0]?.order_id;
        if (orderId) {
          await admin
            .from("orders")
            .update({ payment_status: "refunded" })
            .eq("id", orderId);
        }
        return json({ ok: true });
      }

      default:
        return json({ ignored: true });
    }
  } catch (error) {
    console.error("razorpay-webhook", error);
    return json({ error: String(error) }, 500);
  }
});
