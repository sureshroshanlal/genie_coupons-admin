import express from "express";
import { uploadMemory } from "../middleware/uploadMemory.js";
import * as couponsController from "../controllers/couponsController.js";

const router = express.Router();

// List
router.get("/", couponsController.listCoupons);

// Detail
router.get("/:id", couponsController.getCoupon);

// Create (multipart)
router.post(
  "/",
  uploadMemory.fields([
    { name: "image", maxCount: 1 },
    { name: "proof_image", maxCount: 1 },
  ]),
  couponsController.createCoupon
);

// Update (multipart)
router.put(
  "/:id",
  uploadMemory.fields([
    { name: "image", maxCount: 1 },
    { name: "proof_image", maxCount: 1 },
  ]),
  couponsController.updateCoupon
);

// Toggle publish
router.patch("/:id/publish", couponsController.togglePublish);

// Toggle editor pick
router.patch("/:id/editor-pick", couponsController.toggleEditorPick);

// Delete
router.delete("/:id", couponsController.deleteCoupon);

export default router;
