/**
 * STEP 3: Content Generator — Multi-Provider Rotation
 *
 * Provider priority (best quality first):
 *   1. Google  (gemini-2.0-flash)          1M TPD free  — 4s delay
 *   2. Groq    (llama-3.3-70b-versatile)   100K TPD     — 6s delay
 *   3. OpenRouter (llama-3.3-70b:free)     1K RPD       — 3s delay
 *
 * Env vars needed:
 *   GROQ_API_KEY
 *   GEMINI_API_KEY       → https://aistudio.google.com
 *   OPENROUTER_API_KEY   → https://openrouter.ai
 *
 * Run:          node 03_generator.js
 * Tier filter:  node 03_generator.js --tier=A
 * Limit:        node 03_generator.js --limit=10
 * Dry run:      node 03_generator.js --dry-run
 * Retry failed: node 03_generator.js --retry-failed
 * Force redo:   node 03_generator.js --force
 */

import Groq from "groq-sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { supabase } from "../../dbhelper/dbclient.js";

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const SCRAPED_PATH = path.resolve(
  "./scripts/Dynamic_Store_Content/scraped_results.json",
);
const GENERATED_PATH = path.resolve(
  "./scripts/Dynamic_Store_Content/generated_content.json",
);

const args = process.argv.slice(2);
const LIMIT = parseInt(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0",
);
const TIER = args.find((a) => a.startsWith("--tier="))?.split("=")[1] || null;
const DRY_RUN = args.includes("--dry-run");
const RETRY_FAILED = args.includes("--retry-failed");
const FORCE = args.includes("--force");
const BLOCK_ISSUES = args.includes("--block-issues");

const MAX_RETRIES = 3;

// ─── Provider registry ────────────────────────────────────────────────────────
// Each provider: { name, call(prompt) → string, available }
// Add/remove providers here. Order = priority.

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
            generationConfig: { temperature: 0.6, maxOutputTokens: 8192 },
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
    delayMs: 6000, // Groq: 30 RPM free → 6s between requests to stay safe
    available: !!process.env.GROQ_API_KEY,
    exhausted: false,
    async call(systemPrompt, userPrompt) {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const res = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.6,
        max_tokens: 8000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const text = res.choices[0]?.message?.content?.trim();
      if (!text) throw new Error("Empty response from Groq");
      return text;
    },
  },
  {
    name: "OpenRouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    delayMs: 3000, // OpenRouter: 20 RPM → 3s between requests
    available: !!process.env.OPENROUTER_API_KEY,
    exhausted: false,
    async call(systemPrompt, userPrompt) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://savingharbor.com",
          "X-Title": "Genie Coupon Content Generator",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          max_tokens: 8000,
          temperature: 0.6,
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

// Per-provider cooldown timestamps (for minute-based rate limits like Google)
const providerCooldowns = {};

function markExhausted(providerName, permanent = false) {
  const p = PROVIDERS.find((p) => p.name === providerName);
  if (!p) return;
  p.exhausted = true;
  if (permanent) {
    console.log(
      `\n  ⛔ ${providerName} daily limit hit — disabled for this session\n`,
    );
  } else {
    console.log(`\n  ⏳ ${providerName} rate limited — cooling down 65s\n`);
  }
}

function resetProvider(providerName) {
  const p = PROVIDERS.find((p) => p.name === providerName);
  if (p) {
    p.exhausted = false;
    console.log(`\n  ✅ ${providerName} back online\n`);
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

function buildContext(merchant, scraped) {
  const w = scraped?.website || {};
  const tp = scraped?.trustpilot || {};
  const rd = scraped?.reddit || {};
  const hp = w.homepage || {};

  return {
    name: merchant.name,
    url: merchant.web_url || "",
    categories: Array.isArray(merchant.category_names)
      ? merchant.category_names.join(", ")
      : merchant.category_names || "",
    activeCoupons: parseInt(merchant.active_coupons_count) || 0,
    metaDescription: sanitize(hp.metaDescription || hp.ogDescription || ""),
    heroTaglines: (hp.heroTaglines || []).map(sanitize),
    productHeadings: (hp.productHeadings || []).map(sanitize),
    keyParagraphs: (hp.keyParagraphs || []).map(sanitize),
    customerReviews: (hp.customerReviews || []).map(sanitize),
    trustSignals: hp.trustSignals || {},
    specialOffers: hp.specialOffers || {},
    visibleCodes: (hp.visibleCodes || []).map(sanitize),
    salePatterns: (hp.salePatterns || []).map(sanitize),
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
    tpFound: tp.found && (tp.reviewCount || 0) >= 5,
    tpRating: tp.rating || null,
    tpReviewCount: tp.reviewCount || null,
    tpSnippets: (tp.snippets || []).map(sanitize),
    tpPraise: (tp.commonPraise || []).map(sanitize),
    tpComplaints: (tp.commonComplaints || []).map(sanitize),
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
// Maps category → writing angle. Every angle has a distinct opening strategy.
// "standard" is last resort only — all common categories explicitly mapped.

const TEMPLATES = {
  // Problem → Solution (pain point first, product as answer)
  "Health & Fitness": "problem_solution",
  "Health & Wellness": "problem_solution",
  Pets: "problem_solution",
  "Sports & Outdoors": "problem_solution",
  "Baby & Kids": "problem_solution",
  Beauty: "problem_solution",
  "Personal Care": "problem_solution",

  // Specs & Buyer Guide (who needs it, what to look for, how to choose)
  "Computers & Electronics": "specs_buyer_guide",
  Electronics: "specs_buyer_guide",
  Technology: "specs_buyer_guide",
  Automotive: "specs_buyer_guide",
  "Tools & Home Improvement": "specs_buyer_guide",
  "Musical Instruments": "specs_buyer_guide",

  // Risk → Benefit (fears/costs first, then how brand mitigates)
  Finance: "risk_benefit",
  Investing: "risk_benefit",
  Insurance: "risk_benefit",
  Legal: "risk_benefit",

  // Use Case → Results (concrete scenarios, measurable outcomes)
  Software: "usecase_results",
  "Software & Tools": "usecase_results",
  "Marketing & SaaS": "usecase_results",
  Education: "usecase_results",
  "Online Learning": "usecase_results",
  Business: "usecase_results",

  // Lifestyle (identity-driven, aspiration + practical value)
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

// ─── Meta title (deterministic, no LLM) ──────────────────────────────────────

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

  const variants = [
    ctx.tpFound && ctx.tpRating >= 4.0 && ctx.tpReviewCount >= 100
      ? `${store} Coupons – Rated ${ctx.tpRating}★ by ${ctx.tpReviewCount.toLocaleString()} Shoppers | Genie Coupon`
      : null,
    ctx.activeCoupons >= 5 && catNoun
      ? `${store} ${catNoun} Coupons – ${ctx.activeCoupons} Verified Codes | Genie Coupon`
      : null,
    ctx.activeCoupons >= 5
      ? `${store} Coupons – ${ctx.activeCoupons} Verified Codes [${month}] | Genie Coupon`
      : null,
    catNoun
      ? `${store} ${catNoun} Coupons & Promo Codes | Genie Coupon`
      : null,
    `${store} Coupons & Promo Codes [${month}] | Genie Coupon`,
    `${store} Coupons & Promo Codes | Genie Coupon`,
  ].filter(Boolean);

  for (const v of variants) {
    if (v.length <= 70) return v;
  }
  return fit(`${store} Coupons & Promo Codes | Genie Coupon`);
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior SEO content writer for Genie Coupon, a coupon and deals website.
Your job is to write store pages that rank on Google for "[store] coupons" queries and convert browsers into clickers.
Rules you never break:
1. Return ONLY a valid JSON object. No markdown. No code fences. No text outside {}.
2. Never invent facts. If data is missing, say so honestly using the exact phrase "not listed on their site".
3. Never use these words: seamlessly, elevate, dive into, treasure trove, game-changer, curated, unlock savings, leverage, empower, in today's world, cutting-edge, robust.
4. Write like a knowledgeable friend, not a press release.`;

// Build a guaranteed 6-item FAQ pool from available data — no hallucination
function buildFaqs(ctx, store) {
  const pool = [];

  // Drain sources in priority order, filling up to 4 variable slots
  // Priority: store FAQs → Trustpilot complaints → Reddit questions → policy signals

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

  // Policy fallbacks — always have something to say about shipping/returns
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

  // Last resort: generic brand questions that the model can always answer from STORE DATA
  const genericFallbacks = [
    { source: "generic", q: `Is ${store} a legitimate company?` },
    { source: "generic", q: `What payment methods does ${store} accept?` },
    {
      source: "generic",
      q: `Does ${store} have a loyalty or rewards program?`,
    },
    { source: "generic", q: `Can I use multiple coupon codes at ${store}?` },
  ];
  for (const g of genericFallbacks) {
    if (pool.length >= 4) break;
    pool.push(g);
  }

  // Slots 5–6: always coupon-specific — these are the most valuable for SEO
  pool.push({
    source: "coupon",
    q: `Do ${store} coupon codes actually work?`,
    hint: ctx.activeCoupons,
  });
  pool.push({
    source: "coupon",
    q: `What is the best ${store} discount available right now?`,
    hint: ctx.activeCoupons,
  });

  return pool.slice(0, 6); // always exactly 6
}

function buildPrompt(ctx) {
  const store = ctx.name;
  const template = pickTemplate(ctx);
  const faqPool = buildFaqs(ctx, store);

  // Derive key signals upfront so prompt logic is clean
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

  // Section 1 opening instruction per template
  const openingInstruction =
    {
      problem_solution: `Open by naming the specific problem or frustration shoppers in this niche face (use product headings and key paragraphs as clues). Then explain how ${store} addresses that problem with its specific products or services. Do not start with "Are you looking for".`,
      specs_buyer_guide: `Open by describing exactly who buys from ${store} and why — the specific use case, skill level, or need. Then walk through 2-3 buying criteria relevant to this product category using STORE DATA as your source.`,
      risk_benefit: `Open with the main fear or risk users have in this category (cost, reliability, hidden fees, safety). Then explain what ${store} does — or does not do — to address that concern, using only facts from STORE DATA.`,
      usecase_results: `Open with 2 concrete, specific use cases for ${store}'s product or service. Name the type of user and what they are trying to achieve. Be specific — not "businesses" but "small ecommerce teams" or "freelance marketers".`,
      lifestyle: `Open with the context or moment in someone's life where ${store}'s products matter. Ground it in specifics from STORE DATA — product types, collections, or the brand's stated mission.`,
      standard: `Open with the single most distinctive or credible fact about ${store} from STORE DATA — a rating, a product range, a policy, or a founding story. Lead with what makes them worth knowing about.`,
    }[template] ||
    `Open with the strongest specific fact about ${store} from STORE DATA.`;

  const data = `
STORE: ${store}
URL: ${ctx.url}
CATEGORIES: ${ctx.categories || "not specified"}
ACTIVE COUPONS ON GENIE COUPON: ${ctx.activeCoupons}
    
HOMEPAGE DATA:
- Meta description: ${ctx.metaDescription || "not found"}
- Hero taglines: ${ctx.heroTaglines.slice(0, 5).join(" | ") || "none"}
- Product headings: ${ctx.productHeadings.slice(0, 8).join(", ") || "none"}
- Key paragraphs: ${ctx.keyParagraphs.slice(0, 4).join(" /// ") || "none"}
- Customer reviews on site: ${ctx.customerReviews.slice(0, 3).join(" /// ") || "none"}
- Sale patterns detected: ${ctx.salePatterns.join(", ") || "none detected"}
- Special offers: ${
    Object.entries(ctx.specialOffers)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ") || "none detected"
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
FIELD: meta_description
═══════════════════════════════════════
Length: 145–158 characters (count carefully — this is a hard limit).
Formula: [Action verb] + [specific benefit using a real number from STORE DATA] + [brand name] + "Find verified codes at Genie Coupon."
- The number MUST come from STORE DATA: active coupon count, Trustpilot rating, review count, shipping threshold, or return window days.
- If activeCoupons = 0, use Trustpilot rating+count OR return window as the number.
- Never start with "Discover" or "Explore".
- Example shape (not to copy): "Save on [product type] at [Store] — [X] verified coupon codes tracked. Find verified codes at Genie Coupon."

═══════════════════════════════════════
FIELD: meta_keywords
═══════════════════════════════════════
8–12 comma-separated terms. Include:
- "${store} coupons", "${store} promo codes", "${store} discount codes", "${store} coupon code today"
- "${store} free shipping code", "${store} deals"
- 2–3 category-specific terms based on what they sell in STORE DATA (e.g. "fitness gear discount", "pet food coupon")
All lowercase.

═══════════════════════════════════════
FIELD: side_description_html
═══════════════════════════════════════
50–80 words. One <p> tag.
Sentence 1: The single strongest reason to shop at ${store} — use a specific fact (rating, product type, policy, or founding story).
Sentence 2: One practical saving tip (coupon, sale pattern, or policy perk).
Sentence 3: Direct readers to Genie Coupon for verified codes.
Do not use bullet points. Do not repeat the store name more than twice.

═══════════════════════════════════════
FIELD: table_content_html
═══════════════════════════════════════
100–150 words. Use <p> tags only (no lists).
Paragraph 1: What ${store} sells and who it is for. Use product headings and category data.
Paragraph 2: What sets them apart — policy, brand story, rating, or specific product advantage. Use only facts from STORE DATA.
Do not mention Genie Coupon here. This is a factual brand summary.

═══════════════════════════════════════
FIELD: description_html
═══════════════════════════════════════
MINIMUM 700 visible words. Write every section fully. Do not summarize.
Use <h3> for section headings. Use <p> for paragraphs. No <ul> or <li>.
Mention ${store} by name 3–6 times total across all sections.

--- SECTION 1: <h3>What is ${store}?</h3> ---
Target: 110–140 words.
${openingInstruction}
End this section by naturally bridging to what they sell.

--- SECTION 2: <h3>What Does ${store} Sell?</h3> ---
Target: 110–140 words.
Use product headings, key paragraphs, and category data from STORE DATA.
Name specific product types, collections, or service tiers. 
${ctx.productHeadings.length ? `Their product areas include: ${ctx.productHeadings.slice(0, 6).join(", ")}.` : ""}
If price ranges or subscription options are mentioned in STORE DATA, include them.
Do not write "they sell a wide range of products" — be specific.

--- SECTION 3: <h3>How to Save at ${store}</h3> ---
Target: 110–140 words.
Cover ALL of the following that apply based on STORE DATA:
${hasCoupons ? `- ${ctx.activeCoupons} active coupon codes are currently tracked on Genie Coupon.` : "- Note that coupon availability varies — check Genie Coupon for current offers."}
${hasSales ? `- Detected sale patterns: ${ctx.salePatterns.join(", ") || "see special offers below"}.` : "- Mention when to expect sales based on category norms (Black Friday, end-of-season, etc.)."}
${ctx.specialOffers.loyaltyProgram ? "- They have a loyalty or rewards program — mention it." : ""}
${ctx.specialOffers.subscriptionSave ? "- Subscription-save discount available — mention it." : ""}
${ctx.specialOffers.referralProgram ? "- Referral program available — mention it." : ""}
- Explain how to apply a coupon code at checkout in 1–2 sentences.

--- SECTION 4: <h3>Are ${store} Coupon Codes Legit?</h3> ---
Target: 90–110 words.
${hasTp ? `Reference the Trustpilot rating of ${ctx.tpRating}★ from ${ctx.tpReviewCount.toLocaleString()} reviews to establish credibility.` : ""}
${ctx.rdSentiment && ctx.rdFound ? `Reddit sentiment is ${ctx.rdSentiment} — reference this honestly.` : ""}
Confirm that Genie Coupon tracks and verifies codes for ${store}.
${hasCoupons ? `State that ${ctx.activeCoupons} codes are currently listed.` : "State that code availability varies and to check Genie Coupon for current offers."}
Be honest — if complaints exist in STORE DATA, acknowledge them neutrally.

--- SECTION 5: <h3>Best Time to Shop at ${store}</h3> ---
Target: 90–110 words.
${hasSales ? `Use detected patterns: ${ctx.salePatterns.join(", ")}.` : `No specific sale data found. Write about seasonal buying patterns for ${ctx.categories || "this category"} in general — when demand peaks, when discounts typically appear (end-of-season, Black Friday, New Year). Be honest that specific sale dates for ${store} are not confirmed.`}
${ctx.specialOffers.clearanceSale ? "Mention clearance/sale section if present." : ""}
Connect to coupon strategy — using a Genie Coupon code on top of a sale for maximum savings.

--- SECTION 6: <h3>${store} Shipping and Returns</h3> ---
Target: 90–110 words.
${
  hasShip
    ? `
Use these confirmed facts:
${ctx.shippingThreshold ? `- Free shipping threshold: ${ctx.shippingThreshold}` : ""}
${ctx.returnWindow ? `- Return window: ${ctx.returnWindow}` : ""}
${ctx.freeReturns ? `- Free returns confirmed` : ""}
${ctx.deliveryTimes.length ? `- Delivery times: ${ctx.deliveryTimes.join(", ")}` : ""}
`
    : `No shipping or return data was found for ${store}. Be transparent — state that policies are not clearly listed in easily accessible areas of their site, and direct readers to check ${store}'s website or contact their support for accurate details.`
}
${ctx.internationalShipping ? "Mention international shipping." : ""}

═══════════════════════════════════════
FIELD: faqs
═══════════════════════════════════════
Exactly 6 FAQ objects. Write every answer as 2–3 sentences: direct answer first, then useful detail.
Never invent policies, percentages, or guarantees not in STORE DATA.

Use these FAQ sources in order:
${faqPool
  .map((f, i) => {
    if (f.source === "store_faq")
      return `FAQ ${i + 1}: Rewrite this store FAQ in your own words — Q: "${f.q}" A: "${f.a}"`;
    if (f.source === "tp_complaint")
      return `FAQ ${i + 1}: Turn this Trustpilot complaint into a question and answer it honestly: "${f.hint}"`;
    if (f.source === "reddit")
      return `FAQ ${i + 1}: Answer this question people ask on Reddit: "${f.q}"`;
    if (f.source === "policy")
      return `FAQ ${i + 1}: Q: "${f.q}" — answer using this data: "${f.hint}"`;
    if (f.source === "coupon")
      return `FAQ ${i + 1}: Q: "${f.q}" — answer using active coupon count: ${ctx.activeCoupons}${hasTp ? ` and Trustpilot rating: ${ctx.tpRating}★` : ""}`;
    return `FAQ ${i + 1}: Write a relevant question and honest answer about ${store} using STORE DATA.`;
  })
  .join("\n")}

═══════════════════════════════════════
FIELD: trust_text
═══════════════════════════════════════
1–2 sentences. Use ONLY real signals present in STORE DATA:
${hasTp ? `- Trustpilot: ${ctx.tpRating}★ from ${ctx.tpReviewCount.toLocaleString()} reviews` : ""}
${hasReviews && !hasTp ? `- On-site reviews: ${ctx.trustSignals.reviewCount}` : ""}
${ctx.returnWindow ? `- Return window: ${ctx.returnWindow}` : ""}
${ctx.freeReturns ? `- Free returns confirmed` : ""}
${hasCoupons ? `- ${ctx.activeCoupons} active codes on Genie Coupon` : ""}
If none of the above apply: write "Store information is based on publicly available data from ${store}'s official website." — nothing more.

═══════════════════════════════════════
STORE DATA (your only factual source):
═══════════════════════════════════════
${data}

═══════════════════════════════════════
RETURN THIS EXACT JSON SHAPE:
═══════════════════════════════════════
{
  "meta_description": "string, 145-158 chars",
  "meta_keywords": "string, comma-separated",
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

  if (meta.length < 145) {
    if (meta.endsWith(".")) meta = meta.slice(0, -1);

    // Build pads based on available data — never show "0 offers"
    const pads = [];
    if (ctx.activeCoupons > 0) {
      pads.push(` Find ${ctx.activeCoupons} verified codes at Genie Coupon.`);
      pads.push(
        ` Browse ${ctx.activeCoupons} active offers on Genie Coupon today.`,
      );
    }
    if (ctx.tpFound && ctx.tpRating) {
      pads.push(
        ` Rated ${ctx.tpRating}★ on Trustpilot. Find verified codes at Genie Coupon.`,
      );
    }
    if (ctx.returnWindow) {
      pads.push(
        ` ${ctx.returnWindow} returns available. Find verified codes at Genie Coupon.`,
      );
    }
    // Universal fallbacks
    pads.push(` Find verified discount codes at Genie Coupon.`);
    pads.push(` Browse all verified deals and codes at Genie Coupon.`);
    pads.push(` Check Genie Coupon for the latest verified coupon codes.`);

    for (const pad of pads) {
      const c = meta + pad;
      if (c.length >= 145 && c.length <= 158) return c;
    }
    // Force fit with best pad
    const forced = (meta + pads[0]).slice(0, 158);
    const sp = forced.lastIndexOf(" ");
    return (
      (sp > 130 ? forced.slice(0, sp) : forced).replace(/[,\s]+$/, "") + "."
    );
  }

  return meta;
}

// ─── JSON parser (robust) ─────────────────────────────────────────────────────

function sanitizeJsonStringValues(jsonStr) {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    const code = jsonStr.charCodeAt(i);
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
  let depth = 0;
  let end = -1;
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
  clean = sanitizeJsonStringValues(clean.slice(start, end + 1));
  return JSON.parse(clean);
}

// ─── Validate output ──────────────────────────────────────────────────────────

function validate(content, storeName) {
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
  ];

  if (wc < 650) issues.push(`desc too short: ${wc}w`);
  if (wc > 950) issues.push(`desc too long: ${wc}w`);
  if (meta.length < 145) issues.push(`meta too short: ${meta.length}c`);
  if (meta.length > 158) issues.push(`meta too long: ${meta.length}c`);
  if (!/\d/.test(meta)) issues.push("meta has no number");
  if (faqs !== 6) issues.push(`expected 6 FAQs, got ${faqs}`);
  if (!visible.toLowerCase().includes(storeName.toLowerCase()))
    issues.push("store name missing from description");
  if (banned.some((b) => visible.toLowerCase().includes(b)))
    issues.push("contains banned phrases");

  return issues;
}

function hasMalformedHtml(html) {
  return html ? /<[a-zA-Z][^>]*$|<p[A-Z]/m.test(html) : false;
}

// ─── Generate with provider rotation ─────────────────────────────────────────

async function generateContent(ctx, attempt = 1, forcedProvider = null) {
  const provider = forcedProvider || getActiveProvider();
  if (!provider)
    throw new Error("All providers exhausted for today. Resume tomorrow.");

  try {
    const raw = await provider.call(SYSTEM_PROMPT, buildPrompt(ctx));
    if (!raw) throw new Error("Empty response");

    const parsed = parseResponse(raw);

    // Retry on malformed HTML — same provider
    if (hasMalformedHtml(parsed.description_html) && attempt <= MAX_RETRIES) {
      console.log(`    🔄 Malformed HTML — retry ${attempt}/${MAX_RETRIES}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return generateContent(ctx, attempt + 1, provider);
    }

    // Check word count
    const wc = (parsed.description_html || "")
      .replace(/<[^>]+>/g, " ")
      .split(/\s+/)
      .filter(Boolean).length;

    if (wc < 400 && attempt <= MAX_RETRIES) {
      // Try next provider instead of retrying same — same model won't do better
      const nextProvider = PROVIDERS.find(
        (p) => p.available && !p.exhausted && p.name !== provider.name,
      );
      if (nextProvider) {
        console.log(
          `    🔄 Too short (${wc}w) — switching to ${nextProvider.name}`,
        );
        return generateContent(ctx, attempt + 1, nextProvider);
      }
      console.log(
        `    🔄 Too short (${wc}w) — retry ${attempt}/${MAX_RETRIES}`,
      );
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return generateContent(ctx, attempt + 1, provider);
    }

    parsed.meta_title = buildMetaTitle(ctx);
    parsed.meta_description = fixMetaDescription(parsed.meta_description, ctx);
    return parsed;
  } catch (err) {
    // Rate limit — mark exhausted, switch to next provider immediately if available
    if (
      err.status === 429 ||
      (err.message || "").toLowerCase().includes("rate limit") ||
      (err.message || "").toLowerCase().includes("quota")
    ) {
      const permanent = provider.name === "Groq";
      markExhausted(provider.name, permanent);
      const next = getActiveProvider();
      if (next) {
        // Another provider available — switch immediately, no wait
        return generateContent(ctx, attempt, next);
      }
      if (!permanent) {
        // No other provider — wait 65s then reset this one and retry
        await new Promise((r) => setTimeout(r, 65000));
        resetProvider(provider.name);
      }
      return generateContent(ctx, attempt, null);
    }
    // JSON parse error — retry same provider
    if (err instanceof SyntaxError && attempt <= MAX_RETRIES) {
      console.log(`    🔄 JSON parse error — retry ${attempt}/${MAX_RETRIES}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
      return generateContent(ctx, attempt + 1, provider);
    }
    // Generic — retry same provider
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
  // Validate at least one provider is configured
  const available = PROVIDERS.filter((p) => p.available);
  if (!available.length) {
    console.error(
      "❌ No API keys found. Set GROQ_API_KEY, CEREBRAS_API_KEY, or GOOGLE_AI_API_KEY in .env",
    );
    process.exit(1);
  }
  console.log(`✅ Providers: ${available.map((p) => p.name).join(" → ")}`);

  if (!fs.existsSync(SCRAPED_PATH)) {
    console.error(`❌ scraped_results.json not found at ${SCRAPED_PATH}`);
    process.exit(1);
  }

  const allScraped = JSON.parse(fs.readFileSync(SCRAPED_PATH));
  console.log(`📋 Loaded ${allScraped.length} scraped merchants`);

  let existingGenerated = [];
  if (fs.existsSync(GENERATED_PATH)) {
    existingGenerated = JSON.parse(fs.readFileSync(GENERATED_PATH));
    console.log(`📋 Resuming — ${existingGenerated.length} already attempted`);
  }

  const skipIds = new Set(
    FORCE
      ? []
      : existingGenerated
          .filter((r) => (RETRY_FAILED ? !r.error : true))
          .map((r) => r.id?.toString()),
  );

  let merchants = allScraped.filter((m) => {
    if (skipIds.has(m.id?.toString())) return false;
    if (TIER && m.tier !== TIER) return false;
    return true;
  });

  if (LIMIT) merchants = merchants.slice(0, LIMIT);

  console.log(
    `\n✍️  Generating: ${merchants.length} stores | DryRun: ${DRY_RUN} | BlockIssues: ${BLOCK_ISSUES}\n`,
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

    console.log(`  ↳ [${m.tier}] ${m.name} [via ${provider.name}]`);
    const ctx = buildContext(m, m.scraped_data || {});

    try {
      const content = await generateContent(ctx);
      const issues = validate(content, m.name);
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

      if (!DRY_RUN) {
        // Hard block — don't save garbage content to DB
        const isTooShort = wc < 500;
        if (isTooShort) {
          console.log(
            `    ⛔ Rejected (${wc}w < 500w minimum) — marking failed, will retry with better provider`,
          );
          try {
            await supabase
              .from("merchants")
              .update({
                content_status: "failed",
                generation_error: `content too short: ${wc}w`,
              })
              .eq("id", m.id);
          } catch (_) {}
          results.push({
            id: m.id,
            name: m.name,
            tier: m.tier,
            error: `too short: ${wc}w`,
            generated_at: new Date().toISOString(),
          });
          saveProgress(results);
        } else if (BLOCK_ISSUES && issues.length) {
          console.log(`    ⛔ Blocked: ${issues.join("; ")}`);
          results.push({
            id: m.id,
            name: m.name,
            tier: m.tier,
            error: `blocked: ${issues.join("; ")}`,
            generated_at: new Date().toISOString(),
          });
          saveProgress(results);
        } else {
          // ── Push to DB ──────────────────────────────────────────────────
          const { data: dbData, error: dbErr } = await supabase
            .from("merchants")
            .update({
              meta_title: content.meta_title,
              meta_description: content.meta_description,
              meta_keywords: content.meta_keywords,
              side_description_html: content.side_description_html,
              table_content_html: content.table_content_html,
              description_html: content.description_html,
              faqs: content.faqs,
              trust_text: content.trust_text,
              content_status: "generated",
              content_generated_at: new Date().toISOString(),
              generation_error: issues.length ? issues.join("; ") : null,
            })
            .eq("id", m.id)
            .select("id");

          if (dbErr) {
            console.error(
              `    ✗ DB update failed [${m.id}]: ${dbErr.message} | code: ${dbErr.code}`,
            );
            results.push({
              id: m.id,
              name: m.name,
              tier: m.tier,
              error: `db: ${dbErr.message}`,
              generated_at: new Date().toISOString(),
            });
          } else if (!dbData?.length) {
            // No row matched — insert instead
            console.log(
              `    ⚠️  No row matched id=${m.id} — attempting insert (auto-generated id)`,
            );
            const { data: insertData, error: insertErr } = await supabase
              .from("merchants")
              .insert({
                name: m.name,
                slug: m.slug || m.name.toLowerCase().replace(/\s+/g, "-"),
                meta_title: content.meta_title,
                meta_description: content.meta_description,
                meta_keywords: content.meta_keywords,
                side_description_html: content.side_description_html,
                table_content_html: content.table_content_html,
                description_html: content.description_html,
                faqs: content.faqs,
                trust_text: content.trust_text,
                content_status: "generated",
                content_generated_at: new Date().toISOString(),
                generation_error: issues.length ? issues.join("; ") : null,
                web_url: m.web_url || null,
                is_publish: false,
              })
              .select("id");
            if (insertErr) {
              console.error(
                `    ✗ Insert also failed [${m.id}]: ${insertErr.message}`,
              );
              results.push({
                id: m.id,
                name: m.name,
                tier: m.tier,
                error: `insert: ${insertErr.message}`,
                generated_at: new Date().toISOString(),
              });
            } else {
              const newId = insertData?.[0]?.id;
              console.log(`    ✓ Inserted new row [new id=${newId}]`);
              results.push({
                id: newId,
                name: m.name,
                slug: m.slug,
                tier: m.tier,
                issues: issues.length ? issues : null,
                generated_at: new Date().toISOString(),
                content,
              });
            }
          } else {
            console.log(`    ✓ Saved to DB [id=${m.id}]`);
            results.push({
              id: m.id,
              name: m.name,
              slug: m.slug,
              tier: m.tier,
              score: m.score,
              issues: issues.length ? issues : null,
              generated_at: new Date().toISOString(),
              content,
            });
          }
          saveProgress(results); // JSON backup regardless
        }
      } else {
        console.log(`    [DRY] ${content.meta_title}`);
        console.log(
          `    [DRY] meta(${(content.meta_description || "").length}c): ${content.meta_description}`,
        );
      }
    } catch (err) {
      console.error(`    ✗ ${m.name}: ${err.message}`);
      if (!DRY_RUN) {
        // Mark failed in DB so scraper doesn't re-attempt indefinitely
        try {
          await supabase
            .from("merchants")
            .update({
              content_status: "failed",
              generation_error: err.message.substring(0, 500),
            })
            .eq("id", m.id);
        } catch (_) {}
        results.push({
          id: m.id,
          name: m.name,
          tier: m.tier,
          error: err.message.substring(0, 500),
          generated_at: new Date().toISOString(),
        });
        saveProgress(results);
      }
    }

    await new Promise((r) => setTimeout(r, provider.delayMs ?? 3000));
  }

  const ok = results.filter((r) => !r.error).length;
  const fail = results.filter((r) => r.error).length;
  console.log(`\n🏁 Done. Success: ${ok} | Failed: ${fail}`);
  console.log(`💾 Saved to: ${GENERATED_PATH}`);
}

main().catch(console.error);
