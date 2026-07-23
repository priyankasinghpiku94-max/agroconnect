import express from "express";
import {
  getVerificationStatus,
  submitKyc,
} from "../controllers/verificationController.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import { kycDocumentUpload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/status", protect, allowRoles("farmer", "distributor"), getVerificationStatus);
router.post(
  "/kyc",
  protect,
  allowRoles("farmer", "distributor"),
  kycDocumentUpload.single("document"),
  submitKyc
);

export default router;
