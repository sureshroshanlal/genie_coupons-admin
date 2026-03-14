import { Router } from "express";
import multer from "multer";
import {
  listBanners,
  getBanner,
  createBanner,
  updateBanner,
  toggleActive,
  deleteBanner,
} from "../controllers/adminBannersController.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get("/", listBanners);
router.get("/:id", getBanner);
router.post("/", upload.fields([{ name: "image", maxCount: 1 }]), createBanner);
router.put(
  "/:id",
  upload.fields([{ name: "image", maxCount: 1 }]),
  updateBanner,
);
router.patch("/:id/toggle", toggleActive);
router.delete("/:id", deleteBanner);

export default router;
