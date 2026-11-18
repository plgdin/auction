/**
 * Server-side public listing access for SEO and sitemaps.
 * Uses the anon key (RLS-protected public views) and falls back to the bundled
 * demo catalogue so local dev / previews work without a database.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { createSeedDatabase } from "../../src/lib/seed";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(4000)
    : undefined;
}

export interface PublicProductRow {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  condition: string | null;
  size: string | null;
  seller_name: string | null;
  asking_price: number | null;
  images: string[] | null;
  status: string | null;
  category: string | null;
  created_at: string | null;
}

export interface PublicAuctionRow {
  id: string;
  product_id: string;
  status: string;
  starting_price_paise: number | null;
  current_bid_paise: number | null;
  created_at: string | null;
  ends_at: string | null;
}

function isPublicStatus(status?: string | null): boolean {
  return status === "active" || status === "reserved";
}

function seedProductRow(id: string): PublicProductRow | null {
  const product = createSeedDatabase().products.find(
    (item) => item.id === id && isPublicStatus(item.status),
  );
  if (!product) return null;
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    brand: product.brand ?? null,
    condition: product.condition ?? null,
    size: product.size ?? null,
    seller_name: product.sellerName ?? null,
    asking_price: product.askingPrice,
    images: product.images,
    status: product.status,
    category: product.category,
    created_at: product.createdAt,
  };
}

function seedAuctionRow(id: string): PublicAuctionRow | null {
  const auction = createSeedDatabase().auctions.find((item) => item.id === id);
  if (!auction) return null;
  return {
    id: auction.id,
    product_id: auction.productId,
    status: auction.status,
    starting_price_paise: auction.startingPrice,
    current_bid_paise: auction.currentBid ?? null,
    created_at: auction.createdAt,
    ends_at: auction.endsAt,
  };
}

export async function getPublicProduct(id: string): Promise<PublicProductRow | null> {
  if (!id) return null;
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("public_products")
        .select(
          "id,title,description,brand,condition,size,seller_name,asking_price,images,status,category,created_at",
        )
        .eq("id", id)
        .maybeSingle()
        .abortSignal(timeoutSignal());
      if (!error && data) return data as unknown as PublicProductRow;
    } catch {
      // Invalid/non-UUID ids and offline databases fall through to seed data.
    }
  }
  return seedProductRow(id);
}

export async function getPublicAuction(id: string): Promise<PublicAuctionRow | null> {
  if (!id) return null;
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select("id,product_id,status,starting_price_paise,current_bid_paise,created_at,ends_at")
        .eq("id", id)
        .maybeSingle()
        .abortSignal(timeoutSignal());
      if (!error && data) return data as unknown as PublicAuctionRow;
    } catch {
      // Fall through to seed data.
    }
  }
  return seedAuctionRow(id);
}

export interface SitemapProduct {
  id: string;
  created_at: string | null;
}

export interface SitemapAuction {
  id: string;
  ends_at: string | null;
  created_at: string | null;
}

export async function listPublicProducts(): Promise<SitemapProduct[]> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("public_products")
        .select("id,created_at")
        .order("created_at", { ascending: false })
        .abortSignal(timeoutSignal());
      if (!error && Array.isArray(data)) {
        return data.map((row) => ({ id: row.id, created_at: row.created_at ?? null }));
      }
    } catch {
      // Fall through to seed data.
    }
  }
  return createSeedDatabase()
    .products.filter((product) => isPublicStatus(product.status))
    .map((product) => ({
      id: product.id,
      created_at: product.createdAt,
    }));
}

export async function listPublicAuctions(): Promise<SitemapAuction[]> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select("id,status,ends_at,created_at")
        .in("status", ["live", "scheduled"])
        .order("created_at", { ascending: false })
        .abortSignal(timeoutSignal());
      if (!error && Array.isArray(data)) {
        return data.map((row) => ({
          id: row.id,
          ends_at: row.ends_at ?? null,
          created_at: row.created_at ?? null,
        }));
      }
    } catch {
      // Fall through to seed data.
    }
  }
  return createSeedDatabase()
    .auctions.filter((auction) => auction.status === "live" || auction.status === "scheduled")
    .map((auction) => ({
      id: auction.id,
      ends_at: auction.endsAt,
      created_at: auction.createdAt,
    }));
}
