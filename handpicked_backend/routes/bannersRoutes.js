import express from "express";
import {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner
} from "../controllers/bannersController.js";

const router = express.Router();

router.get("/", getAllBanners);
router.get("/:id", getBannerById);
router.post("/", createBanner);
router.put("/:id", updateBanner);
router.delete("/:id", deleteBanner);

export default router;