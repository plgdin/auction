import { expect, test } from "@playwright/test";

test("an affiliate link is captured and credits the new signup", async ({ page }) => {
  // The seeded seller is user id "u-seller", so their share code is "useller".
  await page.goto("/?ref=useller");
  await page.waitForSelector(".site-shell");

  // The demo seed starts signed in as the buyer; sign out for this test.
  await page.evaluate(() => {
    const raw = localStorage.getItem("lelam-marketplace-v1");
    if (!raw) return;
    const state = JSON.parse(raw);
    state.sessionUserId = null;
    localStorage.setItem("lelam-marketplace-v1", JSON.stringify(state));
  });

  const email = `referred-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByPlaceholder("Your name").fill("Referred Buyer");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill("password123");
  await page.getByRole("button", { name: /Create account/i }).click();

  await expect(page).toHaveURL(/\/account/);

  const state = await page.evaluate(() => {
    const raw = localStorage.getItem("lelam-marketplace-v1");
    return raw ? JSON.parse(raw) : null;
  });

  expect(state).not.toBeNull();
  const newUser = state.users.find((user: { email: string }) => user.email === email);
  expect(newUser).toBeTruthy();
  expect(newUser.referredBy).toBe("aff-u-seller");

  const click = state.affiliateClicks.find(
    (entry: { code: string; affiliateId: string }) => entry.code === "useller",
  );
  expect(click).toBeTruthy();
  expect(click.affiliateId).toBe("aff-u-seller");
});

test("the account affiliate tab shows a shareable link and stats", async ({ page }) => {
  await page.goto("/account?tab=affiliate");

  await expect(
    page.getByRole("heading", { name: "Share the rail. Earn 5%" }),
  ).toBeVisible();
  await expect(page.locator("#affiliate-link")).toHaveValue(/\?ref=ubuyer$/);
  await expect(page.getByRole("button", { name: /Copy link/i })).toBeVisible();
  await expect(page.getByText("Clicks", { exact: true })).toBeVisible();
  await expect(page.getByText("Signups", { exact: true })).toBeVisible();
  await expect(page.getByText("Paid orders", { exact: true })).toBeVisible();
});

test("earnings unlock only after the return window ends", async ({ page }) => {
  await page.goto("/account?tab=affiliate");
  await expect(page.locator("#affiliate-link")).toHaveValue(/\?ref=ubuyer$/);

  await page.evaluate(() => {
    const raw = localStorage.getItem("lelam-marketplace-v1");
    if (!raw) return;
    const state = JSON.parse(raw);
    const account = state.affiliates.find((item: { userId: string }) => item.userId === "u-buyer");
    state.orders = [
      ...state.orders,
      {
        id: "o-aff-test",
        number: "AFF-TEST",
        buyerId: "u-buyer",
        sellerId: "u-seller",
        status: "delivered",
        paymentStatus: "paid",
        items: [],
        createdAt: new Date().toISOString(),
      },
    ];
    state.affiliateCommissions = [
      ...(state.affiliateCommissions ?? []),
      {
        id: "ac-aff-test",
        affiliateId: account.id,
        orderId: "o-aff-test",
        buyerId: "u-buyer",
        subtotal: 100000,
        rate: account.commissionRate,
        amount: 5000,
        status: "pending",
        returnWindowDays: 7,
        eligibleAt: new Date(Date.now() - 86_400_000).toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem("lelam-marketplace-v1", JSON.stringify(state));
  });

  await page.reload();
  await expect(page.getByText("Return window closed · ready to pay out")).toBeVisible();

  const status = await page.evaluate(() => {
    const raw = localStorage.getItem("lelam-marketplace-v1");
    const state = raw ? JSON.parse(raw) : null;
    return state?.affiliateCommissions.find(
      (entry: { id: string }) => entry.id === "ac-aff-test",
    )?.status;
  });
  expect(status).toBe("approved");
});

test("an admin can create a college link and change its commission", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const raw = localStorage.getItem("lelam-marketplace-v1");
    if (!raw) return;
    const state = JSON.parse(raw);
    state.sessionUserId = "u-admin";
    localStorage.setItem("lelam-marketplace-v1", JSON.stringify(state));
  });
  await page.reload();
  await page.goto("/admin?tab=affiliates");

  await page.getByPlaceholder("Campus Finds Club").fill("Campus Finds");
  await page.getByPlaceholder("hello@college.edu").fill("club@college.edu");
  await page.getByPlaceholder("collegefinds").fill("campusfinds");
  await page.locator("select").selectOption("college");
  await page.getByRole("button", { name: /Create link/i }).click();

  await expect(page.getByText("?ref=campusfinds")).toBeVisible();

  const readAccount = () =>
    page.evaluate(() => {
      const raw = localStorage.getItem("lelam-marketplace-v1");
      const state = raw ? JSON.parse(raw) : null;
      return state?.affiliates?.find(
        (account: { code: string }) => account.code === "campusfinds",
      );
    });

  const created = await readAccount();
  expect(created?.kind).toBe("college");
  expect(created?.commissionRate).toBe(0.05);

  const rate = page.getByLabel("Commission percent for Campus Finds");
  await rate.fill("6");
  await rate.blur();

  await expect
    .poll(async () => (await readAccount())?.commissionRate)
    .toBe(0.06);
});
