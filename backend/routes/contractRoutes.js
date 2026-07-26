import express from "express";
import {
  generateContractOrder,
  getContracts,
  updateContractStatus,
} from "../controllers/contractController.js";
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
  getContracts
);
router.post(
  "/:id/generate-order",
  protect,
  allowRoles("distributor"),
  requireVerified,
  generateContractOrder
);
router.patch(
  "/:id/status",
  protect,
  allowRoles("distributor", "admin"),
  updateContractStatus
);

export default router;
