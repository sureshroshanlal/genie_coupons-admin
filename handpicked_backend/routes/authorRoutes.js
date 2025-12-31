import { Router } from "express";
import * as authorController from "../controllers/authorController.js";

const router = Router();

router.get("/", authorController.listAuthors);
router.get("/:id", authorController.getAuthor);
router.post("/", authorController.createAuthor);
router.put("/:id", authorController.updateAuthor);
router.patch("/:id/status", authorController.updateAuthorStatus);
router.delete("/:id", authorController.deleteAuthor);
export default router;
