/**
 * CouponScraper.jsx
 * Standalone coupon scraping tool — single + bulk
 * Scrapes merchant homepage via backend, parses with Gemini, inserts new coupons to DB
 * Completely decoupled from content generator
 */

import { useState, useRef } from "react";

const BACKEND_URL = "https://admin-api.geniecoupon.com";

// ─── API ──────────────────────────────────────────────────────────
async function scrapeStore(slug, geminiKey, model, backendUrl) {
  const res = await fetch(`${backendUrl}/api/seo/scrape-coupons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, geminiKey, model }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed ${res.status}`);
  return data;
}

// ─── UI COMPONENTS ────────────────────────────────────────────────
function StatusBadge({ bg, color, text }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 4,
        fontWeight: 500,
        background: bg,
        color,
      }}
    >
      {text}
    </span>
  );
}

function ProgressBar({ value, max }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div
      style={{
        background: "var(--color-background-tertiary)",
        borderRadius: 20,
        height: 8,
        overflow: "hidden",
        margin: "6px 0",
      }}
    >
      <div
        style={{
          height: 8,
          borderRadius: 20,
          background: "#1B3557",
          width: pct + "%",
          transition: "width .4s",
        }}
      />
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────
export default function CouponScraper() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeys, setApiKeys] = useState([""]);
  const [backendUrl, setBackendUrl] = useState(BACKEND_URL);
  const [model, setModel] = useState("gemini-3.1-flash-lite-preview");
  const [mode, setMode] = useState("single");

  // Single mode
  const [slug, setSlug] = useState("");
  const [singleStatus, setSingleStatus] = useState("idle"); // idle | loading | done | failed
  const [singleResult, setSingleResult] = useState(null);
  const [singleError, setSingleError] = useState("");

  // Batch mode
  const [batchText, setBatchText] = useState("");
  const [batchResults, setBatchResults] = useState([]);
  const [batchIdx, setBatchIdx] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchStatus, setBatchStatus] = useState("");
  const [batchError, setBatchError] = useState("");
  const stopRef = useRef(false);
  const keyIdxRef = useRef(0);
  const [keyUsage, setKeyUsage] = useState({});

  // ── Helpers ──
  const getNextKey = () => {
    const valid = apiKeys
      .map((k, i) => ({ k: k.trim(), i }))
      .filter((x) => x.k);
    if (!valid.length) return null;
    const pick = valid[keyIdxRef.current % valid.length];
    keyIdxRef.current = (keyIdxRef.current + 1) % valid.length;
    return pick;
  };

  const parseBatch = (text) =>
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split(",").map((p) => p.trim());
        return { slug: parts[0], label: parts[1] || parts[0] };
      })
      .filter((r) => r.slug);

  // ── Single scrape ──
  const runSingle = async () => {
    if (!slug.trim()) {
      setSingleError("Slug is required.");
      return;
    }
    if (!apiKey.trim()) {
      setSingleError("Gemini API key is required.");
      return;
    }
    setSingleError("");
    setSingleResult(null);
    setSingleStatus("loading");
    try {
      const result = await scrapeStore(
        slug.trim(),
        apiKey.trim(),
        model,
        backendUrl,
      );
      setSingleResult(result);
      setSingleStatus("done");
    } catch (err) {
      setSingleResult({ error: err.message });
      setSingleStatus("failed");
      setSingleError(err.message);
    }
  };

  const runBatch = async (rowsOverride = null) => {
    const validKeys = apiKeys
      .map((k, i) => ({ key: k.trim(), idx: i }))
      .filter((x) => x.key);

    if (!validKeys.length) {
      setBatchError("Add at least one Gemini API key.");
      return;
    }

    const rows = rowsOverride || parseBatch(batchText);

    if (!rows.length) {
      setBatchError("No slugs found.");
      return;
    }

    if (!rowsOverride) {
      setBatchError("");
      setBatchResults([]);
      setKeyUsage({});
    }

    stopRef.current = false;
    setBatchRunning(true);
    setBatchTotal(rows.length);
    setBatchIdx(0);

    let completed = 0;
    let sharedIndex = 0;

    // worker per key
    const workers = validKeys.map(async ({ key, idx }) => {
      while (true) {
        if (stopRef.current) return;

        const currentIndex = sharedIndex++;

        if (currentIndex >= rows.length) return;

        const row = rows[currentIndex];

        setBatchStatus(
          `[${completed + 1}/${rows.length}] ${row.label} — key ${idx + 1}`,
        );

        try {
          const result = await scrapeStore(row.slug, key, model, backendUrl);

          setKeyUsage((prev) => ({
            ...prev,
            [`key${idx}`]: (prev[`key${idx}`] || 0) + 1,
          }));

          setBatchResults((prev) => [
            ...prev,
            {
              slug: row.slug,
              label: row.label,
              status: "done",
              keyUsed: idx + 1,
              ...result,
            },
          ]);
        } catch (err) {
          setBatchResults((prev) => [
            ...prev,
            {
              slug: row.slug,
              label: row.label,
              status: "error",
              error: err.message,
              keyUsed: idx + 1,
            },
          ]);
        }

        completed++;

        setBatchIdx(completed);
      }
    });

    await Promise.all(workers);

    setBatchRunning(false);

    setBatchStatus(stopRef.current ? "Stopped." : "Batch complete.");
  };
  const retryFailed = () => {
    const failed = batchResults.filter((r) => r.status === "error");
    if (!failed.length) return;
    setBatchResults((prev) => prev.filter((r) => r.status !== "error"));
    runBatch(failed.map((r) => ({ slug: r.slug, label: r.label })));
  };

  const exportCSV = () => {
    const headers = [
      "slug",
      "label",
      "status",
      "inserted",
      "skipped",
      "total_scraped",
      "message",
      "error",
      "key_used",
    ];
    const rows = batchResults.map((r) =>
      [
        r.slug,
        r.label,
        r.status,
        r.inserted ?? "",
        r.skipped ?? "",
        r.total_scraped ?? "",
        r.message || "",
        r.error || "",
        r.keyUsed || "",
      ]
        .map((v) => `"${(String(v) || "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `coupon-scrape-${Date.now()}.csv`;
    a.click();
  };

  const batchRows = parseBatch(batchText);

  const inputStyle = {
    width: "100%",
    padding: "7px 10px",
    border: "0.5px solid var(--color-border-secondary)",
    borderRadius: 6,
    fontSize: 13,
    background: "var(--color-background-primary)",
    color: "var(--color-text-primary)",
    fontFamily: "inherit",
    outline: "none",
  };

  const tabStyle = (active) => ({
    padding: "6px 13px",
    fontSize: 12,
    fontFamily: "inherit",
    cursor: "pointer",
    border: "0.5px solid var(--color-border-secondary)",
    borderRadius: 6,
    fontWeight: active ? 500 : 400,
    background: active
      ? "var(--color-background-secondary)"
      : "var(--color-background-primary)",
    color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
  });

  const singleStatusMap = {
    idle: null,
    loading: <StatusBadge bg="#E6F1FB" color="#185FA5" text="⟳ Scraping…" />,
    done: (
      <StatusBadge
        bg="#EAF3DE"
        color="#2E5C0E"
        text={`✓ ${singleResult?.inserted ?? 0} inserted · ${singleResult?.skipped ?? 0} skipped`}
      />
    ),
    failed: (
      <StatusBadge
        bg="#FAECE7"
        color="#993C1D"
        text={`✗ ${singleResult?.error || "Failed"}`}
      />
    ),
  };

  return (
    <div
      style={{
        padding: "1.5rem 0",
        fontFamily: "var(--font-sans)",
        maxWidth: 700,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#0F2240",
          color: "#fff",
          borderRadius: 12,
          padding: "1.1rem 1.4rem",
          marginBottom: "1.25rem",
        }}
      >
        🔍 Coupon Scraper
        <br />
        <span style={{ fontSize: 12 }}>
          Scrape store homepages · Parse with Gemini · Save new coupons to DB
        </span>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: "1rem" }}>
        {["single", "batch"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={tabStyle(mode === m)}
          >
            {m === "single" ? "Single Store" : "Bulk Scrape"}
          </button>
        ))}
      </div>

      {/* Config */}
      <div
        style={{
          background: "var(--color-background-secondary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: 10,
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-text-secondary)",
            marginBottom: 8,
          }}
        >
          Configuration
        </div>

        {/* Single — one key */}
        {mode === "single" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Gemini API Key *
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy•••••••••••"
                style={inputStyle}
                disabled={singleStatus === "loading"}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{ ...inputStyle, height: 36 }}
                disabled={singleStatus === "loading"}
              >
                <option value="gemini-3.1-flash-lite-preview">
                  gemini-3.1-flash-lite-preview (500 RPD)
                </option>
                <option value="gemini-2.5-flash-lite">
                  gemini-2.5-flash-lite (20 RPD)
                </option>
                <option value="gemini-2.5-flash">
                  gemini-2.5-flash (20 RPD)
                </option>
              </select>
            </div>
          </div>
        )}

        {/* Batch — multi-key round-robin */}
        {mode === "batch" && (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                }}
              >
                Gemini API Keys — Round-Robin (
                {apiKeys.filter((k) => k.trim()).length} active)
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setApiKeys((prev) => [...prev, ""])}
                  disabled={batchRunning || apiKeys.length >= 10}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    border: "0.5px solid var(--color-border-secondary)",
                    borderRadius: 4,
                    background: "var(--color-background-primary)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  + Add Key
                </button>
                {apiKeys.length > 1 && (
                  <button
                    onClick={() => setApiKeys((prev) => prev.slice(0, -1))}
                    disabled={batchRunning}
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      border: "0.5px solid #C04828",
                      borderRadius: 4,
                      background: "transparent",
                      color: "#C04828",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    − Remove
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {apiKeys.map((k, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-tertiary)",
                      width: 40,
                      flexShrink: 0,
                    }}
                  >
                    Key {i + 1}
                  </span>
                  <input
                    type="password"
                    value={k}
                    onChange={(e) =>
                      setApiKeys((prev) =>
                        prev.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                    placeholder="AIzaSy•••••••••••"
                    style={{ ...inputStyle, flex: 1 }}
                    disabled={batchRunning}
                  />
                  {keyUsage[`key${i}`] > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        background: "#E6F1FB",
                        color: "#185FA5",
                        borderRadius: 3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {keyUsage[`key${i}`]} calls
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{ ...inputStyle, height: 36 }}
                disabled={batchRunning}
              >
                <option value="gemini-3.1-flash-lite-preview">
                  gemini-3.1-flash-lite-preview (500 RPD/key)
                </option>
                <option value="gemini-2.5-flash-lite">
                  gemini-2.5-flash-lite (20 RPD/key)
                </option>
                <option value="gemini-2.5-flash">
                  gemini-2.5-flash (20 RPD/key)
                </option>
              </select>
            </div>
          </div>
        )}

        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Backend URL
          </label>
          <input
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="https://your-app.onrender.com"
            style={inputStyle}
            disabled={batchRunning || singleStatus === "loading"}
          />
        </div>
      </div>

      {/* ── SINGLE MODE ── */}
      {mode === "single" && (
        <div>
          <div
            style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 10,
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <label
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-secondary)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Merchant Slug *
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. healthyline-coupons"
              style={inputStyle}
              disabled={singleStatus === "loading"}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <button
              onClick={runSingle}
              disabled={singleStatus === "loading"}
              style={{
                flex: 1,
                padding: "9px",
                fontSize: 14,
                fontWeight: 500,
                border: "none",
                borderRadius: 8,
                background:
                  singleStatus === "loading"
                    ? "var(--color-background-tertiary)"
                    : "#0F2240",
                color:
                  singleStatus === "loading"
                    ? "var(--color-text-tertiary)"
                    : "#fff",
                cursor: singleStatus === "loading" ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {singleStatus === "loading" ? "⏳ Scraping…" : "🔍 Scrape Store"}
            </button>
            {singleStatusMap[singleStatus]}
          </div>

          {singleError && (
            <div
              style={{
                background: "#FAECE7",
                border: "0.5px solid #F0997B",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
                color: "#993C1D",
                marginBottom: "1rem",
              }}
            >
              {singleError}
            </div>
          )}

          {singleStatus === "done" && singleResult && (
            <div
              style={{
                background: "#EAF3DE",
                border: "0.5px solid #97C459",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 13,
                color: "#2E5C0E",
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 6 }}>
                ✓ Scrape complete — {slug}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  flexWrap: "wrap",
                  fontSize: 12,
                }}
              >
                <span>
                  🆕 Inserted: <strong>{singleResult.inserted}</strong>
                </span>
                <span>
                  ⏭ Skipped (duplicates):{" "}
                  <strong>{singleResult.skipped}</strong>
                </span>
                <span>
                  📄 Total scraped:{" "}
                  <strong>{singleResult.total_scraped}</strong>
                </span>
              </div>
              {singleResult.message && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  {singleResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BATCH MODE ── */}
      {mode === "batch" && (
        <div>
          <div
            style={{
              background: "#FAEEDA",
              border: "0.5px solid #EF9F27",
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: "0.9rem",
              fontSize: 12,
              color: "#854F0B",
              lineHeight: 1.7,
            }}
          >
            <strong>Format:</strong>{" "}
            <code
              style={{
                fontFamily: "var(--font-mono)",
                background: "#FFF3CD",
                padding: "1px 5px",
                borderRadius: 3,
              }}
            >
              merchant-slug, Optional Label
            </code>
            <br />
            One store per line. Label is optional — used for display only.
          </div>

          <div style={{ marginBottom: "0.9rem" }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-secondary)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Merchant Slugs
            </label>
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              disabled={batchRunning}
              placeholder={
                "healthyline-coupons, Healthyline\nparsec-coupons, Parsec\nnike-coupons"
              }
              rows={8}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            />
          </div>

          {batchRows.length > 0 && (
            <div
              style={{
                background: "var(--color-background-secondary)",
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: "0.9rem",
                fontSize: 13,
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <span>
                📋 <strong>{batchRows.length}</strong> stores
              </span>
              <span>
                🔑 <strong>{apiKeys.filter((k) => k.trim()).length}</strong>{" "}
                keys — no delay
              </span>
            </div>
          )}

          {batchRunning && (
            <div style={{ marginBottom: "0.9rem" }}>
              <ProgressBar value={batchIdx} max={batchTotal} />
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                }}
              >
                {batchStatus}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
            <button
              onClick={() => runBatch()}
              disabled={batchRunning || !batchRows.length}
              style={{
                flex: 1,
                padding: "9px",
                fontSize: 14,
                fontWeight: 500,
                border: "none",
                borderRadius: 8,
                background: batchRunning
                  ? "var(--color-background-tertiary)"
                  : "#0F2240",
                color: batchRunning ? "var(--color-text-tertiary)" : "#fff",
                cursor: batchRunning ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {batchRunning
                ? `⏳ Scraping ${batchIdx}/${batchTotal}…`
                : "🚀 Start Bulk Scrape"}
            </button>
            {batchRunning && (
              <button
                onClick={() => (stopRef.current = true)}
                style={{
                  padding: "9px 14px",
                  fontSize: 13,
                  border: "0.5px solid #C04828",
                  borderRadius: 8,
                  background: "transparent",
                  color: "#C04828",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ⏹ Stop
              </button>
            )}
          </div>

          {batchError && (
            <div
              style={{
                background: "#FAECE7",
                border: "0.5px solid #F0997B",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
                color: "#993C1D",
                marginBottom: "1rem",
              }}
            >
              {batchError}
            </div>
          )}

          {batchResults.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: "#2E5C0E" }}>
                    ✓ {batchResults.filter((r) => r.status === "done").length}{" "}
                    done
                  </span>
                  <span
                    style={{
                      color:
                        batchResults.filter((r) => r.status === "error")
                          .length > 0
                          ? "#993C1D"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    ✗ {batchResults.filter((r) => r.status === "error").length}{" "}
                    failed
                  </span>
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    🆕 {batchResults.reduce((s, r) => s + (r.inserted || 0), 0)}{" "}
                    total inserted
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {batchResults.filter((r) => r.status === "error").length >
                    0 &&
                    !batchRunning && (
                      <button
                        onClick={retryFailed}
                        style={{
                          fontSize: 11,
                          padding: "3px 10px",
                          border: "0.5px solid #185FA5",
                          borderRadius: 4,
                          background: "#E6F1FB",
                          color: "#185FA5",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ↻ Retry Failed (
                        {
                          batchResults.filter((r) => r.status === "error")
                            .length
                        }
                        )
                      </button>
                    )}
                  <button
                    onClick={exportCSV}
                    style={{
                      fontSize: 11,
                      padding: "3px 10px",
                      border: "0.5px solid var(--color-border-secondary)",
                      borderRadius: 4,
                      background: "var(--color-background-primary)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    ⬇ CSV
                  </button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: 360,
                  overflowY: "auto",
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderRadius: 8,
                }}
              >
                {batchResults.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 12px",
                      borderBottom: "0.5px solid var(--color-border-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      background:
                        r.status === "error"
                          ? "#FFF8F6"
                          : i % 2 === 0
                            ? "var(--color-background-primary)"
                            : "var(--color-background-secondary)",
                    }}
                  >
                    <span
                      style={{
                        color: r.status === "done" ? "#2E5C0E" : "#993C1D",
                      }}
                    >
                      {r.status === "done" ? "✓" : "✗"}
                    </span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{r.label}</span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-tertiary)",
                      }}
                    >
                      {r.slug}
                    </span>
                    {r.status === "done" && (
                      <>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            background: "#EAF3DE",
                            color: "#2E5C0E",
                            borderRadius: 3,
                          }}
                        >
                          +{r.inserted} new
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            background: "#f0f0f0",
                            color: "#555",
                            borderRadius: 3,
                          }}
                        >
                          {r.skipped} skip
                        </span>
                      </>
                    )}
                    {r.status === "error" && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#993C1D",
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.error}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        background: "#f0f0f0",
                        color: "#555",
                        borderRadius: 3,
                      }}
                    >
                      K{r.keyUsed}
                    </span>
                  </div>
                ))}
              </div>

              {!batchRunning && batchStatus && (
                <div
                  style={{
                    marginTop: "0.9rem",
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {batchStatus}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
