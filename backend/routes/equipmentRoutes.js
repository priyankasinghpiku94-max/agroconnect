import express from "express";
import {
  createEquipment,
  createEquipmentBooking,
  getEquipment,
  getEquipmentBookings,
  updateEquipment,
  updateEquipmentBookingStatus,
} from "../controllers/equipmentController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, allowRoles("farmer", "distributor", "admin"));
router.get("/", getEquipment);
router.get("/bookings", getEquipmentBookings);
router.post(
  "/",
  allowRoles("farmer", "distributor"),
  requireVerified,
  createEquipment
);
router.patch("/:id", updateEquipment);
router.post(
  "/:id/bookings",
  allowRoles("farmer", "distributor"),
  requireVerified,
  createEquipmentBooking
);
router.patch("/bookings/:id/status", updateEquipmentBookingStatus);

export default router;
