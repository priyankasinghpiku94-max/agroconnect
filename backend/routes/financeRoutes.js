import express from "express";
import {
  createInvoice,
  getInvoices,
  getPayments,
  getSubscriptions,
  requestSubscription,
  reviewPayment,
  reviewSubscription,
  submitPayment,
} from "../controllers/financeController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/invoices", allowRoles("farmer", "distributor", "admin"), getInvoices);
router.post(
  "/orders/:orderId/invoice",
  allowRoles("farmer", "distributor", "admin"),
  createInvoice
);
router.get("/payments", allowRoles("farmer", "distributor", "admin"), getPayments);
router.post(
  "/orders/:orderId/payments",
  allowRoles("distributor"),
  requireVerified,
  submitPayment
);
router.patch(
  "/payments/:id/status",
  allowRoles("admin"),
  reviewPayment
);
router.get(
  "/subscriptions",
  allowRoles("distributor", "admin"),
  getSubscriptions
);
router.post(
  "/subscriptions",
  allowRoles("distributor"),
  requireVerified,
  requestSubscription
);
router.patch(
  "/subscriptions/:id/status",
  allowRoles("admin"),
  reviewSubscription
);

export default router;
