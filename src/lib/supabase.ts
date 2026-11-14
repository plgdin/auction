import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // A clear runtime error beats silent local-only behaviour.
  throw new Error(
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const onlinePaymentsEnabled = Boolean(import.meta.env.VITE_RAZORPAY_KEY_ID);

export const PRODUCT_IMAGE_BUCKET = "product-images";
