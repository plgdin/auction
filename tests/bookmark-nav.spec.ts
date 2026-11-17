import { expect, test } from "@playwright/test";

test("bookmark navigation follows routes on desktop", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Main Navigation" });
  await expect(nav).toBeVisible();

  const homeButton = nav.getByRole("button", { name: /^Home/ });
  const shopButton = nav.getByRole("button", { name: /^Shop/ });
  const auctionsButton = nav.getByRole("button", { name: /^Auctions/ });

  await expect(homeButton).toHaveAttribute("aria-current", "page");
  await expect(shopButton).toBeVisible();
  await expect(auctionsButton).toBeVisible();

  await nav.hover();
  await shopButton.click();
  await expect(page).toHaveURL(/#\/products$/);
  await expect(shopButton).toHaveAttribute("aria-current", "page");

  await nav.hover();
  await expect(homeButton).not.toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "test-results/bookmark-shop.png" });
});

test("mobile bottom navigation stays available and tracks the current route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav).toBeVisible();

  const homeButton = nav.getByRole("button", { name: "Home" });
  const shopButton = nav.getByRole("button", { name: "Shop" });
  const auctionsButton = nav.getByRole("button", { name: "Auctions" });
  await expect(homeButton).toHaveAttribute("aria-current", "page");
  await expect(shopButton).toBeVisible();
  await expect(auctionsButton).toBeVisible();

  await page.screenshot({ path: "test-results/mobile-bottom-navigation.png" });
  await shopButton.click();
  await expect(page).toHaveURL(/#\/products$/);
  await expect(shopButton).toHaveAttribute("aria-current", "page");
});
