import express from "express";
import {
  getStats,
  getUsers,
  getAdminProducts,
  getAdminOrders,
  deleteUser,
} from "../controllers/adminController.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/stats", protect, allowRoles("admin"), getStats);
router.get("/users", protect, allowRoles("admin"), getUsers);
router.get("/products", protect, allowRoles("admin"), getAdminProducts);
router.get("/orders", protect, allowRoles("admin"), getAdminOrders);
router.delete("/users/:id", protect, allowRoles("admin"), deleteUser);

export default router;