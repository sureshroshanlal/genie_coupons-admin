import path from "path";
import { chromium } from "playwright";
import ExcelJS from "exceljs";

// Array of category URLs to scrape
const CATEGORY_URLS = [
  "https://proxy.coupons/coupon-category/proxy/",
  "https://proxy.coupons/coupon-category/vpn/",
  "https://proxy.coupons/coupon-category/scraping/",
  "https://proxy.coupons/coupon-category/privacy/",
  "https://proxy.coupons/coupon-category/iptv/",
  "https://proxy.coupons/coupon-category/software/",
  "https://proxy.coupons/coupon-category/social-media/",
  "https://proxy.coupons/coupon-category/antidetect-browsers/",
  "https://proxy.coupons/coupon-category/spy-apps/",
  "https://proxy.coupons/coupon-category/cloud-storage/",
  "https://proxy.coupons/coupon-category/web-hosting/",
  "https://proxy.coupons/coupon-category/email/",
  "https://proxy.coupons/coupon-category/background-checks/",
  "https://proxy.coupons/coupon-category/password-managers/",
  "https://proxy.coupons/coupon-category/web-services/",
  "https://proxy.coupons/coupon-category/residential-proxies/",
  "https://proxy.coupons/coupon-category/isp-proxies/",
  "https://proxy.coupons/coupon-category/socks-proxies/",
  "https://proxy.coupons/coupon-category/mobile-proxies/",
  "https://proxy.coupons/coupon-category/datacenter-proxies/",
  "https://proxy.coupons/coupon-category/rotating-proxies/",
  "https://proxy.coupons/coupon-category/web-development/",
  "https://proxy.coupons/coupon-category/wordpress/",
  "https://proxy.coupons/coupon-category/shopify/",
  "https://proxy.coupons/coupon-category/static-proxies/",
  "https://proxy.coupons/coupon-category/https-proxies/",
  "https://proxy.coupons/coupon-category/dedicated-proxies/",
  "https://proxy.coupons/coupon-category/seo-proxies/",
  "https://proxy.coupons/coupon-category/high-anonymity-proxies/",
  "https://proxy.coupons/coupon-category/ipv6-proxies/",
  "https://proxy.coupons/coupon-category/ipv4-proxies/",
  "https://proxy.coupons/coupon-category/email-proxies/",
  "https://proxy.coupons/coupon-category/prop-firms/",
  "https://proxy.coupons/coupon-category/antivirus/",
  "https://proxy.coupons/coupon-category/smm-panels/",
  "https://proxy.coupons/coupon-category/identity-theft-protection/",
  "https://proxy.coupons/coupon-category/seo-tools/",
  "https://proxy.coupons/coupon-category/ai-tools/",
  "https://proxy.coupons/coupon-category/data-recovery-software/",
  "https://proxy.coupons/coupon-category/podcasting/",
  "https://proxy.coupons/coupon-category/time-tracking-tools/",
  "https://proxy.coupons/coupon-category/online-fax/",
  "https://proxy.coupons/coupon-category/online-signatures/",
  "https://proxy.coupons/coupon-category/esims/",
  "https://proxy.coupons/coupon-category/data-removal-services/",
  "https://proxy.coupons/coupon-category/logo-design/",
  "https://proxy.coupons/coupon-category/website-builders/",
  "https://proxy.coupons/coupon-category/video-downloaders/",
  "https://proxy.coupons/coupon-category/health-tech/",
  "https://proxy.coupons/coupon-category/crypto/",
  "https://proxy.coupons/coupon-category/smart-home/",
  "https://proxy.coupons/coupon-category/ad-blockers/",
  "https://proxy.coupons/coupon-category/watches/",
  "https://proxy.coupons/coupon-category/internet/",
  "https://proxy.coupons/coupon-category/online-courses/",
  "https://proxy.coupons/coupon-category/gaming/",
  "https://proxy.coupons/coupon-category/tech-accessories/",
  "https://proxy.coupons/coupon-category/security-utilities-software/",
  "https://proxy.coupons/coupon-category/themes-templates/",
  "https://proxy.coupons/coupon-category/office-gaming-chairs/",
  "https://proxy.coupons/coupon-category/3d-printers/",
  "https://proxy.coupons/coupon-category/virtual-phone-numbers/",
  "https://proxy.coupons/coupon-category/gaming-server-hosting/",
  "https://proxy.coupons/coupon-category/domain-registration/",
  "https://proxy.coupons/coupon-category/trading-vps-hosting/",
  "https://proxy.coupons/coupon-category/business/",
  "https://proxy.coupons/coupon-category/digital-business-cards/",
  "https://proxy.coupons/coupon-category/e-bikes/",
  "https://proxy.coupons/coupon-category/ai-agents/",
  "https://proxy.coupons/coupon-category/solar-panels/",
  "https://proxy.coupons/coupon-category/appointment-scheduling/",
  "https://proxy.coupons/coupon-category/entertainment/",
  "https://proxy.coupons/coupon-category/stock-trading/",
  "https://proxy.coupons/coupon-category/apps/",
  "https://proxy.coupons/coupon-category/batteries-and-power-banks/",
  "https://proxy.coupons/coupon-category/trade-copiers/",
  "https://proxy.coupons/coupon-category/trading-charting-software/",
  "https://proxy.coupons/coupon-category/vagus-nerve-stimulation/",
  "https://proxy.coupons/coupon-category/technology/",
  "https://proxy.coupons/coupon-category/audio/",
];
const OUTPUT_DIR = process.cwd();

(async () => {
  console.log("Starting category scraper...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const allCoupons = [];
  const allStoresMap = new Map();

  try {
    for (const CATEGORY_URL of CATEGORY_URLS) {
      console.log(`\n=== Processing: ${CATEGORY_URL} ===`);

      // Load category page
      console.log(`Loading category page...`);
      await page.goto(CATEGORY_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForSelector(".coupon-item", { timeout: 30000 });

      // Click "Load More Coupons" button until all coupons are loaded
      console.log("Loading all coupons...");
      let loadMoreExists = true;
      let clickCount = 0;

      while (loadMoreExists) {
        try {
          const loadMoreButton = await page.$(
            ".couponcat-load-more a.ui.button",
          );

          if (loadMoreButton) {
            clickCount++;
            console.log(`  Clicking Load More (${clickCount})...`);

            // Click the button
            await loadMoreButton.click();

            // Wait for new coupons to load
            await page.waitForTimeout(2000);
          } else {
            loadMoreExists = false;
          }
        } catch (error) {
          // No more "Load More" button found or error occurred
          loadMoreExists = false;
        }
      }
      console.log(`All coupons loaded (clicked ${clickCount} times)`);

      // Extract breadcrumbs for category/subcategory
      const { parentCategory, subcategory } = await page.evaluate(() => {
        const breadcrumbItems = document.querySelectorAll(
          '.breadcrumbs span[property="itemListElement"]',
        );
        let parent = "";
        let sub = "";

        if (breadcrumbItems.length === 3) {
          // Has subcategory: Home > Parent > Sub
          parent =
            breadcrumbItems[1]
              .querySelector('span[property="name"]')
              ?.textContent.trim() || "";
          sub =
            breadcrumbItems[2]
              .querySelector('span[property="name"]')
              ?.textContent.trim() || "";
        } else if (breadcrumbItems.length === 2) {
          // No subcategory: Home > Category
          parent =
            breadcrumbItems[1]
              .querySelector('span[property="name"]')
              ?.textContent.trim() || "";
        }

        return { parentCategory: parent, subcategory: sub };
      });

      console.log(
        `Category: ${parentCategory}${subcategory ? " > " + subcategory : ""}`,
      );

      // Extract all coupons from the page
      console.log("Extracting coupons...");
      const coupons = await page.evaluate(() => {
        const couponItems = document.querySelectorAll(".coupon-item");
        const results = [];

        couponItems.forEach((item) => {
          // Store information
          const storeImg = item.querySelector(".store-thumb img");
          const storeName =
            storeImg?.getAttribute("alt") ||
            storeImg?.getAttribute("title") ||
            "";
          const logoUrl = storeImg?.getAttribute("src") || "";

          // Store URL from affiliate link
          const storeUrl =
            item
              .querySelector(".coupon-button")
              ?.getAttribute("data-aff-url") || "";

          // Coupon title
          const title =
            item.querySelector(".coupon-title a")?.textContent.trim() || "";

          // Coupon description
          const description =
            item.querySelector(".coupon-des-ellip")?.textContent.trim() ||
            item.querySelector(".coupon-des")?.textContent.trim() ||
            "";

          // Extract discount from title (e.g., "45% Off" or "20% off")
          //   const discountMatch = title.match(/(\d+%)\s*(off|discount)/i);
          const discountMatch = title.match(/(\d+%|\$\d+)/i);
          const discount = discountMatch ? discountMatch[1] : "";

          // Coupon code from data-code attribute (full code)
          const couponCode =
            item.querySelector(".coupon-button")?.getAttribute("data-code") ||
            "";

          // Coupon type - check for c-type-code or c-type-deal class
          let type = "Unknown";
          if (item.classList.contains("c-type-code")) {
            type = "Coupon";
          } else if (
            item.classList.contains("c-type-deal") ||
            item.classList.contains("c-type-sale")
          ) {
            type = "Deal";
          }

          results.push({
            storeName,
            storeUrl,
            logoUrl,
            title,
            description,
            discount,
            couponCode,
            type,
          });
        });

        return results;
      });

      console.log(`Found ${coupons.length} coupons`);

      // Add to all coupons array
      allCoupons.push(...coupons);

      // Add stores to the global stores map
      coupons.forEach((coupon) => {
        if (!allStoresMap.has(coupon.storeName)) {
          allStoresMap.set(coupon.storeName, {
            store_name: coupon.storeName,
            store_url: coupon.storeUrl,
            store_category: parentCategory,
            store_subcategory: subcategory,
            logo_url: coupon.logoUrl,
            categories: new Set([parentCategory]),
            subcategories: new Set(subcategory ? [subcategory] : []),
          });
        } else {
          // Store already exists, add categories to the set
          const existing = allStoresMap.get(coupon.storeName);
          existing.categories.add(parentCategory);
          if (subcategory) {
            existing.subcategories.add(subcategory);
          }
        }
      });
    }

    const stores = Array.from(allStoresMap.values()).map((store) => ({
      store_name: store.store_name,
      store_url: store.store_url,
      store_category: Array.from(store.categories).join(", "),
      store_subcategory: Array.from(store.subcategories).join(", "),
      logo_url: store.logo_url,
    }));
    console.log(`\n=== Total Summary ===`);
    console.log(`Total Unique Stores: ${stores.length}`);
    console.log(`Total Coupons: ${allCoupons.length}`);

    // Create stores.xlsx
    console.log("\nCreating stores.xlsx...");
    const storesWorkbook = new ExcelJS.Workbook();
    const storesSheet = storesWorkbook.addWorksheet("Stores");

    storesSheet.columns = [
      { header: "store_name", key: "store_name", width: 30 },
      { header: "store_url", key: "store_url", width: 50 },
      { header: "store_category", key: "store_category", width: 25 },
      { header: "store_subcategory", key: "store_subcategory", width: 30 },
      { header: "logo_url", key: "logo_url", width: 60 },
    ];

    stores.forEach((store) => {
      storesSheet.addRow(store);
    });

    await storesWorkbook.xlsx.writeFile(path.join(OUTPUT_DIR, "stores.xlsx"));
    console.log("stores.xlsx created successfully");

    // Create coupons.xlsx
    console.log("Creating coupons.xlsx...");
    const couponsWorkbook = new ExcelJS.Workbook();
    const couponsSheet = couponsWorkbook.addWorksheet("Coupons");

    couponsSheet.columns = [
      { header: "store_name", key: "store_name", width: 30 },
      { header: "type", key: "type", width: 15 },
      { header: "title", key: "title", width: 50 },
      { header: "description", key: "description", width: 60 },
      { header: "discount", key: "discount", width: 15 },
      { header: "coupon_code", key: "coupon_code", width: 20 },
    ];

    allCoupons.forEach((coupon) => {
      couponsSheet.addRow({
        store_name: coupon.storeName,
        type: coupon.type,
        title: coupon.title,
        description: coupon.description,
        discount: coupon.discount,
        coupon_code: coupon.couponCode,
      });
    });

    await couponsWorkbook.xlsx.writeFile(path.join(OUTPUT_DIR, "coupons.xlsx"));
    console.log("coupons.xlsx created successfully");

    console.log("\n=== Scraping Complete ===");
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }
})();
