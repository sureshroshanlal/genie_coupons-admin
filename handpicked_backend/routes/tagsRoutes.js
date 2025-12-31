// src/routes/tags.routes.js
import { Router } from "express";
import * as tagsCtrl from "../controllers/tagsController.js";
import * as tagStoresCtrl from "../controllers/tagStoresController.js";
import { uploadMemory } from "../middleware/uploadMemory.js";

const router = Router();

// Tag-Stores
router.get("/:tagId/stores", tagStoresCtrl.getStoresByTag);
router.get("/stores/search", tagStoresCtrl.searchStores);
router.post("/:tagId/stores", tagStoresCtrl.addStoreToTag);
router.delete("/:tagId/stores/:storeId", tagStoresCtrl.removeStoreFromTag);

// Tag CRUD
router.get("/", tagsCtrl.listTags);
router.post("/", uploadMemory.single("image"), tagsCtrl.createTag);
router.get("/:id", tagsCtrl.getTag);
router.put("/:id", uploadMemory.single("image"), tagsCtrl.updateTag);
router.delete("/:id", tagsCtrl.deleteTag);

export default router;