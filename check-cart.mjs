import { chromium } from "@playwright/test";

const base = "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/#/auctions`);
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("lelam-marketplace-v1"));
  db.sessionUserId = "u-buyer";
  localStorage.setItem("lelam-marketplace-v1", JSON.stringify(db));
});
await page.goto(`${base}/#/products`);
await page.reload();
await page.waitForTimeout(2500);
// add first two items to cart
const addBtns = await page.$$(".shop-cart");
for (const b of addBtns.slice(0, 2)) { await b.click(); await page.waitForTimeout(400); }
await page.goto(`${base}/#/cart`);
await page.waitForTimeout(2000);
await page.screenshot({ path: "shots/cart.png" });
const bg = await page.evaluate(() => {
  const item = document.querySelector(".cart-seller-group");
  return item ? getComputedStyle(item).backgroundColor : "none";
});
console.log("cart group bg:", bg);
await browser.close();
