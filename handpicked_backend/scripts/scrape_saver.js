// scrape_saver.js - FIXED SELECTOR
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import * as cheerio from "cheerio";
import ExcelJS from "exceljs";

const START_URL = process.argv[2] || "https://saver.com/merchants/B";
const OUTPUT_DIR = process.cwd();
const CONCURRENT_PAGES = 3;

function cleanStoreName(raw) {
  if (!raw) return "";
  return raw.replace(/\s*Promo Codes?\s*$/i, "").trim();
}

function extractCleanDomain(url) {
  if (!url) return "";
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}/`;
  } catch {
    return url;
  }
}

async function scrape() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to stores page...");

  try {
    await page.goto(START_URL, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    const listingHTML = await page.content();
    const $ = cheerio.load(listingHTML);

    // FIXED: Get col-lg-3 from first .row only (excludes "Latest Stores" section)
    const storeCards = $(".list-holder > .row")
      .eq(1)
      .find("div.col-lg-3.col-md-3.col-xs-12")
      .toArray();
    console.log(`Found ${storeCards.length} store card(s)\n`);

    const stores = [];

    for (const card of storeCards) {
      const $$ = cheerio.load($.html(card));

      const internalAnchor = $$("div.bold.gr3 > a.gr3").first();
      const nameRaw = internalAnchor.text().trim();
      const store_name = cleanStoreName(nameRaw);
      const internal_url = internalAnchor.attr("href")?.trim() || "";

      if (store_name && internal_url) {
        stores.push({
          store_name,
          internal_url,
        });
      }
    }

    console.log(`Parsed ${stores.length} stores successfully\n`);

    // Excel workbooks
    const storesWB = new ExcelJS.Workbook();
    const storesWS = storesWB.addWorksheet("stores");
    storesWS.columns = [
      { header: "store_name", key: "store_name", width: 40 },
      { header: "store_url", key: "store_url", width: 60 },
      { header: "store_category", key: "store_category", width: 30 },
      { header: "store_subcategory", key: "store_subcategory", width: 30 },
      { header: "logo_url", key: "logo_url", width: 80 },
    ];

    const couponsWB = new ExcelJS.Workbook();
    const couponsWS = couponsWB.addWorksheet("coupons");
    couponsWS.columns = [
      { header: "store_name", key: "store_name", width: 40 },
      { header: "title", key: "title", width: 80 },
      { header: "description", key: "description", width: 120 },
      { header: "discount", key: "discount", width: 20 },
    ];

    const storeResults = {};

    // Worker queue
    let idx = 0;
    async function worker() {
      while (true) {
        let i = idx++;
        if (i >= stores.length) break;

        const store = stores[i];
        const internal = store.internal_url;

        console.log(
          `[${i + 1}/${stores.length}] Processing: ${store.store_name}`,
        );

        if (!internal) {
          console.warn(`  → No internal URL, skipping\n`);
          continue;
        }

        const page2 = await context.newPage();
        try {
          await page2.goto(internal, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          await page2.waitForTimeout(2000);

          const detailHTML = await page2.content();
          const $$ = cheerio.load(detailHTML);

          // 1. LOGO URL
          const logo_url =
            $$('meta[property="og:image"]').attr("content") ||
            $$(".store-logo-block img").attr("src") ||
            "";

          console.log(`  → Logo: ${logo_url}`);

          // 2. BREADCRUMBS (Categories)
          const breadcrumbs = [];
          $$('nav[aria-label="Breadcrumb"] a').each((idx, el) => {
            breadcrumbs.push($$(el).text().trim());
          });

          const category = breadcrumbs[1] || "";
          const subcategory = breadcrumbs[2] || "";

          console.log(
            `  → Category: "${category}" / Subcategory: "${subcategory}"`,
          );

          // 3. STORE URL - Extract href directly (no redirect)
          let store_url = "";
          try {
            store_url = $$('.hero_button a[rel="nofollow"]').attr("href");
            console.log(`  → Store URL: ${store_url}`);
          } catch (err) {
            console.warn(`  → Failed to get store URL: ${err.message}`);
          }

          // Store result
          storeResults[store.store_name] = {
            store_name: store.store_name,
            store_url: store_url,
            store_category: category,
            store_subcategory: subcategory,
            logo_url: logo_url,
          };

          // 4. DEALS ONLY (skip coupons)
          const dealElements = await page2.$$(
            ".cb-coupon-boxes.deal, .cb-coupon-boxes.type_2",
          );

          console.log(`  → Found ${dealElements.length} deals`);

          for (const dealEl of dealElements) {
            try {
              const title = await dealEl
                .$eval("h3 .coupon-title", (node) => node?.textContent?.trim())
                .catch(() => "");

              const description = await dealEl
                .$eval(".coupon_desc .expandDiv", (node) =>
                  node?.textContent?.trim(),
                )
                .catch(() => "");

              const discount = await dealEl
                .$eval(".offer-tye-ln1", (node) => node?.textContent?.trim())
                .catch(() => "");

              if (title) {
                couponsWS.addRow({
                  store_name: store.store_name,
                  title: title,
                  description: description,
                  discount: discount,
                });
              }
            } catch (err) {
              console.warn(`  → Deal parsing error: ${err.message}`);
            }
          }

          await page2.close();
        } catch (err) {
          console.error(`  !! Error: ${err?.message}\n`);
          try {
            await page2.close();
          } catch {}
        }
      }
    }

    // Start workers
    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENT_PAGES, stores.length); w++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    // Write store results
    for (const storeData of Object.values(storeResults)) {
      storesWS.addRow(storeData);
    }

    // Save files
    const storesPath = path.join(OUTPUT_DIR, "stores.xlsx");
    const couponsPath = path.join(OUTPUT_DIR, "coupons.xlsx");

    await storesWB.xlsx.writeFile(storesPath);
    await couponsWB.xlsx.writeFile(couponsPath);

    console.log(`\n✅ Done! Files written:`);
    console.log(`   - ${storesPath}`);
    console.log(`   - ${couponsPath}`);
    console.log(`\nStores: ${Object.keys(storeResults).length}`);
    console.log(`Deals: ${couponsWS.rowCount - 1}`);
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    await page.screenshot({ path: "error-screenshot.png", fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

scrape().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
