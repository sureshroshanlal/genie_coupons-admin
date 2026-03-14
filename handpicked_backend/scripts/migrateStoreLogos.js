// scripts/migrateLogos.js

import { supabase } from "../dbhelper/dbclient.js";
import fetch from "node-fetch";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import path from "path";

dotenv.config();

const BUCKET = "merchant-images";
const FOLDER = "merchants";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readSheet(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const rows = [];
  let headers = [];

  ws.eachRow((row, rowNumber) => {
    const values = row.values.slice(1); // index 0 is always empty in exceljs
    if (rowNumber === 1) {
      headers = values.map((h) =>
        String(h || "")
          .trim()
          .toLowerCase(),
      );
      return;
    }
    const nameIdx = headers.indexOf("name");
    const urlIdx = headers.indexOf("logo_url");
    const name = String(values[nameIdx] || "").trim();
    const logo_url = String(values[urlIdx] || "").trim();
    if (name && logo_url) rows.push({ name, logo_url });
  });

  return rows;
}

async function downloadImage(url) {
  const res = await fetch(url, { timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/webp";
  const ext = url.split("?")[0].split(".").pop() || "webp";
  return { buffer, contentType, ext };
}

async function uploadToSupabase(buffer, filename, contentType) {
  const now = new Date();
  const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const safeName = filename.toLowerCase().replace(/\s+/g, "-");
  const storagePath = `${FOLDER}/${datePath}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function updateMerchantLogo(name, logoUrl) {
  const { data, error } = await supabase
    .from("merchants")
    .update({ logo_url: logoUrl })
    .ilike("name", name)
    .select("id, name");

  if (error) throw new Error(`DB update failed: ${error.message}`);
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/migrateLogos.js ./logos.xlsx");
    process.exit(1);
  }

  const stores = await readSheet(path.resolve(filePath));
  console.log(`\nFound ${stores.length} stores in sheet.\n`);

  const results = { success: [], failed: [] };

  for (const store of stores) {
    process.stdout.write(`Processing: ${store.name} ... `);
    try {
      const { buffer, contentType, ext } = await downloadImage(store.logo_url);
      const slug = store.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const newUrl = await uploadToSupabase(
        buffer,
        `${slug}.${ext}`,
        contentType,
      );
      const updated = await updateMerchantLogo(store.name, newUrl);

      if (!updated || updated.length === 0) {
        console.log(`⚠️  No merchant matched in DB`);
        results.failed.push({
          name: store.name,
          reason: "No merchant matched in DB",
        });
      } else {
        console.log(`✅  ${newUrl}`);
        results.success.push({ name: store.name, url: newUrl });
      }
    } catch (err) {
      console.log(`❌  ${err.message}`);
      results.failed.push({ name: store.name, reason: err.message });
    }
  }

  console.log("\n─── Summary ────────────────────────────────────────");
  console.log(`✅ Success : ${results.success.length}`);
  console.log(`❌ Failed  : ${results.failed.length}`);
  if (results.failed.length) {
    console.log("\nFailed:");
    results.failed.forEach((f) => console.log(`  - ${f.name}: ${f.reason}`));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
