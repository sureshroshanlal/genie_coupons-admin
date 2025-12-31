// src/utils/importsExcelUtils.js
import xlsx from "xlsx";

export function normalizeBoolean(v) {
  if (v === true || v === false) return v;
  const s = String(v || "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

export const str = (v) => (v === null || v === undefined ? "" : String(v).trim());
export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Parse buffer -> rows using first sheet (or schema.sheet index)
export async function parseExcelBuffer(buffer, schema) {
  const wb = xlsx.read(buffer, { type: "buffer" });
  const sheetIndex = Number.isInteger(schema.sheet) ? schema.sheet : 0;
  const sheetName = wb.SheetNames[sheetIndex];
  if (!sheetName) return [];

  const raw = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });

  // If headers array is defined, validate presence (case-insensitive match)
  const expected = Array.isArray(schema.headers) ? schema.headers : null;
  if (expected && raw.length > 0) {
    const firstRowKeys = Object.keys(raw[0]).map((k) => k.toLowerCase());
    const missing = expected.filter((h) => !firstRowKeys.includes(h.toLowerCase()));
    if (missing.length) {
      throw new Error(`Missing columns: ${missing.join(", ")}`);
    }
  }

  // Map/normalize each row
  const map = typeof schema.map === "function" ? schema.map : (r) => r;
  const rows = raw.map((r) => map(renameKeysCaseInsensitive(r)));

  // Required fields check
  if (Array.isArray(schema.required) && schema.required.length) {
    const errors = [];
    rows.forEach((r, i) => {
      schema.required.forEach((key) => {
        if (r[key] === undefined || r[key] === null || r[key] === "") {
          errors.push({ row: i + 2, message: `Missing required '${key}'` }); // +2 (header + 1-index)
        }
      });
    });
    if (errors.length) {
      const e = new Error("Validation failed");
      e.details = errors;
      throw e;
    }
  }

  return rows;
}

function renameKeysCaseInsensitive(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    out[String(k).trim().toLowerCase()] = v;
  }
  return out;
}
