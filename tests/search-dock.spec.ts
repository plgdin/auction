import { test, expect } from "@playwright/test";

test("search dock opens beautifully, filters products, and navigates", async ({ page }) => {
  await page.goto("http://localhost:5173/#/");
  await page.waitForTimeout(500);

  // Click search button
  const searchBtn = page.locator(".lelam-search-toggle");
  await expect(searchBtn).toBeVisible();
  await searchBtn.click();

  // Search overlay should appear centered with vintage styling
  const searchInput = page.getByPlaceholder("Denim, a leather jacket, homeware…");
  await expect(searchInput).toBeVisible();
  await page.waitForTimeout(400);

  // Take screenshot of opened search
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
