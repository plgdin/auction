import { supabase } from "./supabase";

type PaymentInput = { orderId: string } | { checkoutGroupId: string };

function loadRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load secure payment checkout."));
    document.body.appendChild(script);
  });
}

export async function payWithRazorpay(input: PaymentInput, prefill?: { name?: string; email?: string; contact?: string }) {
  const { data: created, error: createError } = await supabase.functions.invoke("razorpay-create-order", {
    body: input,
  });
  if (createError) throw new Error(createError.message);
  if (!created?.razorpayOrderId || !created?.keyId || !Number.isSafeInteger(created.amountPaise)) {
    throw new Error(created?.error || "Could not start payment.");
  }
  await loadRazorpay();

  return new Promise<void>((resolve, reject) => {
    const checkout = new (window as any).Razorpay({
      key: created.keyId,
      amount: created.amountPaise,
      currency: "INR",
      name: "lelam.co",
      description: `Order ${created.orderNumber}`,
      order_id: created.razorpayOrderId,
      prefill,
      theme: { color: "#5d6446" },
      handler: async (response: Record<string, string>) => {
        const { error } = await supabase.functions.invoke("razorpay-verify-payment", {
          body: { ...input, ...response },
        });
        if (error) reject(new Error(error.message));
        else resolve();
      },
      modal: { ondismiss: () => reject(new Error("Payment was cancelled. Your order is still awaiting payment.")) },
    });
    checkout.on("payment.failed", (event: any) => {
      reject(new Error(event?.error?.description || "Payment failed. Please try again."));
    });
    checkout.open();
  });
}
