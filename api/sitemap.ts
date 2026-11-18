/**
 * Vercel function: live sitemap index and children built from Supabase.
 *
 * Node handler signature + lazy import so a data/SEO failure degrades to a
 * valid (if minimal) sitemap instead of a 500.
 */
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }

  const origin = `https://${req.headers?.host ?? "lelam.co"}`;
  const url = new URL(req.url || "/", origin);
  const requested = url.searchParams.get("type") || "index";

  try {
    const { buildSitemap } = await import("./lib/sitemap");
    const types = ["index", "static", "categories", "products", "auctions"];
    if (!types.includes(requested)) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    const xml = await buildSitemap(requested as Parameters<typeof buildSitemap>[0]);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");
    res.end(xml);
  } catch (error) {
    console.error("[api/sitemap] falling back to minimal sitemap:", error);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      `${XML_HEADER}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://lelam.co/</loc></url></urlset>`,
    );
  }
}
