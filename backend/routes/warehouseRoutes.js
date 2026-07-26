import express from "express";
import {
  createWarehouse,
  createWarehouseBooking,
  getWarehouseBookings,
  getWarehouses,
  updateWarehouse,
  updateWarehouseBookingStatus,
} from "../controllers/warehouseController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  protect,
  allowRoles("farmer", "distributor", "admin"),
  getWarehouses
);
router.get(
  "/bookings",
  protect,
  allowRoles("farmer", "distributor", "admin"),
  getWarehouseBookings
);
router.post("/", protect, allowRoles("admin"), createWarehouse);
router.patch("/:id", protect, allowRoles("admin"), updateWarehouse);
router.post(
  "/:id/bookings",
  protect,
  allowRoles("farmer", "distributor"),
  requireVerified,
  createWarehouseBooking
);
router.patch(
  "/bookings/:id/status",
  protect,
  allowRoles("farmer", "distributor", "admin"),
  updateWarehouseBookingStatus
);

export default router;
