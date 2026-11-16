import { test, expect } from "@playwright/test";

test("search dock opens with fluid macOS Genie deformation, filters products, and navigates", async ({ page }) => {
  await page.goto("http://localhost:5173/#/");
  await page.waitForTimeout(500);

  // Click search button
  const searchBtn = page.locator(".lelam-search-toggle");
  await expect(searchBtn).toBeVisible();
  await searchBtn.click();

  // Capture early Genie animation frame (funnel pouring out of button)
  await page.waitForTimeout(110);
  await page.screenshot({ path: "test-results/search-genie-open-early.png" });

  // Capture mid-Genie animation frame (trumpet bell flaring into center)
  await page.waitForTimeout(110);
  await page.screenshot({ path: "test-results/search-genie-open-mid.png" });

  // Wait for full Genie animation to settle and modal to become interactive
  await page.waitForTimeout(400);
  await page.evaluate(() => document.fonts.ready);

  // Search input should be visible and interactive
  const searchInput = page.getByPlaceholder("Denim, a leather jacket, homeware…");
  await expect(searchInput).toBeVisible();

  // Take screenshot of fully opened search
  await page.screenshot({ path: "test-results/search-opened.png" });

  // Type "denim"
  await searchInput.fill("denim");
  await page.waitForTimeout(300);

  // Take screenshot with query results
  await page.screenshot({ path: "test-results/search-query-denim.png" });

  // Click on "The worn-in denim jacket"
  const resultItem = page.getByRole("button", { name: /The worn-in denim jacket/i });
  await expect(resultItem).toBeVisible();
  await resultItem.click();

  // Check URL navigated to product
  await expect(page).toHaveURL(/#\/product\/p-1/);
});
