import express from "express";
import {
  createPriceAlert,
  deletePriceAlert,
  getPriceAlerts,
  getPriceInsights,
  getSmartMatches,
  updatePriceAlert,
} from "../controllers/intelligenceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/matches", getSmartMatches);
router.get("/prices", getPriceInsights);
router.get("/alerts", getPriceAlerts);
router.post("/alerts", createPriceAlert);
router.patch("/alerts/:id", updatePriceAlert);
router.delete("/alerts/:id", deletePriceAlert);

export default router;
