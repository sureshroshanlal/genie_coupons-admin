// src/routes/merchantRoutes.js
import express from "express";
import { uploadMemory } from "../middleware/uploadMemory.js";
import * as merchantController from "../controllers/merchantController.js";

const router = express.Router();

// List + filters + pagination
router.get("/", merchantController.listMerchants);

// Detail
router.get("/:id", merchantController.getMerchant);

// Create (multipart)
router.post(
  "/",
  uploadMemory.fields([
    { name: "logo", maxCount: 1 },
    { name: "top_banner", maxCount: 1 },
    { name: "side_banner", maxCount: 1 },
  ]),
  merchantController.createMerchant
);

// Update (multipart)
router.put(
  "/:id",
  uploadMemory.fields([
    { name: "logo", maxCount: 1 },
    { name: "top_banner", maxCount: 1 },
    { name: "side_banner", maxCount: 1 },
  ]),
  merchantController.updateMerchant
);

// Toggle status (active/inactive)
router.patch("/:id/status", merchantController.updateMerchantStatus);

// Delete
router.delete("/:id", merchantController.deleteMerchant);

router.post(
  "/upload",
  uploadMemory.single("file"), // client sends `formData.append("image", file)`
  merchantController.uploadBlogImage
);
export default router;
