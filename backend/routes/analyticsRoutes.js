import express from "express";
import {
  exportAnalyticsCsv,
  getAnalyticsOverview,
} from "../controllers/analyticsController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/overview", protect, getAnalyticsOverview);
router.get("/export", protect, exportAnalyticsCsv);

export default router;
