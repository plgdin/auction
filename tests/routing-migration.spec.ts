import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/products",
  "/shop",
  "/product/p-1",
  "/cart",
  "/checkout?product=p-1",
  "/auctions",
  "/auction/a-1",
  "/login",
  "/register",
  "/sell",
  "/sell/new",
  "/seller",
  "/account?tab=orders",
  "/admin",
  "/terms",
  "/privacy",
  "/returns",
  "/auction-terms",
  "/orders/o-1",
  "/payment-failed",
];

test("every migrated route loads on direct access and refresh", async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator(".site-shell")).toBeVisible();
    await expect(page.getByText("off the rail")).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".site-shell")).toBeVisible();
    const expected = route === "/shop" ? "/products" : route.split("?")[0];
    await expect(page).toHaveURL(new RegExp(`${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("legacy hash bookmarks forward to clean URLs", async ({ page }) => {
  await page.goto("/#/products");
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.locator(".site-shell")).toBeVisible();
});

test("browser back and forward preserve clean routing", async ({ page }) => {
  await page.goto("/products");
  await page.goto("/auctions");
  await page.goto("/cart");
  await page.goBack();
  await expect(page).toHaveURL(/\/auctions$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/products$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/auctions$/);
});

test("unknown routes render the 404 page with noindex", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByText("off the rail")).toBeVisible();
  await expect(page).toHaveTitle(/Page not found/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
});

test("product pages get unique SEO metadata", async ({ page }) => {
  await page.goto("/products");
  // Catalog is replaced by an async Supabase query; wait for stable product IDs.
  await page.waitForTimeout(1500);
  const firstProduct = page.locator(".shop-card a[href^='/product/']").first();
  await expect(firstProduct).toBeVisible();
  const href = await firstProduct.getAttribute("href");
  expect(href).toMatch(/^\/product\//);
  await firstProduct.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://lelam.co${href}`);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `https://lelam.co${href}`);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "product");
  const jsonLd = await page.locator('script[type="application/ld+json"]').evaluate((el) => el.textContent || "");
  expect(jsonLd).toContain('"@type":"Product"');
  const title = await page.title();
  expect(title).toContain("| Lelam");
});
