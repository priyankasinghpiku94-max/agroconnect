import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import cloudinary, { cloudinaryEnabled } from "../config/cloudinary.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const backendRoot = path.resolve(currentDir, "..");
export const productUploadDir = path.join(backendRoot, "uploads", "products");
export const kycUploadDir = path.join(backendRoot, "uploads", "kyc");

fs.mkdirSync(productUploadDir, { recursive: true });
fs.mkdirSync(kycUploadDir, { recursive: true });

const extensionByMime = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const storage = (destination) =>
  multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, destination),
    filename: (_req, file, callback) => {
      const extension = extensionByMime[file.mimetype];
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    },
  });

const imageFilter = (_req, file, callback) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  callback(
    allowed.includes(file.mimetype)
      ? null
      : new Error("Only JPG, PNG and WebP product images are allowed"),
    allowed.includes(file.mimetype)
  );
};

const kycFilter = (_req, file, callback) => {
  const allowed = ["image/jpeg", "image/png", "application/pdf"];
  callback(
    allowed.includes(file.mimetype)
      ? null
      : new Error("KYC document must be a JPG, PNG or PDF file"),
    allowed.includes(file.mimetype)
  );
};

export const productImageUpload = multer({
  storage: storage(productUploadDir),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageFilter,
});

export const kycDocumentUpload = multer({
  storage: storage(kycUploadDir),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: kycFilter,
});

export const getProductImagePath = (filename) =>
  filename ? `/uploads/products/${filename}` : "";

export const toPublicImageUrl = (req, storedValue) => {
  if (!storedValue) return "";
  if (/^https?:\/\//i.test(storedValue)) return storedValue;
  return `${req.protocol}://${req.get("host")}${storedValue}`;
};

const removeLocalFile = async (absolutePath) => {
  try {
    await fs.promises.rm(absolutePath, { force: true });
  } catch (error) {
    console.error("Upload cleanup error:", error.message);
  }
};

export const saveProductImage = async (file) => {
  if (!file) return { image: "", publicId: null };

  if (!cloudinaryEnabled) {
    return {
      image: getProductImagePath(file.filename),
      publicId: null,
    };
  }

  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: process.env.CLOUDINARY_PRODUCT_FOLDER || "agroconnect/products",
      resource_type: "image",
      overwrite: false,
    });
    await removeLocalFile(file.path);
    return {
      image: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    await removeLocalFile(file.path);
    throw new Error(`Cloud image upload failed: ${error.message}`);
  }
};

export const deleteProductImage = async (storedValue, publicId = null) => {
  if (publicId && cloudinaryEnabled) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch (error) {
      console.error("Cloud image cleanup error:", error.message);
    }
    return;
  }

  if (!storedValue?.startsWith("/uploads/products/")) return;
  const filename = path.basename(storedValue);
  await removeLocalFile(path.join(productUploadDir, filename));
};

export const deleteKycDocument = (filename) => {
  if (!filename) return;
  const absolutePath = path.join(kycUploadDir, path.basename(filename));
  fs.rm(absolutePath, { force: true }, () => {});
};

export const resolveKycDocument = (filename) => {
  if (!filename) return null;
  return path.join(kycUploadDir, path.basename(filename));
};
