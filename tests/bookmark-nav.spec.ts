import { expect, test } from "@playwright/test";

test.describe("Interactive Pull-Down Bookmark Navigation (No Rails / Rods)", () => {
  test("initial tucked state peeks at top edge and pulls down on hover", async ({
    page,
  }) => {
    await page.goto("http://localhost:5173/#/");

    const nav = page.locator('nav[aria-label="Main Navigation"]');
    await expect(nav).toBeVisible();

    const homeBtn = nav.getByRole("menuitem", { name: /home/i });
    const shopBtn = nav.getByRole("menuitem", { name: /shop/i });
    const auctionsBtn = nav.getByRole("menuitem", { name: /auctions/i });

    await expect(homeBtn).toBeVisible();
    await expect(shopBtn).toBeVisible();
    await expect(auctionsBtn).toBeVisible();

    // Verify Home is initially active
    await expect(homeBtn).toHaveAttribute("aria-current", "page");

    // Screenshot tucked initial state
    await page.screenshot({ path: "test-results/tucked-state.png" });

    // Hover over navigation to pull down bookmarks
    await nav.hover();

    // Wait for pull down animation to settle
    await page.waitForTimeout(500);

    // Screenshot pulled-down state
    await page.screenshot({ path: "test-results/pulled-down-state.png" });

    // Click Shop bookmark while pulled down
    await shopBtn.click();
    await expect(page).toHaveURL(/.*#\/products/);

    // After click and navigation, Shop is active and bookmarks retract
    await expect(shopBtn).toHaveAttribute("aria-current", "page");

    // Hover again to pull down on Shop page
    await nav.hover();
    await page.waitForTimeout(500);
    await expect(shopBtn).toHaveAttribute("aria-current", "page");
    await expect(homeBtn).not.toHaveAttribute("aria-current", "page");

    await page.screenshot({ path: "test-results/pulled-down-shop.png" });
  });

  test("mobile view supports tap-to-expand and tap-to-navigate", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("http://localhost:5173/#/");

    const nav = page.locator('nav[aria-label="Main Navigation"]');
    await expect(nav).toBeVisible();

    const homeBtn = nav.getByRole("menuitem", { name: /home/i });
    const shopBtn = nav.getByRole("menuitem", { name: /shop/i });

    // Initial mobile screenshot (tucked)
    await page.screenshot({ path: "test-results/mobile-tucked.png" });

    // Tap to expand
    await homeBtn.click();
    await page.waitForTimeout(500);

    // Screenshot mobile pulled-down state
    await page.screenshot({ path: "test-results/mobile-pulled-down.png" });

    // Tap Shop to navigate
    await shopBtn.click();
    await expect(page).toHaveURL(/.*#\/products/);
  });
});
