/**
 * STEP 2: Scraper
 *
 * For each store:
 *   1. Scrape homepage (always, cheerio)
 *   2. Discover + try subpages (about, faq, shipping, returns) — cheerio first, Playwright fallback
 *   3. Scrape Trustpilot
 *   4. Query Reddit
 *
 * Output: scraped_results.json (only — no DB writes)
 * Hard 15s limit per subpage — never blocks pipeline
 * Reads merchants from local CSV — zero DB reads
 * Saves results after EACH store (crash-safe)
 * Resume-safe — skips already scraped merchants automatically
 *
 * Run:             node scripts/Dynamic_Store_Content/02_scraper.js
 * With limit:      node scripts/Dynamic_Store_Content/02_scraper.js --limit=5
 * From ID:         node scripts/Dynamic_Store_Content/02_scraper.js --from-id=100
 * Force re-scrape: node scripts/Dynamic_Store_Content/02_scraper.js --force
 * Force one store: node scripts/Dynamic_Store_Content/02_scraper.js --force-id=123
 * Dry run:         node scripts/Dynamic_Store_Content/02_scraper.js --dry-run
 */

import pLimit from "p-limit";
import { discoverUrls } from "./url_discoverer.js";
import {
  extractContent,
  extractHomepage,
  hasUsefulContent,
} from "./content_extractor.js";
import { scrapeTrustpilot } from "./trustpilot_scraper.js";
import { scrapeReddit } from "./reddit_scraper.js";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// ─── Paths ────────────────────────────────────────────────────────────────────
const CSV_PATH = path.resolve(
  "./scripts/Dynamic_Store_Content/merchants_cache.csv",
);
const SCRAPED_PATH = path.resolve(
  "./scripts/Dynamic_Store_Content/scraped_results.json",
);

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const LIMIT = parseInt(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0",
);
const FROM_ID = parseInt(
  args.find((a) => a.startsWith("--from-id="))?.split("=")[1] || "0",
);
const FORCE_ID = parseInt(
  args.find((a) => a.startsWith("--force-id="))?.split("=")[1] || "0",
);
const DRY_RUN = args.includes("--dry-run");
const FORCE_ALL = args.includes("--force");

// ─── Config ───────────────────────────────────────────────────────────────────
const CONCURRENCY = 1;
const PAGE_DELAY_MS = 1500; // between subpages on same domain — avoids soft-blocks
const SUBPAGE_TIMEOUT = 15000;

// ─── Resume support ───────────────────────────────────────────────────────────
let scrapedResults = [];
if (fs.existsSync(SCRAPED_PATH)) {
  try {
    const raw = fs.readFileSync(SCRAPED_PATH, "utf8").trim();
    if (raw && raw !== "[]") {
      scrapedResults = JSON.parse(raw);
      console.log(`📋 Resuming — ${scrapedResults.length} already scraped`);
    } else {
      console.log("📋 scraped_results.json empty, starting fresh");
    }
  } catch (err) {
    console.log(
      `⚠️  Invalid scraped_results.json, starting fresh: ${err.message}`,
    );
    scrapedResults = [];
  }
}

// Build skip set — honour --force-id and --force-all
const alreadyScraped = new Set(
  FORCE_ALL
    ? []
    : scrapedResults
        .filter((r) =>
          FORCE_ID ? r.id?.toString() !== FORCE_ID.toString() : true,
        )
        .map((r) => r.id?.toString()),
);

function saveProgress() {
  fs.writeFileSync(SCRAPED_PATH, JSON.stringify(scrapedResults, null, 2));
}

// ─── category_names parser ────────────────────────────────────────────────────
// CSV stores category_names as a Python-style list string e.g. "['Clothing', 'Apparel']"
// or a JSON array string. Normalise to a plain comma-separated string for the generator.
function parseCategoryNames(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  // Already a clean string
  if (!trimmed.startsWith("[")) return trimmed;
  try {
    // Try JSON parse first (double-quoted array)
    const arr = JSON.parse(trimmed);
    if (Array.isArray(arr)) return arr.join(", ");
  } catch (_) {}
  // Python-style single-quoted list: ['Clothing', 'Apparel']
  const matches = trimmed.match(/'([^']+)'/g);
  if (matches) return matches.map((s) => s.replace(/'/g, "")).join(", ");
  return trimmed;
}

// ─── Trustpilot snippet cleaner ───────────────────────────────────────────────
function cleanTrustpilotSnippets(snippets = []) {
  if (!Array.isArray(snippets)) return [];
  const banned = [
    "fake reviews",
    "platform",
    "guidelines",
    "read more",
    "learn more",
    "our software",
    "trustpilot",
  ];
  return snippets.filter((s) => {
    if (!s || typeof s !== "string" || s.length < 20) return false;
    const lower = s.toLowerCase();
    return !banned.some((b) => lower.includes(b));
  });
}

// ─── Reddit cleaner ───────────────────────────────────────────────────────────
function cleanRedditData(reddit = {}, storeName = "") {
  if (!reddit || typeof reddit !== "object") {
    return {
      found: false,
      threads: [],
      commonQuestions: [],
      commonComplaints: [],
      overallSentiment: "neutral",
    };
  }

  const brand = (storeName || "").toLowerCase();
  const offTopicSubs = [
    "destinythegame",
    "superstonk",
    "politics",
    "gaming",
    "pcgaming",
    "costaricatravel",
    "wallstreetbets",
    "nfl",
    "nba",
  ];
  const shoppingKeywords = [
    "coupon",
    "code",
    "discount",
    "promo",
    "review",
    "experience",
    "shipping",
    "quality",
    "refund",
    "scam",
    "legit",
    "worth",
    "recommend",
    "buy",
    "purchase",
    "order",
    "customer",
    "service",
  ];

  const filteredThreads = (reddit.threads || []).filter((t) => {
    if (!t || typeof t !== "object") return false;
    const title = (t.title || "").toLowerCase();
    const snip = (t.snippet || "").toLowerCase();
    const sub = (t.subreddit || "").toLowerCase();

    if (offTopicSubs.includes(sub)) return false;

    const hasBrand =
      brand.length > 3 && (title.includes(brand) || snip.includes(brand));
    const hasKeyword = shoppingKeywords.some(
      (k) => title.includes(k) || snip.includes(k),
    );

    // Brand mention alone is sufficient. Keyword alone is not — too noisy.
    return (
      hasBrand ||
      (hasKeyword &&
        (title.includes(brand.split(" ")[0]) ||
          snip.includes(brand.split(" ")[0])))
    );
  });

  return {
    found: filteredThreads.length > 0, // only true if threads survived filter
    threads: filteredThreads.slice(0, 6),
    commonQuestions: Array.isArray(reddit.commonQuestions)
      ? reddit.commonQuestions
      : [],
    commonComplaints: Array.isArray(reddit.commonComplaints)
      ? reddit.commonComplaints
      : [],
    overallSentiment: reddit.overallSentiment || "neutral",
  };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
// Graduated scoring — more data = meaningfully higher score, not just binary flags
function scoreRichness(data) {
  let s = 0;
  const w = data.website || {};
  const hp = w.homepage || {};
  const tp = data.trustpilot || {};
  const rd = data.reddit || {};

  // Homepage signals
  if (hp.h1) s += 4;
  if ((hp.metaDescription || "").length > 50) s += 6;
  if (hp.heroTaglines?.length) s += Math.min(hp.heroTaglines.length, 4) * 1.5;
  s += Math.min(hp.productHeadings?.length || 0, 10) * 0.8; // up to 8pts
  s += Math.min(hp.keyParagraphs?.length || 0, 6) * 1.5; // up to 9pts
  if (hp.customerReviews?.length) s += Math.min(hp.customerReviews.length, 5);
  if (hp.trustSignals?.returnWindow) s += 4;
  if (hp.trustSignals?.freeShippingThreshold) s += 4;
  if (hp.trustSignals?.warranty) s += 3;
  if (hp.trustSignals?.reviewCount) s += 3;
  if (hp.specialOffers?.financing) s += 2;
  if (hp.specialOffers?.loyaltyProgram) s += 2;
  if (hp.specialOffers?.subscriptionSave) s += 2;
  if (hp.specialOffers?.referralProgram) s += 1;
  if (hp.salePatterns?.length) s += Math.min(hp.salePatterns.length, 3);

  // Subpage signals
  if (w.about?.keyParagraphs?.length)
    s += Math.min(w.about.keyParagraphs.length, 4) * 2;
  if (w.about?.foundingStory) s += 4;
  if (w.about?.stats?.length) s += Math.min(w.about.stats.length, 3);
  if (w.faq?.faqs?.length >= 2) s += Math.min(w.faq.faqs.length, 8) * 1.2;
  if (w.shipping?.freeShippingThreshold) s += 4;
  if (w.returns?.returnWindow) s += 4;

  // Third-party signals
  if (tp.found) s += 8;
  if (tp.rating) s += 3;
  if (tp.snippets?.length >= 2) s += Math.min(tp.snippets.length, 5);
  if (tp.commonPraise?.length) s += 2;
  if (tp.commonComplaints?.length) s += 1; // complaints = real data
  if (rd.found) s += 5;
  if (rd.commonQuestions?.length) s += Math.min(rd.commonQuestions.length, 3);
  if (rd.threads?.length >= 2) s += 2;

  return Math.min(Math.round(s), 100);
}

function assignTier(score, couponCount, hasWebUrl) {
  if (!hasWebUrl) return "D";
  // High coupons lower the score bar for Tier A — monetisation priority
  const couponBoost = couponCount >= 10 ? 10 : couponCount >= 5 ? 5 : 0;
  const effectiveScore = score + couponBoost;
  if (effectiveScore >= 55 && couponCount > 0) return "A";
  if (effectiveScore >= 30) return "B";
  if (effectiveScore >= 10) return "C";
  return "D";
}

// ─── Safe subpage fetch with AbortController (actually cancels on timeout) ───
async function tryFetchSubpage(url, category) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBPAGE_TIMEOUT);
  try {
    const result = await extractContent(url, category, controller.signal);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") return null;
    throw err;
  }
}

// ─── Scrape one merchant ──────────────────────────────────────────────────────
async function scrapeMerchant(merchant) {
  const base = merchant.web_url?.replace(/\/$/, "");
  if (!base) return { score: 0, tier: "D", data: null };

  const scraped = {
    website: {
      homepage: null,
      about: null,
      faq: null,
      shipping: null,
      returns: null,
    },
    trustpilot: {},
    reddit: {},
  };

  const discovery = await discoverUrls(base);
  if (discovery.homepageHtml) {
    scraped.website.homepage = extractHomepage(discovery.homepageHtml);
  }

  for (const category of ["about", "faq", "shipping", "returns"]) {
    const urls = discovery.classified[category] || [];
    if (!urls.length) continue;
    for (const { url } of urls) {
      const content = await tryFetchSubpage(url, category);
      if (hasUsefulContent(content)) {
        scraped.website[category] = content;
        if (content.usedPlaywright) console.log(`      ↳ Playwright: ${url}`);
        break;
      }
      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }
  }

  let tp = await scrapeTrustpilot(base);
  scraped.trustpilot = {
    ...(tp || {}),
    snippets: cleanTrustpilotSnippets(tp?.snippets),
  };

  await new Promise((r) => setTimeout(r, 800));

  const rd = await scrapeReddit(merchant.name, base);
  scraped.reddit = cleanRedditData(rd, merchant.name);

  const couponCount = parseInt(merchant.active_coupons_count) || 0;
  const score = scoreRichness(scraped);
  const tier = assignTier(score, couponCount, !!base);

  return { score, tier, data: scraped };
}

// ─── Summary ──────────────────────────────────────────────────────────────────
function printSummary(results) {
  const ok = results.filter((r) => !r.error);
  const errored = results.filter((r) => r.error);
  const tiers = { A: 0, B: 0, C: 0, D: 0 };
  let totalScore = 0,
    withTp = 0,
    withFaq = 0,
    withReddit = 0;

  for (const r of ok) {
    tiers[r.tier] = (tiers[r.tier] || 0) + 1;
    totalScore += r.score || 0;
    if (r.scraped_data?.trustpilot?.found) withTp++;
    if (r.scraped_data?.website?.faq?.faqs?.length >= 2) withFaq++;
    if (r.scraped_data?.reddit?.found) withReddit++;
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(
    `🏁 Scrape complete — ${ok.length} ok | ${errored.length} errors`,
  );
  console.log(
    `   Tiers:   A=${tiers.A}  B=${tiers.B}  C=${tiers.C}  D=${tiers.D}`,
  );
  console.log(
    `   Avg score:    ${ok.length ? Math.round(totalScore / ok.length) : 0}`,
  );
  console.log(`   Trustpilot:   ${withTp}/${ok.length}`);
  console.log(`   Has FAQs:     ${withFaq}/${ok.length}`);
  console.log(`   Has Reddit:   ${withReddit}/${ok.length}`);
  console.log(`   Output:       ${SCRAPED_PATH}`);
  console.log(`${"─".repeat(50)}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `🔍 Scraper | Concurrency: ${CONCURRENCY} | Limit: ${LIMIT || "all"} | DryRun: ${DRY_RUN}\n`,
  );

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const raw = parse(fs.readFileSync(CSV_PATH, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  console.log(`📁 CSV loaded: ${raw.length} rows`);

  const ALL_MERCHANTS = raw.filter((m) => {
    const isPublish = (m.is_publish || "").toString().trim().toLowerCase();
    const status = (m.content_status || "").toString().trim().toLowerCase();
    // Exclude noindex (Tier D — no web_url, scraping them is pointless)
    // Exclude scrape_failed unless --force is passed
    const validStatuses = FORCE_ALL
      ? ["template", "failed", "scraped", "scrape_failed"]
      : ["template", "failed"];
    return isPublish === "true" && validStatuses.includes(status);
  });
  console.log(`📋 Eligible merchants: ${ALL_MERCHANTS.length}`);

  let merchants = ALL_MERCHANTS.filter(
    (m) => !alreadyScraped.has(m.id?.toString()),
  );
  if (FROM_ID) merchants = merchants.filter((m) => parseInt(m.id) >= FROM_ID);
  if (FORCE_ID)
    merchants = ALL_MERCHANTS.filter((m) => parseInt(m.id) === FORCE_ID);
  if (LIMIT) merchants = merchants.slice(0, LIMIT);

  console.log(
    `📦 To scrape: ${merchants.length} | Already done: ${alreadyScraped.size}\n`,
  );

  if (!merchants.length) {
    console.log(
      "✅ Nothing to scrape. Use --force to re-scrape all or --force-id=N for one store.",
    );
    return;
  }

  const limiter = pLimit(CONCURRENCY);
  const sessionResults = [];

  await Promise.all(
    merchants.map((m) =>
      limiter(async () => {
        console.log(`  ↳ ${m.name} (${m.web_url})`);
        try {
          const { score, tier, data } = await scrapeMerchant(m);

          const tpStr = data?.trustpilot?.found
            ? `⭐${data.trustpilot.rating}(${data.trustpilot.reviewCount})`
            : "no-tp";
          const rdStr = data?.reddit?.found
            ? `💬${data.reddit.threads.length}t`
            : "no-reddit";
          const faqStr = data?.website?.faq?.faqs?.length
            ? `FAQs:${data.website.faq.faqs.length}`
            : "no-faq";
          console.log(
            `    ✓ Tier:${tier} Score:${score} | ${faqStr} | ${tpStr} | ${rdStr}`,
          );

          const record = {
            id: m.id,
            name: m.name,
            slug: m.slug,
            web_url: m.web_url,
            active_coupons_count: m.active_coupons_count,
            category_names: parseCategoryNames(m.category_names), // normalised string
            tier,
            score,
            scraped_data: data,
            scraped_at: new Date().toISOString(),
          };

          if (!DRY_RUN) {
            // If force-rescraping, replace existing record
            if (FORCE_ID || FORCE_ALL) {
              const idx = scrapedResults.findIndex(
                (r) => r.id?.toString() === m.id?.toString(),
              );
              if (idx >= 0) scrapedResults[idx] = record;
              else scrapedResults.push(record);
            } else {
              scrapedResults.push(record);
            }
            saveProgress();
          }
          sessionResults.push(record);
        } catch (err) {
          console.error(`    ✗ ${m.name}: ${err.message}`);
          const errRecord = {
            id: m.id,
            name: m.name,
            tier: "D",
            score: 0,
            error: err.message.substring(0, 500),
            scraped_at: new Date().toISOString(),
          };
          if (!DRY_RUN) {
            scrapedResults.push(errRecord);
            saveProgress();
          }
          sessionResults.push(errRecord);
        }
      }),
    ),
  );

  printSummary(sessionResults);
}

main().catch(console.error);
