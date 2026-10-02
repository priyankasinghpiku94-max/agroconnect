import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { demandForecast, recommendPrice } from "../controllers/scaleController.js";

const router = express.Router();
router.use(protect);
router.get("/price-recommendation", recommendPrice);
router.get("/demand-forecast", demandForecast);

export default router;
