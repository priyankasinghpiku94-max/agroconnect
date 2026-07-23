import express from "express";
import {
  closeDemand,
  createDemand,
  getMyDemands,
  getOpenDemands,
  updateDemand,
} from "../controllers/demandController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  protect,
  allowRoles("farmer", "distributor"),
  requireVerified,
  getOpenDemands
);
router.get(
  "/my",
  protect,
  allowRoles("distributor"),
  requireVerified,
  getMyDemands
);
router.post(
  "/",
  protect,
  allowRoles("distributor"),
  requireVerified,
  createDemand
);
router.put(
  "/:id",
  protect,
  allowRoles("distributor"),
  requireVerified,
  updateDemand
);
router.patch(
  "/:id/close",
  protect,
  allowRoles("distributor"),
  requireVerified,
  closeDemand
);

export default router;
