import express from "express";
import {
  getOutbox,
  getPreferences,
  updatePreferences,
} from "../controllers/preferenceController.js";
import { allowRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", getPreferences);
router.put("/", updatePreferences);
router.get("/outbox", allowRoles("admin"), getOutbox);

export default router;
