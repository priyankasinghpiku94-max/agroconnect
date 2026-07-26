import express from "express";
import {
  addDisputeMessage,
  createDispute,
  createReview,
  getDisputes,
  getReviews,
  updateDispute,
  updateReviewVisibility,
} from "../controllers/trustController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/reviews", allowRoles("farmer", "distributor", "admin"), getReviews);
router.post(
  "/orders/:orderId/reviews",
  allowRoles("farmer", "distributor"),
  requireVerified,
  createReview
);
router.patch(
  "/reviews/:id/visibility",
  allowRoles("admin"),
  updateReviewVisibility
);
router.get("/disputes", allowRoles("farmer", "distributor", "admin"), getDisputes);
router.post(
  "/orders/:orderId/disputes",
  allowRoles("farmer", "distributor"),
  requireVerified,
  createDispute
);
router.post(
  "/disputes/:id/messages",
  allowRoles("farmer", "distributor", "admin"),
  addDisputeMessage
);
router.patch("/disputes/:id", allowRoles("admin"), updateDispute);

export default router;
