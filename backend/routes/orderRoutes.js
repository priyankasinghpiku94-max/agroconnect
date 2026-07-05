import express from "express";
import {
  createOrder,
  getMyOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/:id", protect, createOrder);
router.get("/my/list", protect, getMyOrders);
router.put("/:id/status", protect, updateOrderStatus);

export default router;