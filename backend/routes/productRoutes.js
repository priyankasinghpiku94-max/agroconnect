import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  getMyProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import {
  protect,
  allowRoles,
  requireVerified,
} from "../middleware/authMiddleware.js";
import { productImageUpload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", getProducts);
router.get("/my", protect, allowRoles("farmer"), getMyProducts);
router.post(
  "/",
  protect,
  allowRoles("farmer"),
  requireVerified,
  productImageUpload.single("image"),
  createProduct
);
router.get("/:id", getProductById);
router.put(
  "/:id",
  protect,
  allowRoles("farmer"),
  requireVerified,
  productImageUpload.single("image"),
  updateProduct
);
router.delete("/:id", protect, allowRoles("farmer"), deleteProduct);

export default router;
