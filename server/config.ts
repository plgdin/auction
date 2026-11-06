import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function required(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const config = {
  port: Number(process.env.PORT || 8787),
  isProduction: process.env.NODE_ENV === "production",
  authSecret: required("AUTH_SECRET", "lelam-local-dev-secret-change-before-deploy"),
  supabaseUrl: required("VITE_SUPABASE_URL"),
  supabaseAnonKey: required("VITE_SUPABASE_ANON_KEY"),
  razorpayKeyId: required("RAZORPAY_KEY_ID", required("VITE_RAZORPAY_KEY_ID")),
  razorpayKeySecret: required("RAZORPAY_KEY_SECRET"),
  pgliteDir: required("PGLITE_DIR", path.resolve(process.cwd(), ".data", "pglite")),
  uploadsDir: required("UPLOADS_DIR", path.resolve(process.cwd(), "uploads")),
  appUrl: required("APP_URL", "http://localhost:5173"),
  serviceablePrefixes: ["695"],
  demoSeed: process.env.SEED_DEMO !== "false",
};

export const hasRazorpay = Boolean(config.razorpayKeyId && config.razorpayKeySecret);

if (!config.isProduction && config.authSecret.includes("change-before-deploy")) {
  console.warn("[config] Using development AUTH_SECRET. Set AUTH_SECRET before deploying.");
}
