import express from "express";
import {
  acceptQuotation,
  counterQuotation,
  getMyQuotations,
  getQuotationHistory,
  rejectQuotation,
  submitQuotation,
} from "../controllers/quotationController.js";
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
  getMyQuotations
);
router.get(
  "/:id/history",
  protect,
  allowRoles("farmer", "distributor", "admin"),
  getQuotationHistory
);
router.post(
  "/demand/:demandId",
  protect,
  allowRoles("farmer"),
  requireVerified,
  submitQuotation
);
router.post(
  "/:id/counter",
  protect,
  allowRoles("farmer", "distributor"),
  requireVerified,
  counterQuotation
);
router.post(
  "/:id/accept",
  protect,
  allowRoles("farmer", "distributor"),
  requireVerified,
  acceptQuotation
);
router.post(
  "/:id/reject",
  protect,
  allowRoles("farmer", "distributor"),
  requireVerified,
  rejectQuotation
);

export default router;
