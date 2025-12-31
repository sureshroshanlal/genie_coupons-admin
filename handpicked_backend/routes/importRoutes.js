// src/routes/importRoutes.js
import express from "express";
import { uploadMemory } from "../middleware/uploadMemory.js";
import * as importsController from "../controllers/ImportsController.js";

const router = express.Router();

// All steps accept a single file field named "file"
const mw = uploadMemory.single("file");

// Step 1: Stores (with default content)
router.post("/stores", mw, importsController.importStores);

// Step 2: Tag–Store relations
router.post(
  "/tag-store-relations",
  mw,
  importsController.importTagStoreRelations
);

// Step 3: Store coupons/deals
router.post(
  "/store-coupons-deals",
  mw,
  importsController.importStoreCouponsDeals
);

// Step 4: First paragraph (for stores)
router.post(
  "/store-first-paragraph",
  mw,
  importsController.importFirstParagraph
);

// Step 5: SEO desc check
router.post("/store-seo-desc-check", mw, importsController.importSeoDescCheck);

// Step 6: Slugs for default content
router.post(
  "/store-slugs-default-content",
  mw,
  importsController.importStoreSlugsDefaultContent
);

export default router;
