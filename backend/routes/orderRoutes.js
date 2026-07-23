import express from "express";
import {
  createOrder,
  getMyOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import {
  protect,
  allowRoles,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/:id",
  protect,
  allowRoles("distributor"),
  requireVerified,
  createOrder
);
router.get(
  "/my/list",
  protect,
  allowRoles("farmer", "distributor"),
  getMyOrders
);
router.put(
  "/:id/status",
  protect,
  allowRoles("farmer"),
  requireVerified,
  updateOrderStatus
);

export default router;
