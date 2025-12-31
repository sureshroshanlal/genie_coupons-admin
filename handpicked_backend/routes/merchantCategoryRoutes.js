// src/routes/merchantCategoryRoutes.js
import express from "express";
import { uploadMemory } from "../middleware/uploadMemory.js";
import * as mcController from "../controllers/merchantCategoryController.js";

const router = express.Router();

// List + filters + pagination
router.get("/", mcController.listCategories);

// Detail
router.get("/:id", mcController.getCategory);

// Create (multipart)
router.post(
  "/",
  uploadMemory.fields([
    { name: "thumb", maxCount: 1 },
    { name: "top_banner", maxCount: 1 },
    { name: "side_banner", maxCount: 1 },
  ]),
  mcController.createCategory
);

// Update (multipart)
router.put(
  "/:id",
  uploadMemory.fields([
    { name: "thumb", maxCount: 1 },
    { name: "top_banner", maxCount: 1 },
    { name: "side_banner", maxCount: 1 },
  ]),
  mcController.updateCategory
);

// Toggle publish
router.patch("/:id/status", mcController.updateCategoryStatus);

// Delete
router.delete("/:id", mcController.deleteCategory);

export default router;
