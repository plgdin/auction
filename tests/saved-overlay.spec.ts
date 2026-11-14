import { test, expect } from "@playwright/test";

test("saved overlay opens with vintage scrapbook drawer styling", async ({ page }) => {
  await page.goto("http://localhost:5173/#/");
  await page.waitForTimeout(500);

  // Click saved (heart) button
  const savedBtn = page.locator(".lelam-save-toggle");
  await expect(savedBtn).toBeVisible();
  await savedBtn.click();

  // Wait for fonts & drawer animation
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  // Expect "saved finds" drawer title
  await expect(page.getByRole("heading", { name: "saved finds" })).toBeVisible();

  // Take screenshot of saved drawer
  await page.screenshot({ path: "test-results/saved-drawer.png" });

  // If there are remove buttons, remove all items to test empty state
  const removeButtons = page.locator('button[aria-label^="Remove "]');
  const count = await removeButtons.count();
  for (let i = 0; i < count; i++) {
    await page.locator('button[aria-label^="Remove "]').first().click();
    await page.waitForTimeout(200);
  }

  // Now expect "Nothing saved yet."
  await expect(page.getByText("Nothing saved yet.")).toBeVisible();
  await page.waitForTimeout(300);

  // Take screenshot of empty saved drawer
  await page.screenshot({ path: "test-results/saved-empty.png" });
});
