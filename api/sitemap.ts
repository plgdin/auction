import { buildSitemap, type SitemapType } from "./lib/sitemap";

const TYPES: SitemapType[] = ["index", "static", "categories", "products", "auctions"];

/** Vercel function: live sitemap index and children built from Supabase. */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const requested = new URL(request.url).searchParams.get("type") || "index";
  if (!TYPES.includes(requested as SitemapType)) {
    return new Response("Not Found", { status: 404 });
  }

  const xml = await buildSitemap(requested as SitemapType);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
