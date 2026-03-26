/**
 * STEP 3: Content Generator
 *
 * Reads scraped_results.json (from 02_scraper.js).
 * Generates SEO content per merchant and pushes to Supabase merchants table.
 *
 * Key improvements vs previous version:
 *   - offerSummary from DB feeds meta titles, meta descriptions, FAQs, and body
 *   - Dynamic section headings — LLM picks from template-appropriate variants
 *   - Temperature raised to 0.85 for more varied, less templated output
 *   - meta_keywords removed (Google ignores it since 2009)
 *   - fixMetaDescription uses offer data for padding instead of canned phrases
 *   - FAQ slots 5–6 grounded in actual offer data (real codes, verified count)
 *   - Validator: checks offer consistency in description when offer data exists
 *
 * Provider priority: Google (gemini-2.5-flash-lite) → Groq → OpenRouter
 *
 * Run:              node scripts/Dynamic_Store_Content/03_generator.js
 * Tier filter:      node scripts/Dynamic_Store_Content/03_generator.js --tier=A
 * Single store:     node scripts/Dynamic_Store_Content/03_generator.js --slug=nike
 * Limit:            node scripts/Dynamic_Store_Content/03_generator.js --limit=10
 * Dry run:          node scripts/Dynamic_Store_Content/03_generator.js --dry-run
 * Retry failed:     node scripts/Dynamic_Store_Content/03_generator.js --retry-failed
 * Force redo:       node scripts/Dynamic_Store_Content/03_generator.js --force
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { supabase } from "../../dbhelper/dbclient.js";

dotenv.config();

// ─── Paths ────────────────────────────────────────────────────────────────────

const SCRAPED_PATH = path.resolve(
  "./scripts/Dynamic_Store_Content/scraped_results.json",
);
const GENERATED_PATH = path.resolve(
  "./scripts/Dynamic_Store_Content/generated_content.json",
);

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const LIMIT = parseInt(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0",
);
const TIER = args.find((a) => a.startsWith("--tier="))?.split("=")[1] || null;
const SLUG = args.find((a) => a.startsWith("--slug="))?.split("=")[1] || null;
const DRY_RUN = args.includes("--dry-run");
const RETRY_FAILED = args.includes("--retry-failed");
const FORCE = args.includes("--force");
const BLOCK_ISSUES = args.includes("--block-issues");

const MAX_RETRIES = 3;

// ─── Provider registry ────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    name: "Google",
    model: "gemini-2.5-flash-lite",
    delayMs: 5000,
    available: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
    exhausted: false,
    async call(systemPrompt, userPrompt) {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: 8192 },
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = new Error(err?.error?.message || `HTTP ${res.status}`);
        e.status = res.status;
        throw e;
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error("Empty response from Google");
      return text;
    },
  },
  {
    name: "Groq",
    model: "llama-3.3-70b-versatile",
    delayMs: 6000,
    available: !!process.env.GROQ_API_KEY,
    exhausted: false,
    async call(systemPrompt, userPrompt) {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.85,
            max_tokens: 6000,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = new Error(err?.error?.message || `HTTP ${res.status}`);
        e.status = res.status;
        throw e;
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Empty response from Groq");
      return text;
    },
  },
  {
    name: "OpenRouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    delayMs: 3000,
    available: !!process.env.OPENROUTER_API_KEY,
    exhausted: false,
    async call(systemPrompt, userPrompt) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://geniecoupon.com",
          "X-Title": "Genie Coupon Content Generator",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          temperature: 0.85,
          max_tokens: 6000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = new Error(err?.error?.message || `HTTP ${res.status}`);
        e.status = res.status;
        throw e;
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Empty response from OpenRouter");
      return text;
    },
  },
];

function getActiveProvider() {
  return PROVIDERS.find((p) => p.available && !p.exhausted) || null;
}

function markExhausted(name, permanent = false) {
  const p = PROVIDERS.find((p) => p.name === name);
  if (!p) return;
  p.exhausted = true;
  console.log(
    permanent
      ? `\n  ⛔ ${name} daily limit hit — disabled for this session\n`
      : `\n  ⏳ ${name} rate limited — cooling down 65s\n`,
  );
}

function resetProvider(name) {
  const p = PROVIDERS.find((p) => p.name === name);
  if (p) {
    p.exhausted = false;
    console.log(`\n  ✅ ${name} back online\n`);
  }
}

// ─── Sanitize ─────────────────────────────────────────────────────────────────

function sanitize(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\t/g, " ")
    .replace(/\r\n?/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Context builder ──────────────────────────────────────────────────────────
// offerSummary lives alongside scraped data — these are two separate sources.

function buildContext(merchant, scraped) {
  const w = scraped?.website || {};
  const tp = scraped?.trustpilot || {};
  const rd = scraped?.reddit || {};
  const hp = w.homepage || {};
  const off = merchant.offerSummary || {};

  return {
    // Store identity
    name: merchant.name,
    url: merchant.web_url || "",
    categories: Array.isArray(merchant.category_names)
      ? merchant.category_names.join(", ")
      : merchant.category_names || "",

    // Offer data (from DB via 01_fetch)
    activeCoupons: parseInt(merchant.active_coupons_count) || 0,
    offerTotalActive: off.totalActive || 0,
    offerCouponCount: off.couponCount || 0,
    offerDealCount: off.dealCount || 0,
    offerVerified: off.verifiedCount || 0,
    bestDiscount: off.bestDiscount || null, // e.g. "40"
    bestDiscountType: off.bestDiscountType || null, // "percentage" | "flat"
    discountRange: off.discountRange || null, // {min, max} or null
    topCodes: (off.topCodes || []).map(sanitize),
    topTitles: (off.topTitles || []).map(sanitize),

    // Homepage
    metaDescription: sanitize(hp.metaDescription || hp.ogDescription || ""),
    heroTaglines: (hp.heroTaglines || []).map(sanitize),
    productHeadings: (hp.productHeadings || []).map(sanitize),
    keyParagraphs: (hp.keyParagraphs || []).map(sanitize),
    customerReviews: (hp.customerReviews || []).map(sanitize),
    priceRange: sanitize(hp.priceRange || ""),
    trustSignals: hp.trustSignals || {},
    specialOffers: hp.specialOffers || {},
    visibleCodes: (hp.visibleCodes || []).map(sanitize),
    salePatterns: (hp.salePatterns || []).map(sanitize),

    // Subpages
    aboutParagraphs: (w.about?.keyParagraphs || []).map(sanitize),
    aboutMission: sanitize(w.about?.mission || ""),
    foundingStory: sanitize(w.about?.foundingStory || ""),
    aboutStats: (w.about?.stats || []).map(sanitize),
    faqs: (w.faq?.faqs || []).map((f) => ({
      question: sanitize(f.question),
      answer: sanitize(f.answer),
    })),
    shippingThreshold:
      sanitize(
        w.shipping?.freeShippingThreshold ||
          hp.trustSignals?.freeShippingThreshold ||
          "",
      ) || null,
    deliveryTimes: (w.shipping?.deliveryTimes || []).map(sanitize),
    internationalShipping: w.shipping?.internationalShipping || false,
    expressAvailable: w.shipping?.expressAvailable || false,
    returnWindow:
      sanitize(
        w.returns?.returnWindow || hp.trustSignals?.returnWindow || "",
      ) || null,
    freeReturns: w.returns?.freeReturns || false,
    returnConditions: (w.returns?.conditions || []).map(sanitize),

    // Trustpilot
    tpFound: tp.found && (tp.reviewCount || 0) >= 5,
    tpRating: tp.rating || null,
    tpReviewCount: tp.reviewCount || null,
    tpSnippets: (tp.snippets || []).map(sanitize),
    tpPraise: (tp.commonPraise || []).map(sanitize),
    tpComplaints: (tp.commonComplaints || []).map(sanitize),

    // Reddit
    rdFound: rd.found || false,
    rdSentiment: rd.overallSentiment || "neutral",
    rdQuestions: (rd.commonQuestions || []).map(sanitize),
    rdComplaints: (rd.commonComplaints || []).map(sanitize),
    rdThreads: (rd.threads?.slice(0, 4) || []).map((t) => ({
      ...t,
      title: sanitize(t.title),
      snippet: sanitize(t.snippet),
    })),
  };
}

// ─── Template picker ──────────────────────────────────────────────────────────

const TEMPLATES = {
  "Health & Fitness": "problem_solution",
  "Health & Wellness": "problem_solution",
  Pets: "problem_solution",
  "Sports & Outdoors": "problem_solution",
  "Baby & Kids": "problem_solution",
  Beauty: "problem_solution",
  "Personal Care": "problem_solution",
  "Computers & Electronics": "specs_buyer_guide",
  Electronics: "specs_buyer_guide",
  Technology: "specs_buyer_guide",
  Automotive: "specs_buyer_guide",
  "Tools & Home Improvement": "specs_buyer_guide",
  "Musical Instruments": "specs_buyer_guide",
  Finance: "risk_benefit",
  Investing: "risk_benefit",
  Insurance: "risk_benefit",
  Legal: "risk_benefit",
  Software: "usecase_results",
  "Software & Tools": "usecase_results",
  "Marketing & SaaS": "usecase_results",
  Education: "usecase_results",
  "Online Learning": "usecase_results",
  Business: "usecase_results",
  "Clothing & Apparel": "lifestyle",
  "Home & Garden": "lifestyle",
  "Food & Drink": "lifestyle",
  Gifts: "lifestyle",
  Jewelry: "lifestyle",
  "Art & Crafts": "lifestyle",
  default: "standard",
};

function pickTemplate(ctx) {
  const cats = (ctx.categories || "").split(",").map((c) => c.trim());
  for (const c of cats) {
    if (TEMPLATES[c]) return TEMPLATES[c];
  }
  return TEMPLATES.default;
}

// ─── Dynamic heading sets per template ────────────────────────────────────────
// LLM picks one heading from each slot. This prevents identical H3 patterns
// across all store pages — a strong templated-content signal to Google.

const HEADING_OPTIONS = {
  problem_solution: {
    s1: [
      "Why People Turn to {store}",
      "The Problem {store} Solves",
      "What Brings Shoppers to {store}",
    ],
    s2: [
      "What {store} Offers",
      "Inside {store}'s Product Range",
      "What You Can Buy at {store}",
    ],
    s3: [
      "How to Save at {store}",
      "Getting the Best Price at {store}",
      "Saving Money at {store}",
    ],
    s4: [
      "Are {store} Coupon Codes Legit?",
      "Can You Trust {store} Discounts?",
      "Do {store} Promo Codes Work?",
    ],
    s5: [
      "Best Time to Shop at {store}",
      "When to Buy at {store}",
      "Timing Your {store} Purchase",
    ],
    s6: [
      "{store} Shipping and Returns",
      "Delivery and Returns at {store}",
      "{store} Shipping Policy",
    ],
  },
  specs_buyer_guide: {
    s1: [
      "Who Should Shop at {store}",
      "Is {store} Right for You?",
      "What to Know Before Buying from {store}",
    ],
    s2: [
      "What {store} Sells",
      "{store}'s Product Lineup",
      "The {store} Catalog",
    ],
    s3: [
      "How to Pay Less at {store}",
      "Finding Discounts at {store}",
      "Saving on {store} Orders",
    ],
    s4: [
      "Are {store} Promo Codes Verified?",
      "How Reliable Are {store} Coupon Codes?",
      "Do {store} Codes Actually Work?",
    ],
    s5: [
      "When to Buy from {store}",
      "Best Deals Calendar for {store}",
      "Peak Sale Times at {store}",
    ],
    s6: [
      "Shipping and Returns at {store}",
      "{store} Delivery Policy",
      "How {store} Handles Returns",
    ],
  },
  risk_benefit: {
    s1: [
      "What {store} Actually Does",
      "Understanding {store}",
      "The {store} Breakdown",
    ],
    s2: [
      "What {store} Provides",
      "{store}'s Services and Products",
      "What You Get from {store}",
    ],
    s3: [
      "Reducing Your Cost at {store}",
      "Lowering the Price at {store}",
      "Discount Options at {store}",
    ],
    s4: [
      "Are {store} Deals Trustworthy?",
      "Verifying {store} Coupon Codes",
      "The Truth About {store} Discounts",
    ],
    s5: [
      "Best Time to Sign Up or Buy at {store}",
      "When {store} Offers Peak Deals",
      "Timing Matters at {store}",
    ],
    s6: [
      "{store} Policies Explained",
      "Terms and Protections at {store}",
      "What {store} Guarantees",
    ],
  },
  usecase_results: {
    s1: [
      "What {store} Is Built For",
      "Who Uses {store} and Why",
      "The {store} Use Case",
    ],
    s2: [
      "What {store} Includes",
      "{store}'s Features and Products",
      "Inside the {store} Platform",
    ],
    s3: [
      "Cutting Costs at {store}",
      "How to Spend Less on {store}",
      "Discounts and Deals at {store}",
    ],
    s4: [
      "Are {store} Coupon Codes Real?",
      "Validating {store} Promo Codes",
      "Do {store} Discounts Stack?",
    ],
    s5: [
      "Cheapest Time to Buy {store}",
      "When {store} Runs Promotions",
      "Best Deals Windows at {store}",
    ],
    s6: [
      "{store} Billing and Cancellation",
      "Refunds and Plans at {store}",
      "{store} Terms You Should Know",
    ],
  },
  lifestyle: {
    s1: [
      "The {store} Experience",
      "Why Shoppers Come Back to {store}",
      "Life With {store}",
    ],
    s2: [
      "What {store} Has to Offer",
      "Exploring the {store} Range",
      "{store}'s Collections",
    ],
    s3: [
      "Spending Less at {store}",
      "Making {store} More Affordable",
      "Your Guide to {store} Savings",
    ],
    s4: [
      "Are {store} Codes Worth Using?",
      "How Good Are {store} Deals?",
      "What {store} Discounts Are Available?",
    ],
    s5: [
      "Best Season to Shop {store}",
      "When {store} Has the Best Sales",
      "Timing Your {store} Haul",
    ],
    s6: [
      "Shipping and Returns at {store}",
      "How {store} Handles Delivery",
      "{store} Return Policy",
    ],
  },
  standard: {
    s1: ["About {store}", "What Is {store}?", "Getting to Know {store}"],
    s2: [
      "What {store} Sells",
      "The {store} Product Range",
      "Shopping at {store}",
    ],
    s3: [
      "How to Save at {store}",
      "Coupons and Deals at {store}",
      "Discounts at {store}",
    ],
    s4: [
      "Are {store} Coupon Codes Legit?",
      "Do {store} Promo Codes Work?",
      "Verifying {store} Discounts",
    ],
    s5: [
      "Best Time to Shop at {store}",
      "When {store} Has Sales",
      "Smart Timing at {store}",
    ],
    s6: [
      "{store} Shipping and Returns",
      "Delivery Info for {store}",
      "{store} Return Policy",
    ],
  },
};

function headingChoicesBlock(template, store) {
  const opts = HEADING_OPTIONS[template] || HEADING_OPTIONS.standard;
  const lines = [];
  for (const [slot, choices] of Object.entries(opts)) {
    const formatted = choices
      .map((h) => `"${h.replace(/{store}/g, store)}"`)
      .join(" | ");
    lines.push(
      `  Section ${slot.slice(1)}: Pick one heading from → ${formatted}`,
    );
  }
  return lines.join("\n");
}

// ─── Meta title builder ───────────────────────────────────────────────────────

function buildMetaTitle(ctx) {
  const store = ctx.name;
  const month = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const catMap = {
    "Health & Fitness": "Fitness Gear",
    "Health & Wellness": "Wellness Products",
    "Sports & Outdoors": "Outdoor Gear",
    Pets: "Pet Supplies",
    "Computers & Electronics": "Electronics",
    Electronics: "Electronics",
    Technology: "Tech Products",
    Software: "Software",
    "Software & Tools": "Software",
    Finance: "Financial Services",
    "Clothing & Apparel": "Clothing",
    "Home & Garden": "Home & Garden",
    Beauty: "Beauty Products",
    Education: "Online Courses",
  };
  const cats = (ctx.categories || "").split(",").map((c) => c.trim());
  const catNoun = cats.map((c) => catMap[c]).find(Boolean) || null;

  const fit = (s, max = 70) => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const sp = cut.lastIndexOf(" ");
    return (sp > max - 15 ? cut.slice(0, sp) : cut).trim();
  };

  // Offer-aware variants — prioritized by specificity
  const hasDiscount = ctx.bestDiscount && ctx.bestDiscountType;
  const hasCodes = ctx.topCodes.length > 0;
  const hasTp = ctx.tpFound && ctx.tpRating >= 4.0 && ctx.tpReviewCount >= 100;

  const discountLabel = hasDiscount
    ? ctx.bestDiscountType === "percentage"
      ? `Up to ${ctx.bestDiscount}% Off`
      : `Up to $${ctx.bestDiscount} Off`
    : null;

  const variants = [
    // Best: discount + coupon count + month
    hasDiscount && ctx.activeCoupons >= 3
      ? `${store} Coupons — ${discountLabel} + ${ctx.activeCoupons} Verified Codes [${month}] | Genie Coupon`
      : null,
    // Discount only
    hasDiscount ? `${store} Coupons — ${discountLabel} | Genie Coupon` : null,
    // Top code featured
    hasCodes && ctx.topCodes[0]
      ? `${store} Promo Code: ${ctx.topCodes[0]} + ${ctx.activeCoupons > 1 ? ctx.activeCoupons - 1 + " More" : ""} Deals | Genie Coupon`
      : null,
    // Trustpilot-rated
    hasTp
      ? `${store} Coupons — Rated ${ctx.tpRating}★ by ${ctx.tpReviewCount.toLocaleString()} Shoppers | Genie Coupon`
      : null,
    // Category + count
    ctx.activeCoupons >= 5 && catNoun
      ? `${store} ${catNoun} Coupons — ${ctx.activeCoupons} Verified Codes | Genie Coupon`
      : null,
    // Count + month
    ctx.activeCoupons >= 5
      ? `${store} Coupons — ${ctx.activeCoupons} Verified Codes [${month}] | Genie Coupon`
      : null,
    // Category fallback
    catNoun ? `${store} ${catNoun} Coupons & Promo Codes | Genie Coupon` : null,
    // Month fallback
    `${store} Coupons & Promo Codes [${month}] | Genie Coupon`,
    // Last resort
    `${store} Coupons & Promo Codes | Genie Coupon`,
  ].filter(Boolean);

  for (const v of variants) {
    if (v.length <= 70) return v;
  }
  return fit(`${store} Coupons & Promo Codes | Genie Coupon`);
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior SEO content writer for Genie Coupon, a coupon and deals website.
Your job is to write store pages that rank on Google for "[store] coupons" queries and convert browsers into clickers.

Rules you never break:
1. Return ONLY a valid JSON object. No markdown. No code fences. No text outside {}.
2. Never invent facts. If data is missing, say so honestly using the phrase "not listed on their site".
3. Never use: seamlessly, elevate, dive into, treasure trove, game-changer, curated, unlock savings, leverage, empower, in today's world, cutting-edge, robust, delve, navigate, realm.
4. Write like a knowledgeable friend, not a press release.
5. Section headings MUST be chosen from the provided heading options — do not invent your own.
6. WORD COUNT: description_html must contain AT LEAST 700 visible words across all 6 sections. Do not pad — write substantively. Responses under 700 words are REJECTED.
7. When OFFER DATA contains real discount values or coupon codes, you MUST reference them specifically — do not genericize them.`;

// ─── FAQ pool builder ─────────────────────────────────────────────────────────

function buildFaqs(ctx, store) {
  const pool = [];

  // Slots 1–4: contextual sources in priority order
  for (const f of ctx.faqs.slice(0, 4)) {
    if (pool.length >= 4) break;
    pool.push({ source: "store_faq", q: f.question, a: f.answer });
  }
  for (const complaint of ctx.tpComplaints) {
    if (pool.length >= 4) break;
    pool.push({ source: "tp_complaint", q: null, hint: complaint });
  }
  for (const rq of ctx.rdQuestions) {
    if (pool.length >= 4) break;
    pool.push({ source: "reddit", q: rq });
  }
  if (pool.length < 4 && ctx.shippingThreshold) {
    pool.push({
      source: "policy",
      q: `Does ${store} offer free shipping?`,
      hint: ctx.shippingThreshold,
    });
  }
  if (pool.length < 4 && ctx.returnWindow) {
    pool.push({
      source: "policy",
      q: `What is ${store}'s return policy?`,
      hint: ctx.returnWindow,
    });
  }
  if (pool.length < 4 && ctx.freeReturns) {
    pool.push({
      source: "policy",
      q: `Does ${store} offer free returns?`,
      hint: "yes",
    });
  }
  if (pool.length < 4 && ctx.deliveryTimes.length) {
    pool.push({
      source: "policy",
      q: `How long does ${store} take to deliver?`,
      hint: ctx.deliveryTimes.join(", "),
    });
  }
  // Generic fallbacks
  const generics = [
    { source: "generic", q: `Is ${store} a legitimate company?` },
    { source: "generic", q: `What payment methods does ${store} accept?` },
    {
      source: "generic",
      q: `Does ${store} have a loyalty or rewards program?`,
    },
    { source: "generic", q: `Can I use multiple coupon codes at ${store}?` },
  ];
  for (const g of generics) {
    if (pool.length >= 4) break;
    pool.push(g);
  }

  // Slots 5–6: offer-grounded — use actual DB data
  // Slot 5: best current code or best discount
  if (ctx.topCodes.length > 0) {
    pool.push({
      source: "offer_code",
      q: `What is the best ${store} coupon code right now?`,
      hint: `Top code: ${ctx.topCodes[0]}${ctx.topCodes.length > 1 ? `. Other active codes: ${ctx.topCodes.slice(1).join(", ")}` : ""}. Total active: ${ctx.offerTotalActive}.`,
    });
  } else if (ctx.bestDiscount) {
    pool.push({
      source: "offer_discount",
      q: `How much can I save at ${store} right now?`,
      hint: `Best current discount: ${ctx.bestDiscount}${ctx.bestDiscountType === "percentage" ? "%" : " dollars"} off. ${ctx.offerTotalActive} active offers total.`,
    });
  } else {
    pool.push({
      source: "coupon_generic",
      q: `Do ${store} coupon codes actually work?`,
      hint: `${ctx.offerTotalActive} active offers tracked on Genie Coupon.`,
    });
  }

  // Slot 6: verified deals angle
  if (ctx.offerVerified > 0) {
    pool.push({
      source: "offer_verified",
      q: `Does ${store} have any verified deals with proof?`,
      hint: `${ctx.offerVerified} verified offer${ctx.offerVerified > 1 ? "s" : ""} with screenshot proof on Genie Coupon.${ctx.topTitles.length ? " Examples: " + ctx.topTitles.slice(0, 2).join("; ") : ""}`,
    });
  } else if (ctx.offerDealCount > 0) {
    pool.push({
      source: "offer_deals",
      q: `Does ${store} have any deals without a coupon code?`,
      hint: `${ctx.offerDealCount} active deal${ctx.offerDealCount > 1 ? "s" : ""} (no code needed) on Genie Coupon.`,
    });
  } else {
    pool.push({
      source: "coupon_best",
      q: `What is the best ${store} discount available right now?`,
      hint: `${ctx.offerTotalActive} offers tracked. ${ctx.bestDiscount ? "Best: " + ctx.bestDiscount + (ctx.bestDiscountType === "percentage" ? "% off." : " dollars off.") : "Check Genie Coupon for latest."}`,
    });
  }

  return pool.slice(0, 6);
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(ctx) {
  const store = ctx.name;
  const template = pickTemplate(ctx);
  const faqPool = buildFaqs(ctx, store);

  const hasTp = ctx.tpFound && ctx.tpRating && ctx.tpReviewCount;
  const hasReviews =
    hasTp ||
    (ctx.trustSignals.reviewCount &&
      ctx.trustSignals.reviewCount !== "unknown");
  const hasCoupons = ctx.activeCoupons > 0;
  const hasShip = ctx.shippingThreshold || ctx.freeReturns || ctx.returnWindow;
  const hasSales =
    ctx.salePatterns.length > 0 ||
    Object.values(ctx.specialOffers).some(Boolean);
  const hasOffers = ctx.offerTotalActive > 0;

  // Offer summary sentence for reuse across sections
  const offerSummary = hasOffers
    ? [
        ctx.bestDiscount
          ? `Save ${
              ctx.discountRange
                ? `${ctx.discountRange.min}–${ctx.discountRange.max}% off`
                : `up to ${ctx.bestDiscount}${ctx.bestDiscountType === "percentage" ? "%" : " dollars"} off`
            }`
          : null,
        ctx.topCodes.length ? `codes include ${ctx.topCodes.join(", ")}` : null,
        ctx.offerVerified > 0
          ? `${ctx.offerVerified} offers verified with screenshot proof`
          : null,
      ]
        .filter(Boolean)
        .join("; ")
    : null;

  const openingInstruction =
    {
      problem_solution: `Open by naming the specific problem or frustration shoppers in this niche face (use product headings and key paragraphs as clues). Then explain how ${store} addresses that problem. Do not start with "Are you looking for".`,
      specs_buyer_guide: `Open by describing exactly who buys from ${store} and why — the specific use case, skill level, or need. Then walk through 2–3 buying criteria relevant to this product category using STORE DATA.`,
      risk_benefit: `Open with the main fear or risk users have in this category. Then explain what ${store} does — or does not do — to address that concern, using only facts from STORE DATA.`,
      usecase_results: `Open with 2 concrete, specific use cases for ${store}'s product or service. Name the type of user and what they are trying to achieve — not "businesses" but "small ecommerce teams" or "freelance designers".`,
      lifestyle: `Open with the context or moment in someone's life where ${store}'s products matter. Ground it in specifics from STORE DATA — product types, collections, or the brand's stated mission.`,
      standard: `Open with the single most distinctive or credible fact about ${store} from STORE DATA — a rating, product range, policy, or founding story.`,
    }[template] ||
    `Open with the strongest specific fact about ${store} from STORE DATA.`;

  const storeData = `
STORE: ${store}
URL: ${ctx.url}
CATEGORIES: ${ctx.categories || "not specified"}
ACTIVE COUPONS ON GENIE COUPON: ${ctx.activeCoupons}

OFFER DATA (live from Genie Coupon DB — use these as facts):
- Total active offers: ${ctx.offerTotalActive}
- Coupons (require code): ${ctx.offerCouponCount}
- Deals (no code needed): ${ctx.offerDealCount}
- Verified with proof: ${ctx.offerVerified}
- Best discount: ${ctx.bestDiscount ? `${ctx.bestDiscount}${ctx.bestDiscountType === "percentage" ? "%" : " dollars"} off` : "not available"}
- Discount range: ${ctx.discountRange ? `${ctx.discountRange.min}%–${ctx.discountRange.max}% off` : "n/a"}
- Top coupon codes: ${ctx.topCodes.length ? ctx.topCodes.join(", ") : "none"}
- Top offer titles: ${ctx.topTitles.length ? ctx.topTitles.join(" | ") : "none"}

HOMEPAGE DATA:
- Meta description: ${ctx.metaDescription || "not found"}
- Hero taglines: ${ctx.heroTaglines.slice(0, 5).join(" | ") || "none"}
- Product headings: ${ctx.productHeadings.slice(0, 8).join(", ") || "none"}
- Key paragraphs: ${ctx.keyParagraphs.slice(0, 4).join(" /// ") || "none"}
- Price range on site: ${ctx.priceRange || "not found"}
- Customer reviews on site: ${ctx.customerReviews.slice(0, 3).join(" /// ") || "none"}
- Sale patterns detected: ${ctx.salePatterns.join(", ") || "none detected"}
- Special offers: ${
    Object.entries(ctx.specialOffers)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ") || "none"
  }
- Visible promo codes on site: ${ctx.visibleCodes.filter((c) => c.length >= 4).join(", ") || "none"}

SHIPPING & RETURNS:
- Free shipping threshold: ${ctx.shippingThreshold || "not listed on their site"}
- Return window: ${ctx.returnWindow || "not listed on their site"}
- Free returns: ${ctx.freeReturns ? "yes" : "not confirmed"}
- Delivery times: ${ctx.deliveryTimes.join(", ") || "not listed on their site"}
- International shipping: ${ctx.internationalShipping ? "yes" : "not confirmed"}
- Express shipping: ${ctx.expressAvailable ? "yes" : "not confirmed"}
- Warranty: ${ctx.trustSignals.warranty || "not listed on their site"}

ABOUT PAGE:
${ctx.aboutParagraphs.slice(0, 3).join(" /// ") || "not available"}
${ctx.foundingStory ? "Founding story: " + ctx.foundingStory : ""}
${ctx.aboutMission ? "Mission: " + ctx.aboutMission : ""}
${ctx.aboutStats.length ? "Stats/claims: " + ctx.aboutStats.join(", ") : ""}

STORE FAQ DATA:
${
  ctx.faqs.length
    ? ctx.faqs
        .slice(0, 6)
        .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
        .join("\n---\n")
    : "none available"
}

TRUSTPILOT:
${hasTp ? `Rating: ${ctx.tpRating}★ from ${ctx.tpReviewCount.toLocaleString()} reviews` : "not found on Trustpilot"}
${ctx.tpSnippets.length ? "Review snippets: " + ctx.tpSnippets.slice(0, 3).join(" /// ") : ""}
${ctx.tpPraise.length ? "What customers praise: " + ctx.tpPraise.join(", ") : ""}
${ctx.tpComplaints.length ? "Common complaints: " + ctx.tpComplaints.join(", ") : ""}

REDDIT:
${ctx.rdFound ? `Sentiment: ${ctx.rdSentiment} across ${ctx.rdThreads.length} threads` : "no relevant Reddit threads found"}
${ctx.rdQuestions.length ? "Questions people ask: " + ctx.rdQuestions.join(" | ") : ""}
${ctx.rdComplaints.length ? "Complaints: " + ctx.rdComplaints.join(" | ") : ""}
`.trim();

  return `Write a complete store page for Genie Coupon using the STORE DATA below.
Return ONLY valid JSON matching the exact shape at the bottom. No other text.

═══════════════════════════════════════
SECTION HEADINGS — YOU MUST USE THESE
═══════════════════════════════════════
Your description_html must use exactly one <h3> heading per section.
Pick one heading per section from the options below. Do not invent headings.

${headingChoicesBlock(template, store)}

═══════════════════════════════════════
FIELD: meta_description
═══════════════════════════════════════
Length: 145–158 characters exactly. Count carefully.
Formula: [Action verb, not "Discover" or "Explore"] + [specific benefit using a REAL number from OFFER DATA or STORE DATA] + [brand name] + closing phrase.
- If OFFER DATA has a best discount: use it. e.g. "Save up to 40% at Nike with ${ctx.activeCoupons} verified coupon codes. Find current promo codes at Genie Coupon."
- If OFFER DATA has top codes: name one. e.g. "Use code SAVE20 at Checkout at Nike — plus ${ctx.activeCoupons > 1 ? ctx.activeCoupons - 1 + " more verified codes" : "more deals"} at Genie Coupon."
- If no discount data: use Trustpilot rating+count OR return window as the number.
- Never produce a meta that could apply to any store — it must be specific to ${store}.

═══════════════════════════════════════
FIELD: side_description_html
═══════════════════════════════════════
50–80 words. One <p> tag.
Sentence 1: The single strongest reason to shop at ${store} — use a specific fact (offer, rating, product type, or founding story).
${hasOffers && offerSummary ? `You have real offer data: ${offerSummary}. Use it.` : ""}
Sentence 2: One practical saving tip (coupon, sale pattern, or policy perk).
Sentence 3: Direct readers to Genie Coupon for verified codes.
Do not use bullet points. Do not repeat the store name more than twice.

═══════════════════════════════════════
FIELD: table_content_html
═══════════════════════════════════════
100–150 words. Use <p> tags only (no lists, no headings).
Paragraph 1: What ${store} sells and who it is for. Use product headings and category data.
Paragraph 2: What sets them apart — policy, brand story, rating, or specific product advantage. Use only facts from STORE DATA.
Do not mention Genie Coupon here.

═══════════════════════════════════════
FIELD: description_html
═══════════════════════════════════════
MINIMUM 700 visible words. Write every section in full — do not summarize.
Use <h3> for section headings (one per section, chosen from options above).
Use <p> for paragraphs. No <ul> or <li>.
Mention ${store} by name 3–6 times total.

--- SECTION 1 ---
${openingInstruction}
End this section by naturally bridging to what they sell. Target: 110–140 words.

--- SECTION 2 ---
Use product headings, key paragraphs, and category data from STORE DATA.
Name specific product types, collections, or service tiers.
${ctx.productHeadings.length ? `Their product areas include: ${ctx.productHeadings.slice(0, 6).join(", ")}.` : ""}
${ctx.priceRange ? `Price range found: ${ctx.priceRange} — mention it.` : ""}
Do not write "they sell a wide range of products". Be specific. Target: 110–140 words.

--- SECTION 3 ---
Cover ALL of the following that apply:
${
  hasOffers
    ? `- Genie Coupon currently tracks ${ctx.offerTotalActive} active offers (${ctx.offerCouponCount} coupons, ${ctx.offerDealCount} deals).`
    : `- Note that coupon availability varies — check Genie Coupon for current offers.`
}
${ctx.bestDiscount ? `- Best current discount: ${ctx.bestDiscount}${ctx.bestDiscountType === "percentage" ? "%" : " dollars"} off — mention this specifically.` : ""}
${ctx.topCodes.length ? `- Active coupon codes: ${ctx.topCodes.join(", ")} — name at least one.` : ""}
${ctx.offerVerified > 0 ? `- ${ctx.offerVerified} offers are verified with screenshot proof on Genie Coupon — mention this.` : ""}
${hasSales ? `- Detected sale patterns: ${ctx.salePatterns.join(", ") || "see special offers"}.` : "- Mention when to expect sales based on category norms (Black Friday, end-of-season, etc.)."}
${ctx.specialOffers.loyaltyProgram ? "- Loyalty or rewards program — mention it." : ""}
${ctx.specialOffers.subscriptionSave ? "- Subscribe-and-save discount — mention it." : ""}
${ctx.specialOffers.referralProgram ? "- Referral program — mention it." : ""}
- Explain how to apply a coupon code at checkout in 1–2 sentences.
Target: 110–140 words.

--- SECTION 4 ---
${hasTp ? `Reference the Trustpilot rating of ${ctx.tpRating}★ from ${ctx.tpReviewCount.toLocaleString()} reviews.` : ""}
${ctx.rdSentiment && ctx.rdFound ? `Reddit sentiment is ${ctx.rdSentiment} — reference this honestly.` : ""}
Confirm that Genie Coupon tracks and verifies codes for ${store}.
${hasOffers ? `State that ${ctx.offerTotalActive} offers are currently listed, ${ctx.offerVerified > 0 ? ctx.offerVerified + " with screenshot proof" : "checked for accuracy"}.` : ""}
Be honest — if complaints exist in STORE DATA, acknowledge them neutrally.
Target: 90–110 words.

--- SECTION 5 ---
${
  hasSales
    ? `Use detected patterns: ${ctx.salePatterns.join(", ")}.`
    : `No specific sale data found. Write about seasonal buying patterns for ${ctx.categories || "this category"} — when demand peaks, when discounts appear. Be honest that specific sale dates for ${store} are not confirmed.`
}
${ctx.specialOffers.clearanceSale ? "Mention clearance/sale section if present." : ""}
Connect to coupon strategy — using a Genie Coupon code on top of a sale.
Target: 90–110 words.

--- SECTION 6 ---
${
  hasShip
    ? `Use these confirmed facts:
${ctx.shippingThreshold ? `- Free shipping threshold: ${ctx.shippingThreshold}` : ""}
${ctx.returnWindow ? `- Return window: ${ctx.returnWindow}` : ""}
${ctx.freeReturns ? `- Free returns confirmed` : ""}
${ctx.deliveryTimes.length ? `- Delivery times: ${ctx.deliveryTimes.join(", ")}` : ""}
${ctx.internationalShipping ? "- International shipping available" : ""}`
    : `No shipping or return data found for ${store}. Be transparent — state policies are not clearly listed, direct readers to ${store}'s website or support for accurate details.`
}
Target: 90–110 words.

═══════════════════════════════════════
FIELD: faqs
═══════════════════════════════════════
Exactly 6 FAQ objects. Each answer: 2–3 sentences — direct answer first, then useful detail.
Never invent policies, percentages, or guarantees not in STORE DATA or OFFER DATA.

${faqPool
  .map((f, i) => {
    if (f.source === "store_faq")
      return `FAQ ${i + 1}: Rewrite in your own words — Q: "${f.q}" A: "${f.a}"`;
    if (f.source === "tp_complaint")
      return `FAQ ${i + 1}: Turn this Trustpilot complaint into a question and answer honestly: "${f.hint}"`;
    if (f.source === "reddit")
      return `FAQ ${i + 1}: Answer this question people ask on Reddit: "${f.q}"`;
    if (f.source === "policy")
      return `FAQ ${i + 1}: Q: "${f.q}" — answer using: "${f.hint}"`;
    if (f.source === "offer_code")
      return `FAQ ${i + 1}: Q: "${f.q}" — answer using this OFFER DATA: ${f.hint}`;
    if (f.source === "offer_discount")
      return `FAQ ${i + 1}: Q: "${f.q}" — answer using this OFFER DATA: ${f.hint}`;
    if (f.source === "offer_verified")
      return `FAQ ${i + 1}: Q: "${f.q}" — answer using this OFFER DATA: ${f.hint}`;
    if (f.source === "offer_deals")
      return `FAQ ${i + 1}: Q: "${f.q}" — answer using this OFFER DATA: ${f.hint}`;
    if (f.source === "coupon_generic" || f.source === "coupon_best")
      return `FAQ ${i + 1}: Q: "${f.q}" — answer using: ${f.hint}`;
    return `FAQ ${i + 1}: Write a relevant question and honest answer about ${store} using STORE DATA.`;
  })
  .join("\n")}

═══════════════════════════════════════
FIELD: trust_text
═══════════════════════════════════════
1–2 sentences. Use ONLY real signals from STORE DATA or OFFER DATA:
${hasTp ? `- Trustpilot: ${ctx.tpRating}★ from ${ctx.tpReviewCount.toLocaleString()} reviews` : ""}
${hasReviews && !hasTp ? `- On-site reviews: ${ctx.trustSignals.reviewCount}` : ""}
${ctx.returnWindow ? `- Return window: ${ctx.returnWindow}` : ""}
${ctx.freeReturns ? `- Free returns confirmed` : ""}
${hasOffers ? `- ${ctx.offerTotalActive} active offers on Genie Coupon${ctx.offerVerified > 0 ? `, ${ctx.offerVerified} verified with proof` : ""}` : ""}
If none apply: "Store information is based on publicly available data from ${store}'s official website."

═══════════════════════════════════════
STORE DATA (your only factual source):
═══════════════════════════════════════
${storeData}

═══════════════════════════════════════
RETURN THIS EXACT JSON SHAPE:
═══════════════════════════════════════
{
  "meta_description": "string, 145-158 chars",
  "side_description_html": "string, HTML",
  "table_content_html": "string, HTML",
  "description_html": "string, HTML, 700+ visible words",
  "faqs": [{"question": "string", "answer": "string"}],
  "trust_text": "string"
}`;
}

// ─── Meta description auto-fix ────────────────────────────────────────────────

function fixMetaDescription(meta, ctx) {
  if (!meta) return meta;
  meta = meta.trim();
  if (meta.length >= 145 && meta.length <= 158) return meta;

  if (meta.length > 158) {
    const cut = meta.slice(0, 158);
    const last = Math.max(
      cut.lastIndexOf(". "),
      cut.lastIndexOf("! "),
      cut.lastIndexOf("? "),
    );
    if (last > 120) return meta.slice(0, last + 1).trim();
    const sp = cut.lastIndexOf(" ");
    return (sp > 130 ? cut.slice(0, sp) : cut).replace(/[,\s]+$/, "") + ".";
  }

  // Under 145 — pad with offer-aware phrases, not canned generic ones
  if (meta.endsWith(".")) meta = meta.slice(0, -1);

  const pads = [];
  if (ctx.bestDiscount && ctx.bestDiscountType === "percentage") {
    pads.push(
      ` Save up to ${ctx.bestDiscount}% — find verified codes at Genie Coupon.`,
    );
  }
  if (ctx.topCodes.length > 0) {
    pads.push(
      ` Code ${ctx.topCodes[0]} and ${ctx.activeCoupons > 1 ? ctx.activeCoupons - 1 + " more offers" : "more deals"} at Genie Coupon.`,
    );
  }
  if (ctx.offerVerified > 0) {
    pads.push(
      ` ${ctx.offerVerified} offers verified with proof at Genie Coupon.`,
    );
  }
  if (ctx.tpFound && ctx.tpRating) {
    pads.push(
      ` Rated ${ctx.tpRating}★ on Trustpilot. Find verified codes at Genie Coupon.`,
    );
  }
  if (ctx.returnWindow) {
    pads.push(
      ` ${ctx.returnWindow} returns available. Verified codes at Genie Coupon.`,
    );
  }
  // Universal fallbacks
  if (ctx.activeCoupons > 0) {
    pads.push(` Browse ${ctx.activeCoupons} active offers at Genie Coupon.`);
  }
  pads.push(` Find verified discount codes at Genie Coupon.`);
  pads.push(` Check Genie Coupon for the latest verified coupon codes.`);

  for (const pad of pads) {
    const c = meta + pad;
    if (c.length >= 145 && c.length <= 158) return c;
  }
  const forced = (meta + pads[0]).slice(0, 158);
  const sp = forced.lastIndexOf(" ");
  return (sp > 130 ? forced.slice(0, sp) : forced).replace(/[,\s]+$/, "") + ".";
}

// ─── JSON parser ──────────────────────────────────────────────────────────────

function sanitizeJsonStringValues(jsonStr) {
  let result = "",
    inString = false,
    escaped = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i],
      code = jsonStr.charCodeAt(i);
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      if (
        (code >= 0x00 && code <= 0x08) ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        code === 0x7f
      ) {
        result += " ";
        continue;
      }
      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        result += "\\r";
        continue;
      }
      if (ch === "\t") {
        result += "\\t";
        continue;
      }
    }
    result += ch;
  }
  return result;
}

function parseResponse(raw) {
  let clean = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const start = clean.indexOf("{");
  if (start === -1) throw new Error("No JSON object in response");
  let depth = 0,
    end = -1;
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === "{") depth++;
    else if (clean[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error("Unterminated JSON object");
  return JSON.parse(sanitizeJsonStringValues(clean.slice(start, end + 1)));
}

// ─── Validate ─────────────────────────────────────────────────────────────────

function validate(content, ctx) {
  const issues = [];
  const visible = (content.description_html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const wc = visible ? visible.split(/\s+/).filter(Boolean).length : 0;
  const meta = (content.meta_description || "").trim();
  const faqs = Array.isArray(content.faqs) ? content.faqs.length : 0;

  const banned = [
    "in today's world",
    "dive into",
    "unlock savings",
    "treasure trove",
    "elevate your",
    "seamlessly",
    "game-changer",
    "curated selection",
    "delve",
    "navigate your",
    "realm of",
  ];

  if (wc < 650) issues.push(`desc too short: ${wc}w`);
  if (wc > 1000) issues.push(`desc too long: ${wc}w`);
  if (meta.length < 145) issues.push(`meta too short: ${meta.length}c`);
  if (meta.length > 158) issues.push(`meta too long: ${meta.length}c`);
  if (!/\d/.test(meta)) issues.push("meta has no number");
  if (faqs !== 6) issues.push(`expected 6 FAQs, got ${faqs}`);
  if (!visible.toLowerCase().includes(ctx.name.toLowerCase()))
    issues.push("store name missing from description");
  if (banned.some((b) => visible.toLowerCase().includes(b)))
    issues.push("contains banned phrases");

  // Offer consistency: if we have a real discount, description should mention it
  if (ctx.bestDiscount && ctx.bestDiscountType === "percentage") {
    if (
      !visible.includes(ctx.bestDiscount + "%") &&
      !visible.toLowerCase().includes("save up to")
    )
      issues.push(
        `offer data (${ctx.bestDiscount}%) not reflected in description`,
      );
  }

  return issues;
}

function hasMalformedHtml(html) {
  return html ? /<[a-zA-Z][^>]*$|<p[A-Z]/m.test(html) : false;
}

// ─── Generate with provider rotation ─────────────────────────────────────────

async function generateContent(ctx, attempt = 1, forcedProvider = null) {
  const provider = forcedProvider || getActiveProvider();
  if (!provider) throw new Error("All providers exhausted. Resume tomorrow.");

  try {
    const raw = await provider.call(SYSTEM_PROMPT, buildPrompt(ctx));
    if (!raw) throw new Error("Empty response");

    const parsed = parseResponse(raw);

    if (hasMalformedHtml(parsed.description_html) && attempt <= MAX_RETRIES) {
      console.log(`    🔄 Malformed HTML — retry ${attempt}/${MAX_RETRIES}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return generateContent(ctx, attempt + 1, provider);
    }

    const wc = (parsed.description_html || "")
      .replace(/<[^>]+>/g, " ")
      .split(/\s+/)
      .filter(Boolean).length;
    if (wc < 400) {
      const next = PROVIDERS.find(
        (p) => p.available && !p.exhausted && p.name !== provider.name,
      );
      if (next && attempt <= MAX_RETRIES) {
        console.log(`    🔄 Too short (${wc}w) — switching to ${next.name}`);
        return generateContent(ctx, attempt + 1, next);
      }
      if (attempt <= MAX_RETRIES) {
        console.log(
          `    🔄 Too short (${wc}w) — retry ${attempt}/${MAX_RETRIES}`,
        );
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        return generateContent(ctx, attempt + 1, provider);
      }
    }

    parsed.meta_title = buildMetaTitle(ctx);
    parsed.meta_description = fixMetaDescription(parsed.meta_description, ctx);
    return parsed;
  } catch (err) {
    const isRateLimit =
      err.status === 429 ||
      (err.message || "").toLowerCase().includes("rate limit") ||
      (err.message || "").toLowerCase().includes("quota");

    if (isRateLimit) {
      const permanent = provider.name === "Groq";
      markExhausted(provider.name, permanent);
      const next = getActiveProvider();
      if (next) return generateContent(ctx, attempt, next);
      if (!permanent) {
        await new Promise((r) => setTimeout(r, 65000));
        resetProvider(provider.name);
      }
      return generateContent(ctx, attempt, null);
    }

    if (err instanceof SyntaxError && attempt <= MAX_RETRIES) {
      console.log(`    🔄 JSON parse error — retry ${attempt}/${MAX_RETRIES}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
      return generateContent(ctx, attempt + 1, provider);
    }

    if (attempt <= MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 4000 * attempt));
      return generateContent(ctx, attempt + 1, provider);
    }
    throw err;
  }
}

// ─── Save progress ────────────────────────────────────────────────────────────

function saveProgress(results) {
  fs.writeFileSync(GENERATED_PATH, JSON.stringify(results, null, 2));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const available = PROVIDERS.filter((p) => p.available);
  if (!available.length) {
    console.error(
      "❌ No API keys found. Set GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in .env",
    );
    process.exit(1);
  }
  console.log(`\n✅ Providers: ${available.map((p) => p.name).join(" → ")}`);

  if (!fs.existsSync(SCRAPED_PATH)) {
    console.error(
      `❌ scraped_results.json not found. Run 02_scraper.js first.\n   Expected: ${SCRAPED_PATH}`,
    );
    process.exit(1);
  }

  const allScraped = JSON.parse(fs.readFileSync(SCRAPED_PATH));
  console.log(`📋 Loaded ${allScraped.length} scraped merchants`);

  let existingGenerated = [];
  if (fs.existsSync(GENERATED_PATH)) {
    try {
      existingGenerated = JSON.parse(fs.readFileSync(GENERATED_PATH));
      console.log(
        `📋 Resuming — ${existingGenerated.length} already attempted`,
      );
    } catch {}
  }

  const skipSlugs = new Set(
    FORCE
      ? []
      : existingGenerated
          .filter((r) => (RETRY_FAILED ? !r.error : true))
          .map((r) => r.slug)
          .filter(Boolean),
  );

  let merchants = allScraped.filter((m) => {
    const slug = m.slug || m.name?.toLowerCase().replace(/\s+/g, "-");
    if (SLUG && slug !== SLUG) return false;
    if (skipSlugs.has(slug)) return false;
    if (TIER && m.tier !== TIER) return false;
    return true;
  });

  if (LIMIT) merchants = merchants.slice(0, LIMIT);

  console.log(
    `\n✍️  Generating: ${merchants.length} stores | DryRun: ${DRY_RUN}\n`,
  );

  if (!merchants.length) {
    console.log(
      "✅ Nothing to generate. Use --retry-failed or --force to reprocess.",
    );
    return;
  }

  let results = RETRY_FAILED
    ? existingGenerated.filter((r) => !r.error)
    : [...existingGenerated];

  for (const m of merchants) {
    const provider = getActiveProvider();
    if (!provider) {
      console.log(
        "\n🛑 All providers exhausted. Resume tomorrow or add more API keys.",
      );
      break;
    }

    const slug = m.slug || m.name.toLowerCase().replace(/\s+/g, "-");
    console.log(
      `  ↳ [${m.tier}] ${m.name} [${provider.name}] | offers:${m.offerSummary?.totalActive || 0} verified:${m.offerSummary?.verifiedCount || 0}`,
    );

    const ctx = buildContext(m, m.scraped_data || {});

    try {
      const content = await generateContent(ctx);
      const issues = validate(content, ctx);
      const wc = (content.description_html || "")
        .replace(/<[^>]+>/g, " ")
        .split(/\s+/)
        .filter(Boolean).length;

      if (issues.length) {
        console.log(
          `    ⚠️  ${wc}w | meta:${(content.meta_description || "").length}c | ${issues.join(" | ")}`,
        );
      } else {
        console.log(
          `    ✓ ${wc}w | FAQs:${content.faqs?.length || 0} | meta:${(content.meta_description || "").length}c`,
        );
      }

      if (DRY_RUN) {
        console.log(`    [DRY] ${content.meta_title}`);
        console.log(
          `    [DRY] meta(${(content.meta_description || "").length}c): ${content.meta_description}`,
        );
        continue;
      }

      const isTooShort = wc < 500;

      if (isTooShort) {
        console.log(`    ⛔ Rejected (${wc}w < 500w minimum)`);
        await supabase
          .from("merchants")
          .update({
            content_status: "failed",
            generation_error: `content too short: ${wc}w`,
          })
          .eq("slug", slug)
          .catch(() => {});
        results.push({
          slug,
          id: m.id,
          name: m.name,
          tier: m.tier,
          error: `too short: ${wc}w`,
          generated_at: new Date().toISOString(),
        });
        saveProgress(results);
        continue;
      }

      if (BLOCK_ISSUES && issues.length) {
        console.log(`    ⛔ Blocked: ${issues.join("; ")}`);
        results.push({
          slug,
          id: m.id,
          name: m.name,
          tier: m.tier,
          error: `blocked: ${issues.join("; ")}`,
          generated_at: new Date().toISOString(),
        });
        saveProgress(results);
        continue;
      }

      // ── Push to DB ────────────────────────────────────────────────────────
      const payload = {
        meta_title: content.meta_title,
        meta_description: content.meta_description,
        side_description_html: content.side_description_html,
        table_content_html: content.table_content_html,
        description_html: content.description_html,
        faqs: content.faqs,
        trust_text: content.trust_text,
        content_status: "generated",
        content_generated_at: new Date().toISOString(),
        generation_error: issues.length ? issues.join("; ") : null,
        scrape_score: m.score,
        content_tier: m.tier,
      };

      const { data: dbData, error: dbErr } = await supabase
        .from("merchants")
        .update(payload)
        .eq("slug", slug)
        .select("id");

      if (dbErr) {
        console.error(`    ✗ DB update failed [${slug}]: ${dbErr.message}`);
        results.push({
          slug,
          id: m.id,
          name: m.name,
          tier: m.tier,
          error: `db: ${dbErr.message}`,
          generated_at: new Date().toISOString(),
        });
      } else {
        const realId = dbData?.[0]?.id;
        console.log(`    ✓ Saved [id=${realId} slug=${slug}]`);
        results.push({
          id: realId,
          name: m.name,
          slug,
          tier: m.tier,
          score: m.score,
          issues: issues.length ? issues : null,
          generated_at: new Date().toISOString(),
          content,
        });
      }

      saveProgress(results);
    } catch (err) {
      console.error(`    ✗ ${m.name}: ${err.message}`);
      await supabase
        .from("merchants")
        .update({
          content_status: "failed",
          generation_error: err.message.substring(0, 500),
        })
        .eq("slug", slug)
        .catch(() => {});
      results.push({
        slug,
        id: m.id,
        name: m.name,
        tier: m.tier,
        error: err.message.substring(0, 500),
        generated_at: new Date().toISOString(),
      });
      saveProgress(results);
    }

    await new Promise((r) => setTimeout(r, provider.delayMs ?? 3000));
  }

  const ok = results.filter((r) => !r.error).length;
  const fail = results.filter((r) => r.error).length;
  console.log(`\n🏁 Done. Success: ${ok} | Failed: ${fail}`);
  console.log(`💾 Saved to: ${GENERATED_PATH}`);
}

main().catch(console.error);
