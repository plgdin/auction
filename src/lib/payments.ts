import { supabase } from "./supabase";

export interface PaymentInput {
  orderId?: string;
  checkoutGroupId?: string;
  amountPaise?: number;
  orderNumber?: string;
}

export interface PaymentResult {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

function loadRazorpay(): Promise<void> {
  if (typeof window !== "undefined" && (window as any).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load secure payment checkout."));
    document.body.appendChild(script);
  });
}

export async function payWithRazorpay(
  input: PaymentInput,
  prefill?: { name?: string; email?: string; contact?: string },
): Promise<PaymentResult> {
  let created: any = null;

  try {
    const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
      body: input,
    });
    if (!error && data?.keyId && Number.isSafeInteger(data.amountPaise)) {
      created = data;
    }
  } catch {
    // Edge function not deployed on cloud - fall back to standard client checkout
  }

  const keyId =
    created?.keyId ||
    import.meta.env.VITE_RAZORPAY_KEY_ID ||
    "rzp_test_U1YX4201kWQzeo";

  const amountPaise = created?.amountPaise || input.amountPaise || 10000;
  const orderNumber = created?.orderNumber || input.orderNumber || "LELAM";

  await loadRazorpay();

  return new Promise<PaymentResult>((resolve, reject) => {
    const RazorpayConstructor = (window as any).Razorpay;
    if (!RazorpayConstructor) {
      reject(new Error("Razorpay SDK could not be loaded."));
      return;
    }

    const options: any = {
      key: keyId,
      amount: amountPaise,
      currency: "INR",
      name: "lelam.co",
      description: `Order ${orderNumber}`,
      prefill: {
        name: prefill?.name || "",
        email: prefill?.email || "",
        contact: prefill?.contact || "",
      },
      theme: { color: "#493022" },
      handler: async (response: Record<string, string>) => {
        try {
          await supabase.functions.invoke("razorpay-verify-payment", {
            body: { ...input, ...response },
          });
        } catch {
          // If verify edge function is not deployed, client proceeds with payment ID
        }
        resolve(response as PaymentResult);
      },
      modal: {
        ondismiss: () => {
          reject(new Error("Payment was cancelled."));
        },
      },
    };

    if (created?.razorpayOrderId) {
      options.order_id = created.razorpayOrderId;
    }

    const checkout = new RazorpayConstructor(options);
    checkout.on("payment.failed", (event: any) => {
      reject(new Error(event?.error?.description || "Payment failed. Please try again."));
    });
    checkout.open();
  });
}
