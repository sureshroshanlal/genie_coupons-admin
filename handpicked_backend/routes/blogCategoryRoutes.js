// src/routes/blogCategoryRoutes.js
import { Router } from "express";
import * as blogCategoryController from "../controllers/blogCategoryController.js";

const router = Router();

/**
 * GET /api/blog-categories
 * List blog categories (optional ?name=)
 */
router.get("/", blogCategoryController.listCategories);

/**
 * GET /api/blog-categories/:id
 * Get a single category by ID
 */
router.get("/:id", blogCategoryController.getCategory);

/**
 * POST /api/blog-categories
 * Create a new category
 */
router.post("/", blogCategoryController.createCategory);

/**
 * PUT /api/blog-categories/:id
 * Update a category
 */
router.put("/:id", blogCategoryController.updateCategory);

/**
 * PATCH /api/blog-categories/:id/status
 * Toggle publish status
 */
router.patch("/:id/status", blogCategoryController.updateCategoryStatus);

/**
 * DELETE /api/blog-categories/:id
 * Delete a category
 */
router.delete("/:id", blogCategoryController.deleteCategory);

export default router;
