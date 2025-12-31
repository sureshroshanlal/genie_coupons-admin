import express from 'express';
import { getSidebarMenu } from '../controllers/sidebarController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/sidebar
router.get('/', protect, getSidebarMenu);

export default router;