import express from "express";
import rateLimit from "express-rate-limit";
import {
  getAdvisoryHistory,
  getWeatherAdvisory,
  searchLocations,
} from "../controllers/advisoryController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const weatherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Weather request limit reached. Try later." },
});

router.use(protect, weatherLimiter);
router.get("/locations", searchLocations);
router.get("/weather", getWeatherAdvisory);
router.get("/history", getAdvisoryHistory);

export default router;
