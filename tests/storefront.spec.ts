import { expect, test } from "@playwright/test";

// These checks assume the Supabase migration may not have run yet, so they
// only assert on chrome and copy that does not depend on seeded data.

test("the marketplace shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/lelam/i);
  await expect(page.getByRole("link", { name: /shop/i }).first()).toBeVisible();
});

test("the catalog route renders its heading", async ({ page }) => {
  await page.goto("/#/products");
  await expect(page.getByRole("heading", { name: /shop all/i })).toBeVisible();
});

test("the sign-in page has no demo accounts", async ({ page }) => {
  await page.goto("/#/login");
  await expect(page.getByRole("heading", { name: /good to see you/i })).toBeVisible();
  await expect(page.getByText(/try a demo account/i)).toHaveCount(0);
});

test("selling requires an account", async ({ page }) => {
  await page.goto("/#/sell");
  await expect(page.getByRole("heading", { name: /sign in to sell/i })).toBeVisible();
});
