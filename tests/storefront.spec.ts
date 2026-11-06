import { expect, test } from "@playwright/test";

test("a one-of-one auction can be found, saved, and added to a persistent bid list", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Outerwear", exact: true }).click();
  await expect(page.locator("#shop .product-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Save The worn-in denim jacket", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View The worn-in denim jacket", exact: true })
    .click();
  const detail = page.getByRole("dialog", { name: "A closer look" });
  await detail
    .getByRole("button", { name: "Add to bid list" })
    .click();
  await expect(
    detail.getByRole("button", { name: "View bid list" }),
  ).toBeVisible();
  await detail.getByRole("button", { name: "View bid list" }).click();
  const bag = page.getByRole("dialog", { name: "Your bid list (1)" });
  await expect(bag.locator(".bag-item")).toHaveCount(1);
  await expect(bag.locator(".subtotal")).toContainText("$64");
  await bag.getByRole("button", { name: "Review bid list" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "no bid will be submitted",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Saved finds, 1 items" }).click();
  await expect(page.getByRole("dialog").locator(".product-card")).toHaveCount(
    1,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open bid list, 1 items" })
    .click();
  await expect(page.getByRole("dialog").locator(".bag-item")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Remove The worn-in denim jacket" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Save or add a live auction here",
  );
});

test("search handles matching and empty results, including product details", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search the archive" }).click();
  const search = page.getByRole("dialog", { name: "Search live auctions" });
  await search.getByRole("textbox", { name: "Search products" }).fill("denim");
  await expect(search.locator(".product-card")).toHaveCount(2);
  await search
    .getByRole("button", { name: "View The worn-in denim jacket", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "A closer look" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "A closer look" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  await expect(search).toBeVisible();
  await search
    .getByRole("textbox", { name: "Search products" })
    .fill("no-such-piece");
  await expect(search).toContainText("No auctions match that search.");
  await search.getByRole("button", { name: "Clear search" }).click();
  await expect(search.locator(".product-card")).toHaveCount(6);
});

test("collections, expanded inventory, and the newsletter preview respond to input", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#shop .product-card")).toHaveCount(4);
  await page.getByRole("button", { name: "View all auctions" }).click();
  await expect(page.locator("#shop .product-card")).toHaveCount(6);
  await page.getByRole("button", { name: /Explore the denim edit/ }).click();
  await expect(page.locator("#shop .product-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Denim", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Your email address").fill("vintage@example.com");
  await page.getByRole("button", { name: /Join the (lelam|Sunday) list/i }).click();
  await expect(page.locator(".newsletter-note")).toContainText(
    "You’re on the preview list!",
  );
});

test("phone navigation and shopping work without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "One-of-one clothes.",
  );
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Live auctions" })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).not.toBeVisible();
  await page
    .locator("#shop .product-card")
    .first()
    .getByRole("button", { name: "Place a bid" })
    .click();
  await page
    .getByRole("button", { name: "Open bid list, 1 items" })
    .click();
  await expect(page.getByRole("dialog").locator(".bag-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  for (const width of [320, 390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
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
