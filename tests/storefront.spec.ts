import { expect, test } from "@playwright/test";

test("a one-of-one piece can be saved and added to a persistent cart", async ({
  page,
}) => {
  await page.goto("/#/products");
  const jacket = page.locator(".shop-card").filter({
    has: page.getByRole("link", { name: "The worn-in denim jacket" }),
  });
  await expect(jacket).toBeVisible();
  await jacket
    .getByRole("button", { name: "Save The worn-in denim jacket" })
    .click();
  await expect(
    jacket.getByRole("button", { name: "Unsave The worn-in denim jacket" }),
  ).toHaveAttribute("aria-pressed", "true");
  await jacket
    .getByRole("button", { name: "Add The worn-in denim jacket to cart" })
    .click();

  await page.goto("/#/cart");
  await expect(page.locator(".cart-item")).toHaveCount(1);
  await expect(page.locator(".cart-item")).toContainText(
    "The worn-in denim jacket",
  );

  await page.reload();
  await expect(page.locator(".cart-item")).toHaveCount(1);
});

test("search finds products, handles empty results, and opens product details", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search listings" }).click();

  const searchInput = page.getByRole("textbox", { name: "Search listings" });
  await expect(searchInput).toBeVisible();
  await searchInput.fill("denim");
  const result = page.getByRole("button", {
    name: /The worn-in denim jacket/,
  });
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(/#\/product\/p-1$/);
  await expect(
    page.getByRole("heading", { name: "The worn-in denim jacket" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Purchase options" }),
  ).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Search listings" }).click();
  await page
    .getByRole("textbox", { name: "Search listings" })
    .fill("no-such-piece");
  await expect(page.getByText(/Nothing matched/)).toBeVisible();
});

test("Shop shows a two-column mobile grid and an accessible filter dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/products");

  const grid = page.locator(".shop-grid");
  await expect(grid).toHaveClass(/is-grid/);
  await expect(grid.locator(".shop-card")).toHaveCount(9);
  await expect
    .poll(() =>
      grid.evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      ),
    )
    .toBe(2);

  await page.getByRole("button", { name: "Filters" }).click();
  const filters = page.locator('.shop-filters[role="dialog"]');
  await expect(filters).toBeVisible();
  await expect(
    filters.getByRole("heading", { name: "Filter pieces" }),
  ).toBeVisible();
  await filters.locator(".shop-filter-close").click();
  await expect(filters).not.toBeVisible();
});

test("mobile navigation, product and cart flows work without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  const mobileNav = page.getByRole("navigation", {
    name: "Main navigation",
  });
  await expect(mobileNav).toBeVisible();
  await mobileNav.getByRole("button", { name: "Shop" }).click();
  await expect(page).toHaveURL(/#\/products$/);

  const firstCard = page.locator(".shop-card").first();
  await firstCard.getByRole("link", { name: /^View / }).click();
  await expect(page).toHaveURL(/#\/product\/p-\d+$/);
  await page
    .getByRole("region", { name: "Purchase options" })
    .getByRole("button", { name: "Add to cart" })
    .click();
  await page.goto("/#/cart");
  await expect(page.locator(".cart-item")).toHaveCount(1);

  for (const width of [320, 390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  expect(errors).toEqual([]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.images).every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
});
