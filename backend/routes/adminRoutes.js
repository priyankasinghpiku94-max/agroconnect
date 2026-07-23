import express from "express";
import {
  getStats,
  getUsers,
  getAdminProducts,
  getAdminOrders,
  deleteUser,
  updateUserStatus,
} from "../controllers/adminController.js";
import {
  downloadKycDocument,
  getVerifications,
  reviewVerification,
} from "../controllers/verificationController.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/stats", protect, allowRoles("admin"), getStats);
router.get("/users", protect, allowRoles("admin"), getUsers);
router.get("/products", protect, allowRoles("admin"), getAdminProducts);
router.get("/orders", protect, allowRoles("admin"), getAdminOrders);
router.get("/verifications", protect, allowRoles("admin"), getVerifications);
router.get(
  "/verifications/:userId/document",
  protect,
  allowRoles("admin"),
  downloadKycDocument
);
router.put(
  "/verifications/:userId",
  protect,
  allowRoles("admin"),
  reviewVerification
);
router.patch(
  "/users/:id/status",
  protect,
  allowRoles("admin"),
  updateUserStatus
);
router.delete("/users/:id", protect, allowRoles("admin"), deleteUser);

export default router;
