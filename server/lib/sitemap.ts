import { CATEGORIES } from "../../src/lib/categories";
import {
  listPublicAuctions,
  listPublicProducts,
  type SitemapAuction,
  type SitemapProduct,
} from "./data";
import { SITE_URL } from "./meta";

export type SitemapType = "index" | "static" | "categories" | "products" | "auctions";

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function lastmod(value?: string | null): string {
  if (!value) return today();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? today() : date.toISOString().slice(0, 10);
}

function urlSet(entries: Array<{ loc: string; lastmod?: string }>): string {
  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    if (seen.has(entry.loc)) return false;
    seen.add(entry.loc);
    return true;
  });
  return [
    XML_HEADER,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...unique.map(
      (entry) =>
        `  <url><loc>${esc(entry.loc)}</loc><lastmod>${esc(entry.lastmod ?? today())}</lastmod></url>`,
    ),
    "</urlset>",
  ].join("\n");
}

const STATIC_PATHS = [
  "/",
  "/sell",
  "/terms",
  "/privacy",
  "/returns",
  "/auction-terms",
];

/** Sitemap index + children. Listings are read live from Supabase at request time. */
export async function buildSitemap(type: SitemapType): Promise<string> {
  if (type === "index") {
    const children = ["static", "categories", "products", "auctions"];
    return [
      XML_HEADER,
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...children.map(
        (child) =>
          `  <sitemap><loc>${SITE_URL}/sitemap-${child}.xml</loc><lastmod>${today()}</lastmod></sitemap>`,
      ),
      "</sitemapindex>",
    ].join("\n");
  }

  if (type === "static") {
    return urlSet(STATIC_PATHS.map((path) => ({ loc: `${SITE_URL}${path}` })));
  }

  if (type === "categories") {
    return urlSet(
      CATEGORIES.map((category) => ({
        loc: `${SITE_URL}/products?category=${encodeURIComponent(category)}`,
      })),
    );
  }

  if (type === "products") {
    return buildProductSitemap(await listPublicProducts());
  }

  return buildAuctionSitemap(await listPublicAuctions());
}

export function buildProductSitemap(products: SitemapProduct[]): string {
  return urlSet(
    products.map((product) => ({
      loc: `${SITE_URL}/product/${encodeURIComponent(product.id)}`,
      lastmod: lastmod(product.created_at),
    })),
  );
}

export function buildAuctionSitemap(auctions: SitemapAuction[]): string {
  return urlSet(
    auctions.map((auction) => ({
      loc: `${SITE_URL}/auction/${encodeURIComponent(auction.id)}`,
      lastmod: lastmod(auction.ends_at ?? auction.created_at),
    })),
  );
}
