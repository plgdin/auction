import { test, expect } from "@playwright/test";

test("search dock opens with macOS Genie transition, filters products, and navigates", async ({ page }) => {
  await page.goto("http://localhost:5173/#/");
  await page.waitForTimeout(500);

  // Click search button
  const searchBtn = page.locator(".lelam-search-toggle");
  await expect(searchBtn).toBeVisible();
  await searchBtn.click();

  // Capture early Genie animation frame
  await page.waitForTimeout(80);
  await page.screenshot({ path: "test-results/search-genie-early.png" });

  // Capture mid-Genie animation frame
  await page.waitForTimeout(140);
  await page.screenshot({ path: "test-results/search-genie-mid.png" });

  // Wait for full Genie animation to complete and modal to be interactive
  await page.waitForTimeout(400);
  await page.evaluate(() => document.fonts.ready);

  // Search input should be visible
  const searchInput = page.getByPlaceholder("Denim, a leather jacket, homeware…");
  await expect(searchInput).toBeVisible();

  const cardHeight = await page.evaluate(() => {
    const el = document.querySelector(".search-modal-card") || document.querySelector("input")?.closest(".rounded-3xl");
    return el ? el.getBoundingClientRect().height : 0;
  });
  console.log("ACTUAL CARD HEIGHT IS:", cardHeight);

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
