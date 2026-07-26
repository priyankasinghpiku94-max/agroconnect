import express from "express";
import {
  createShipment,
  getInspections,
  getShipments,
  requestInspection,
  updateInspection,
  updateShipment,
} from "../controllers/fulfilmentController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/shipments", allowRoles("farmer", "distributor", "admin"), getShipments);
router.post(
  "/orders/:orderId/shipments",
  allowRoles("farmer", "admin"),
  requireVerified,
  createShipment
);
router.patch(
  "/shipments/:id",
  allowRoles("farmer", "admin"),
  updateShipment
);
router.get(
  "/inspections",
  allowRoles("farmer", "distributor", "admin"),
  getInspections
);
router.post(
  "/orders/:orderId/inspections",
  allowRoles("farmer", "distributor"),
  requireVerified,
  requestInspection
);
router.patch(
  "/inspections/:id",
  allowRoles("farmer", "distributor", "admin"),
  updateInspection
);

export default router;
