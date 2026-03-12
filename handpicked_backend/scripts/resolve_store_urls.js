import path from "path";
import { chromium } from "playwright";
import ExcelJS from "exceljs";

const OUTPUT_DIR = process.cwd();

const STORES_FILE = path.join(OUTPUT_DIR, "stores.xlsx");

const CONCURRENT_LIMIT = 10; // Number of URLs to process simultaneously

(async () => {
  console.log("Starting URL redirect resolver...");

  // Read the existing stores.xlsx
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(STORES_FILE);
  const worksheet = workbook.getWorksheet("Stores");

  if (!worksheet) {
    console.error("Stores worksheet not found!");
    return;
  }

  // Find the store_url column index
  const headers = worksheet.getRow(1).values;
  const storeUrlColumnIndex = headers.indexOf("store_url");

  if (storeUrlColumnIndex === -1) {
    console.error("store_url column not found!");
    return;
  }

  // Add new column header for actual_store_url (after logo_url)
  const headerRow = worksheet.getRow(1);
  headerRow.getCell(6).value = "actual_store_url";

  // const browser = await chromium.launch({ headless: true });
  // const context = await browser.newContext();

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled", // Avoid detection
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", // Real browser UA
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
    ignoreHTTPSErrors: true, // Ignore SSL certificate errors
  });

  let processedCount = 0;
  let errorCount = 0;

  // Collect all rows to process
  const rowsToProcess = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const storeUrl = row.getCell(storeUrlColumnIndex).value;
    const storeName = row.getCell(1).value;

    if (storeUrl) {
      rowsToProcess.push({ rowNumber, row, storeUrl, storeName });
    }
  }

  console.log(`Total stores to process: ${rowsToProcess.length}`);
  console.log(`Concurrent limit: ${CONCURRENT_LIMIT}\n`);

  async function processUrl(item) {
    const { rowNumber, row, storeUrl, storeName } = item;
    const maxRetries = 3; // Increase retries
    let attempts = 0;
    let page;

    while (attempts < maxRetries) {
      try {
        page = await context.newPage();

        // Try with longer timeout and different wait strategy
        const response = await page.goto(storeUrl, {
          waitUntil: "commit", // More lenient than "commit"
          timeout: 15000,
        });

        // Check if redirect happened (status 3xx or different URL)
        if (response) {
          await page.waitForTimeout(1500);

          const finalUrl = page.url();

          // Validate URL before processing
          if (finalUrl && finalUrl.startsWith("http")) {
            const urlObj = new URL(finalUrl);
            const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}`;

            console.log(
              `✓ [${processedCount + errorCount + 1}/${rowsToProcess.length}] ${storeName} → ${cleanUrl}`,
            );

            row.getCell(6).value = cleanUrl;
            processedCount++;
            await page.close();
            return;
          }
        }

        throw new Error("Invalid redirect URL");
      } catch (error) {
        if (page) await page.close().catch(() => {});
        attempts++;

        if (attempts >= maxRetries) {
          console.error(
            `✗ [${processedCount + errorCount + 1}/${rowsToProcess.length}] ${storeName}: ${error.message}`,
          );
          row.getCell(6).value = "ERROR";
          errorCount++;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Longer delay between retries
        }
      }
    }
  }

  // Process in chunks with concurrency control
  for (let i = 0; i < rowsToProcess.length; i += CONCURRENT_LIMIT) {
    const chunk = rowsToProcess.slice(i, i + CONCURRENT_LIMIT);
    await Promise.all(chunk.map((item) => processUrl(item)));
  }

  await browser.close();

  // Save the updated Excel file
  console.log("\nSaving updated stores.xlsx...");
  await workbook.xlsx.writeFile(STORES_FILE);

  console.log("\n=== Processing Complete ===");
  console.log(`Successfully processed: ${processedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Updated file: ${STORES_FILE}`);
})();
