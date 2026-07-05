import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  getMyProducts,
  deleteProduct,
} from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getProducts);
router.get("/my", protect, getMyProducts);
router.post("/", protect, createProduct);
router.get("/:id", getProductById);
router.delete("/:id", protect, deleteProduct);

export default router;