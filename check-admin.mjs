import { chromium } from "@playwright/test";

const base = "http://localhost:5174";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/auctions`);
await page.waitForTimeout(2000);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("lelam-marketplace-v1"));
  db.sessionUserId = "u-admin";
  localStorage.setItem("lelam-marketplace-v1", JSON.stringify(db));
});
await page.goto(`${base}/admin?tab=listings`);
await page.reload();
await page.waitForTimeout(2500);
await page.screenshot({ path: "shots/admin-listings.png" });
await page.goto(`${base}/admin?tab=overview`);
await page.waitForTimeout(2000);
await page.screenshot({ path: "shots/admin-overview.png" });
// mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/admin?tab=listings`);
await page.waitForTimeout(2000);
await page.screenshot({ path: "shots/admin-listings-mobile.png" });
await browser.close();
console.log("done");
