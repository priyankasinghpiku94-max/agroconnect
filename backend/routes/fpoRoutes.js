import express from "express";
import {
  createFpo,
  getMyFpo,
  inviteFpoMember,
  removeFpoMember,
  respondFpoInvitation,
} from "../controllers/fpoController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, allowRoles("farmer"), requireVerified);
router.get("/my", getMyFpo);
router.post("/", createFpo);
router.patch("/invitations/:id", respondFpoInvitation);
router.post("/:id/members", inviteFpoMember);
router.delete("/:id/members/:userId", removeFpoMember);

export default router;
