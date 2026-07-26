import express from "express";
import {
  createCollectionBooking,
  createCollectionCentre,
  getCollectionBookings,
  getCollectionCentres,
  updateCollectionBookingStatus,
  updateCollectionCentre,
} from "../controllers/collectionController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, allowRoles("farmer", "distributor", "admin"));
router.get("/", getCollectionCentres);
router.get("/bookings", getCollectionBookings);
router.post("/", allowRoles("admin"), createCollectionCentre);
router.patch("/:id", allowRoles("admin"), updateCollectionCentre);
router.post(
  "/:id/bookings",
  allowRoles("farmer", "distributor"),
  requireVerified,
  createCollectionBooking
);
router.patch("/bookings/:id/status", updateCollectionBookingStatus);

export default router;
