import { Router } from "express";
import * as blogController from "../controllers/blogController.js";
import { uploadMemory } from "../middleware/uploadMemory.js";

const router = Router();

//List blogs, blog by ID, create, update, delete
router.get("/", blogController.listBlogs);
router.get("/:id", blogController.getBlog);
router.post(
  "/",
  uploadMemory.fields([
    { name: "featured_thumb", maxCount: 1 },
    { name: "featured_image", maxCount: 1 }
  ]),
  blogController.createBlog
);
router.put(
  "/:id",
  uploadMemory.fields([
    { name: "featured_thumb", maxCount: 1 },
    { name: "featured_image", maxCount: 1 }
  ]),
  blogController.updateBlog
);
router.patch("/:id/status", blogController.updateBlogStatus);
router.delete("/:id", blogController.deleteBlog);

router.post(
  "/upload",
  uploadMemory.single("file"), // client sends `formData.append("image", file)`
  blogController.uploadBlogImage
);

export default router;
