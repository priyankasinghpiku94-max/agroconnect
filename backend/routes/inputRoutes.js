import express from "express";
import {
  createInput,
  createInputOrder,
  getInputOrders,
  getInputs,
  updateInput,
  updateInputOrderStatus,
} from "../controllers/inputController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, allowRoles("farmer", "distributor", "admin"));
router.get("/", getInputs);
router.get("/orders", getInputOrders);
router.post(
  "/",
  allowRoles("distributor"),
  requireVerified,
  createInput
);
router.patch("/:id", updateInput);
router.post(
  "/:id/orders",
  allowRoles("farmer"),
  requireVerified,
  createInputOrder
);
router.patch("/orders/:id/status", updateInputOrderStatus);

export default router;
