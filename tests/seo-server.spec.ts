import { expect, test } from "@playwright/test";
import { buildAuctionSitemap, buildProductSitemap } from "../server/lib/sitemap";
import renderFunction from "../server/render";
import sitemapFunction from "../server/sitemap";

/** Invoke a Vercel-style Node handler with a minimal request/response pair. */
async function callApi(
  handler: (req: unknown, res: unknown) => Promise<void>,
  url: string,
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const state = { body: "", headers: {} as Record<string, string> };
  const res = {
    statusCode: 200,
    setHeader: (key: string, value: string) => {
      state.headers[key] = value;
    },
    end: (body?: string) => {
      state.body = body ?? "";
    },
  };
  await handler({ method: "GET", url, headers: { host: "lelam.co" } }, res);
  return { status: res.statusCode, body: state.body, headers: state.headers };
}

function meta(html: string, attribute: "name" | "property", key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<meta ${attribute}="${escaped}" content="([^"]*)"`))?.[1];
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

test("product metadata exists in the initial server HTML", async ({ request }) => {
  const response = await request.get("/product/p-1");
  expect(response.status()).toBe(200);
  const html = await response.text();

  expect(html).toContain("<title>The worn-in denim jacket");
  expect(count(html, 'property="og:title"')).toBe(1);
  expect(count(html, 'rel="canonical"')).toBe(1);
  expect(html).not.toContain("Lelam — Pre-Loved Fashion &amp; Surprise Auctions</title>");
});

test("auction metadata exists in the initial server HTML", async ({ request }) => {
  const response = await request.get("/auction/a-1");
  expect(response.status()).toBe(200);
  const html = await response.text();

  expect(html).toContain("<title>The worn-in denim jacket · Live Auction | Lelam</title>");
  expect(meta(html, "property", "og:type")).toBe("product");
  expect(meta(html, "name", "robots")).toBe("index, follow");
});

test("WhatsApp-compatible Open Graph previews are complete", async ({ request }) => {
  for (const path of ["/product/p-1", "/auction/a-1"]) {
    const html = await (await request.get(path)).text();
    expect(meta(html, "property", "og:title")).toBeTruthy();
    expect(meta(html, "property", "og:description")).toBeTruthy();
    expect(meta(html, "property", "og:url")).toBe(`https://lelam.co${path}`);
    expect(meta(html, "property", "og:type")).toBe("product");
    expect(meta(html, "property", "og:image")).toMatch(/^https:\/\/lelam\.co\/.+/);
    expect(meta(html, "property", "og:site_name")).toBe("lelam.co");
  }
});

test("Twitter Card metadata is present on shareable pages", async ({ request }) => {
  for (const path of ["/product/p-1", "/auction/a-1", "/products", "/auctions"]) {
    const html = await (await request.get(path)).text();
    expect(meta(html, "name", "twitter:card")).toBe("summary_large_image");
    expect(meta(html, "name", "twitter:title")).toBeTruthy();
    expect(meta(html, "name", "twitter:description")).toBeTruthy();
    expect(meta(html, "name", "twitter:image")).toMatch(/^https:\/\/lelam\.co\/.+/);
  }
});

test("canonical URLs are correct for detail, category and listing pages", async ({ request }) => {
  const cases: Array<[string, string]> = [
    ["/product/p-1", "https://lelam.co/product/p-1"],
    ["/auction/a-1", "https://lelam.co/auction/a-1"],
    ["/products", "https://lelam.co/products"],
    ["/products?category=Women", "https://lelam.co/products?category=Women"],
    ["/auctions", "https://lelam.co/auctions"],
  ];
  for (const [path, canonical] of cases) {
    const html = await (await request.get(path)).text();
    expect(html).toContain(`<link rel="canonical" href="${canonical}" />`);
  }
});

test("product and auction JSON-LD are server-rendered", async ({ request }) => {
  for (const path of ["/product/p-1", "/auction/a-1"]) {
    const html = await (await request.get(path)).text();
    const json = html.match(
      /<script id="lelam-seo-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )?.[1];
    expect(json).toBeTruthy();
    expect(JSON.parse(json!)).toMatchObject({ "@context": "https://schema.org", "@type": "Product" });
  }
});

test("dynamic sitemap includes newly published public listings", () => {
  const xml = buildProductSitemap([
    { id: "new-public-listing", created_at: "2026-11-18T10:00:00Z" },
  ]);
  expect(xml).toContain("https://lelam.co/product/new-public-listing");
  expect(xml).toContain("<lastmod>2026-11-18</lastmod>");

  const auctionXml = buildAuctionSitemap([
    { id: "new-auction", ends_at: "2026-11-19T10:00:00Z", created_at: "2026-11-18T10:00:00Z" },
  ]);
  expect(auctionXml).toContain("https://lelam.co/auction/new-auction");
});

test("dynamic sitemap serves live listings and excludes sold seed listings", async ({ request }) => {
  const xml = await (await request.get("/sitemap-products.xml")).text();
  expect(xml).toContain("<urlset");
  expect(xml).toContain("https://lelam.co/product/");
  expect(xml).not.toContain("https://lelam.co/product/p-6"); // sold demo listing
  expect(xml).not.toContain("/cart");
  expect(xml).not.toContain("/account");
  expect(xml).not.toContain("/admin");

  const index = await (await request.get("/sitemap.xml")).text();
  expect(index).toContain("<sitemapindex");
  expect(index).toContain("/sitemap-products.xml");
});

test("nonexistent products return HTTP 404 with noindex", async ({ request }) => {
  const response = await request.get("/product/00000000-0000-0000-0000-000000000000");
  expect(response.status()).toBe(404);
  const html = await response.text();
  expect(html).toContain("Page not found | Lelam");
  expect(meta(html, "name", "robots")).toBe("noindex, follow");
});

test("nonexistent auctions return HTTP 404", async ({ request }) => {
  const response = await request.get("/auction/00000000-0000-0000-0000-000000000000");
  expect(response.status()).toBe(404);
  expect(await response.text()).toContain("Page not found | Lelam");
});

test("unknown public routes return HTTP 404", async ({ request }) => {
  const response = await request.get("/this-route-does-not-exist");
  expect(response.status()).toBe(404);
  expect(await response.text()).toContain("Page not found | Lelam");
});

test("legacy order notification URLs redirect to the clean plural route", async ({ request, page }) => {
  const direct = await request.get("/order/o-1", { maxRedirects: 0 });
  expect([301, 308]).toContain(direct.status());
  expect(direct.headers()["location"]).toBe("/orders/o-1");

  await page.goto("/#/order/o-1");
  await expect(page).toHaveURL(/\/orders\/o-1$/);
});

test("authentication and checkout pages still render", async ({ page, request }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible();

  const checkout = await request.get("/checkout?product=p-1");
  expect(checkout.status()).toBe(200);
  expect(await checkout.text()).toContain('<div id="root">');
});

test("client hydration keeps the server-rendered JSON-LD", async ({ page }) => {
  await page.goto("/auction/a-1");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    /Live Auction \| Lelam/,
  );
});

test("Vercel functions serve the built shell with route metadata", async () => {
  const product = await callApi(renderFunction, "/api/render?path=/product/p-1");
  expect(product.status).toBe(200);
  expect(product.body).toContain("/assets/app.js");
  expect(product.body).toContain("The worn-in denim jacket");

  const missing = await callApi(renderFunction, "/api/render?path=/product/does-not-exist");
  expect(missing.status).toBe(404);

  const map = await callApi(sitemapFunction, "/api/sitemap?type=index");
  expect(map.status).toBe(200);
  expect(map.body).toContain("<sitemapindex");
});

test("static assets, robots and API paths remain unaffected", async ({ request }) => {
  const image = await request.get("/images/auction.svg");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/svg+xml");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap: https://lelam.co/sitemap.xml");
});
