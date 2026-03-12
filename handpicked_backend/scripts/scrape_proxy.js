// scrape_proxy_playwright.js
import path from "path";
import { chromium } from "playwright";
import ExcelJS from "exceljs";

const START_URL = "https://proxy.coupons/stores";
const OUTPUT_DIR = process.cwd();
const CONCURRENT_PAGES = 3;

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  /* ============ XLSX ============ */

  const storesWB = new ExcelJS.Workbook();
  const storesWS = storesWB.addWorksheet("stores");
  storesWS.columns = [
    { header: "store_name", key: "store_name", width: 40 },
    { header: "store_url", key: "store_url", width: 80 },
    { header: "store_category", key: "store_category", width: 20 },
    { header: "store_subcategory", key: "store_subcategory", width: 20 },
    { header: "logo_url", key: "logo_url", width: 80 },
  ];

  const couponsWB = new ExcelJS.Workbook();
  const couponsWS = couponsWB.addWorksheet("coupons");
  couponsWS.columns = [
    { header: "store_name", key: "store_name", width: 40 },
    { header: "type", key: "type", width: 10 },
    { header: "title", key: "title", width: 80 },
    { header: "description", key: "description", width: 120 },
    { header: "discount", key: "discount", width: 20 },
    { header: "coupon_code", key: "coupon_code", width: 20 },
  ];

  /* ============ LISTING PAGE ============ */

  console.log("Loading listing page...");
  await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(
    ".store-a.store-listing-box a.store-thumb, .store-popular-listing a.store-thumb",
    { timeout: 30000 },
  );

  const urls = await page.$$eval(
    ".store-a.store-listing-box a.store-thumb, .store-popular-listing a.store-thumb",
    (els) => [...new Set(els.map((e) => e.href))],
  );

  console.log(`Collected ${urls.length} store URLs\n`);

  /* ============ WORKERS ============ */

  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= urls.length) break;

      const url = urls[i];
      const p = await context.newPage();
      console.log(`[${i + 1}/${urls.length}] ${url}`);

      try {
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await p.waitForSelector(".coupon-item", { timeout: 15000 });

        /* ---- STORE DATA ---- */

        const store_name = await p.$eval(
          ".breadcrumbs [property='itemListElement']:nth-child(2) [property='name']",
          (el) => el.textContent.trim(),
        );

        const logo_url = await p
          .$eval(".store-header > img", (el) => el.src)
          .catch(() => "");

        const store_url = await p
          .$eval(".header-store-thumb a[rel='nofollow']", (el) => el.href)
          .catch(() => "");

        storesWS.addRow({
          store_name,
          store_url,
          store_category: "",
          store_subcategory: "",
          logo_url,
        });

        /* ---- COUPONS + DEALS ---- */

        const items = await p.$$eval(".coupon-item", (boxes) =>
          boxes
            .map((box) => {
              // Determine type based on class
              const isCoupon = box.classList.contains("c-type-code");
              const isDeal = !isCoupon; // If not code, it's a deal

              // Get title
              const titleEl = box.querySelector(
                ".coupon-title a, .coupon-title",
              );
              const title = titleEl?.innerText?.trim() || "";
              if (!title) return null;

              // Get description (empty in this structure)
              const description =
                box.querySelector(".coupon-des-ellip")?.innerText?.trim() || "";

              // Get discount/expiry info
              const discount =
                box.querySelector(".c-type .exp")?.innerText?.trim() || "";

              // Get coupon code from .coupon-detail section
              let coupon_code = "";
              if (isCoupon) {
                const codeText = box.querySelector(".coupon-detail .code-text");
                coupon_code = codeText?.innerText?.trim() || "";
              }

              return {
                type: isCoupon ? "coupon" : "deal",
                title,
                description,
                discount,
                coupon_code,
              };
            })
            .filter(Boolean),
        );

        for (const item of items) {
          couponsWS.addRow({ store_name, ...item });
        }

        console.log(`  ✓ ${store_name} | ${items.length} offers`);
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
      } finally {
        await p.close();
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENT_PAGES, urls.length) }, worker),
  );

  /* ============ SAVE ============ */

  await storesWB.xlsx.writeFile(path.join(OUTPUT_DIR, "stores.xlsx"));
  await couponsWB.xlsx.writeFile(path.join(OUTPUT_DIR, "coupons.xlsx"));

  console.log("\nDONE");
  console.log(`Stores: ${storesWS.rowCount - 1}`);
  console.log(`Coupons/Deals: ${couponsWS.rowCount - 1}`);

  await browser.close();
}

scrape().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
