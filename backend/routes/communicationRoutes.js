import express from "express";
import rateLimit from "express-rate-limit";
import {
  createConversation,
  getConversations,
  getMessages,
  sendMessage,
} from "../controllers/communicationController.js";
import {
  allowRoles,
  protect,
  requireVerified,
} from "../middleware/authMiddleware.js";

const router = express.Router();
const messageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many messages. Please wait and retry." },
});

router.use(protect, allowRoles("farmer", "distributor"));
router.get("/conversations", getConversations);
router.post(
  "/orders/:orderId/conversation",
  requireVerified,
  createConversation
);
router.get("/conversations/:id/messages", getMessages);
router.post(
  "/conversations/:id/messages",
  requireVerified,
  messageLimiter,
  sendMessage
);

export default router;
