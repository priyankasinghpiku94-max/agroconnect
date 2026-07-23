import { db } from "../config/db.js";
import {
  deleteProductImage,
  getProductImagePath,
  saveProductImage,
  toPublicImageUrl,
} from "../middleware/uploadMiddleware.js";

const categories = new Set([
  "Vegetables",
  "Fruits",
  "Grains",
  "Pulses",
  "Spices",
  "Other",
]);
const units = new Set(["kg", "quintal", "ton", "box", "piece"]);
const grades = new Set(["A", "B", "C", "Standard"]);
const statuses = new Set(["available", "out_of_stock", "paused", "sold"]);

const parseLocation = (location, fallbackCity = "", fallbackState = "") => {
  const value = String(location || "").trim();
  if (!value) return { city: fallbackCity, state: fallbackState };
  const [city, ...stateParts] = value.split(",");
  return {
    city: city.trim(),
    state: stateParts.join(",").trim() || fallbackState,
  };
};

const validRemoteImage = (value) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

const mapImages = (req, products) =>
  products.map((product) => ({
    ...product,
    image_url: toPublicImageUrl(req, product.image_url),
    farmer_verified: Boolean(product.farmer_verified),
  }));

const selectFields = `
  p.id,
  p.farmerId AS farmer_id,
  p.productName AS crop_name,
  p.category,
  p.quantity,
  p.unit,
  p.price AS price_per_unit,
  p.minOrderQuantity AS min_order_quantity,
  p.qualityGrade AS quality_grade,
  p.harvestDate AS harvest_date,
  p.description,
  p.image AS image_url,
  p.city AS district,
  p.state,
  CONCAT_WS(', ', NULLIF(p.city, ''), NULLIF(p.state, '')) AS location,
  p.status,
  p.created_at,
  p.updated_at,
  u.fullName AS farmer_name,
  u.phoneNumber AS farmer_phone,
  (u.verificationStatus = 'verified') AS farmer_verified
`;

export const getProducts = async (req, res) => {
  try {
    const { search, category, district, state } = req.query;

    let query = `
      SELECT ${selectFields}
      FROM products p
      INNER JOIN users u ON p.farmerId = u.id
      WHERE u.isActive = 1
        AND u.verificationStatus = 'verified'
        AND p.status = 'available'
        AND p.quantity > 0
    `;
    const values = [];

    if (search) {
      query += " AND p.productName LIKE ?";
      values.push(`%${String(search).trim().slice(0, 80)}%`);
    }
    if (category) {
      query += " AND p.category = ?";
      values.push(String(category).trim());
    }
    if (district) {
      query += " AND p.city LIKE ?";
      values.push(`%${String(district).trim().slice(0, 80)}%`);
    }
    if (state) {
      query += " AND p.state LIKE ?";
      values.push(`%${String(state).trim().slice(0, 80)}%`);
    }

    query += " ORDER BY p.id DESC";
    const [products] = await db.query(query, values);
    res.json({ success: true, products: mapImages(req, products) });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
};

export const getProductById = async (req, res) => {
  try {
    const [products] = await db.query(
      `
      SELECT ${selectFields}
      FROM products p
      INNER JOIN users u ON p.farmerId = u.id
      WHERE p.id = ?
        AND u.isActive = 1
        AND u.verificationStatus = 'verified'
        AND p.status = 'available'
        AND p.quantity > 0
      `,
      [req.params.id]
    );

    if (!products.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, product: mapImages(req, products)[0] });
  } catch (error) {
    console.error("Get product details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product details",
    });
  }
};

const validateProduct = (body, { partial = false } = {}) => {
  const required = [
    "crop_name",
    "category",
    "quantity",
    "unit",
    "price_per_unit",
  ];
  if (!partial && required.some((field) => body[field] === undefined || body[field] === "")) {
    return "Crop name, category, quantity, unit and price are required";
  }

  if (body.crop_name !== undefined) {
    const name = String(body.crop_name).trim();
    if (name.length < 2 || name.length > 120) return "Crop name must be 2 to 120 characters";
  }
  if (body.category !== undefined && !categories.has(String(body.category))) {
    return "Please select a valid product category";
  }
  if (body.unit !== undefined && !units.has(String(body.unit))) {
    return "Please select a valid quantity unit";
  }
  if (body.quality_grade !== undefined && !grades.has(String(body.quality_grade))) {
    return "Please select a valid quality grade";
  }
  if (body.status !== undefined && !statuses.has(String(body.status))) {
    return "Please select a valid stock status";
  }

  for (const field of ["quantity", "price_per_unit", "min_order_quantity"]) {
    if (body[field] !== undefined && body[field] !== "") {
      const value = Number(body[field]);
      if (!Number.isFinite(value) || value < 0) return `${field.replaceAll("_", " ")} is invalid`;
    }
  }

  if (
    body.quantity !== undefined &&
    body.min_order_quantity !== undefined &&
    Number(body.min_order_quantity) > Number(body.quantity) &&
    Number(body.quantity) > 0
  ) {
    return "Minimum order quantity cannot exceed available stock";
  }

  return "";
};

export const createProduct = async (req, res) => {
  let uploadedImage = null;
  try {
    const validationError = validateProduct(req.body);
    if (validationError) {
      if (req.file) await deleteProductImage(getProductImagePath(req.file.filename));
      return res.status(400).json({ success: false, message: validationError });
    }

    const { city, state } = parseLocation(
      req.body.location,
      req.user.city || "",
      req.user.state || ""
    );
    const quantity = Number(req.body.quantity);
    uploadedImage = req.file ? await saveProductImage(req.file) : null;
    const image = uploadedImage?.image || validRemoteImage(req.body.image_url);
    const status =
      quantity === 0 ? "out_of_stock" : String(req.body.status || "available");

    const [result] = await db.query(
      `
      INSERT INTO products
      (
        farmerId, productName, category, quantity, unit, price,
        minOrderQuantity, qualityGrade, harvestDate, description,
        image, imagePublicId, city, state, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        String(req.body.crop_name).trim(),
        String(req.body.category),
        quantity,
        String(req.body.unit),
        Number(req.body.price_per_unit),
        Number(req.body.min_order_quantity || 1),
        String(req.body.quality_grade || "Standard"),
        req.body.harvest_date || null,
        String(req.body.description || "").trim().slice(0, 3000),
        image,
        uploadedImage?.publicId || null,
        city,
        state,
        status,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product_id: result.insertId,
    });
  } catch (error) {
    if (uploadedImage) {
      await deleteProductImage(uploadedImage.image, uploadedImage.publicId);
    } else if (req.file) {
      await deleteProductImage(getProductImagePath(req.file.filename));
    }
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: error.message?.startsWith("Cloud image upload failed")
        ? error.message
        : "Failed to add product",
    });
  }
};

export const getMyProducts = async (req, res) => {
  try {
    const [products] = await db.query(
      `
      SELECT ${selectFields}
      FROM products p
      INNER JOIN users u ON p.farmerId = u.id
      WHERE p.farmerId = ?
      ORDER BY p.id DESC
      `,
      [req.user.id]
    );
    res.json({ success: true, products: mapImages(req, products) });
  } catch (error) {
    console.error("Get my products error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch my products" });
  }
};

export const updateProduct = async (req, res) => {
  let uploadedImage = null;
  try {
    const validationError = validateProduct(req.body, { partial: true });
    if (validationError) {
      if (req.file) await deleteProductImage(getProductImagePath(req.file.filename));
      return res.status(400).json({ success: false, message: validationError });
    }

    const [products] = await db.query(
      "SELECT * FROM products WHERE id = ? AND farmerId = ?",
      [req.params.id, req.user.id]
    );
    if (!products.length) {
      if (req.file) await deleteProductImage(getProductImagePath(req.file.filename));
      return res.status(404).json({
        success: false,
        message: "Product not found or you do not own this listing",
      });
    }

    const current = products[0];
    const nextQuantity =
      req.body.quantity === undefined ? Number(current.quantity) : Number(req.body.quantity);
    const nextMinimum =
      req.body.min_order_quantity === undefined
        ? Number(current.minOrderQuantity)
        : Number(req.body.min_order_quantity);
    if (nextQuantity > 0 && nextMinimum > nextQuantity) {
      if (req.file) await deleteProductImage(getProductImagePath(req.file.filename));
      return res.status(400).json({
        success: false,
        message: "Minimum order quantity cannot exceed available stock",
      });
    }

    const parsedLocation = parseLocation(
      req.body.location,
      current.city,
      current.state
    );
    let image = current.image;
    let imagePublicId = current.imagePublicId;
    if (req.file) {
      uploadedImage = await saveProductImage(req.file);
      image = uploadedImage.image;
      imagePublicId = uploadedImage.publicId;
    }
    else if (req.body.image_url !== undefined) {
      const remoteImage = validRemoteImage(req.body.image_url);
      if (remoteImage) {
        image = remoteImage;
        imagePublicId = null;
      }
    }

    let nextStatus = String(req.body.status || current.status);
    if (nextQuantity === 0) nextStatus = "out_of_stock";
    if (nextQuantity > 0 && nextStatus === "out_of_stock") nextStatus = "available";

    await db.query(
      `
      UPDATE products
      SET
        productName = ?,
        category = ?,
        quantity = ?,
        unit = ?,
        price = ?,
        minOrderQuantity = ?,
        qualityGrade = ?,
        harvestDate = ?,
        description = ?,
        image = ?,
        imagePublicId = ?,
        city = ?,
        state = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND farmerId = ?
      `,
      [
        String(req.body.crop_name ?? current.productName).trim(),
        String(req.body.category ?? current.category),
        nextQuantity,
        String(req.body.unit ?? current.unit),
        Number(req.body.price_per_unit ?? current.price),
        nextMinimum,
        String(req.body.quality_grade ?? current.qualityGrade),
        req.body.harvest_date === undefined
          ? current.harvestDate
          : req.body.harvest_date || null,
        String(req.body.description ?? current.description ?? "").trim().slice(0, 3000),
        image,
        imagePublicId,
        parsedLocation.city,
        parsedLocation.state,
        nextStatus,
        req.params.id,
        req.user.id,
      ]
    );

    if (current.image !== image) {
      await deleteProductImage(current.image, current.imagePublicId);
    }

    res.json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    if (uploadedImage) {
      await deleteProductImage(uploadedImage.image, uploadedImage.publicId);
    } else if (req.file) {
      await deleteProductImage(getProductImagePath(req.file.filename));
    }
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: error.message?.startsWith("Cloud image upload failed")
        ? error.message
        : "Failed to update product",
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const [products] = await db.query(
      "SELECT image, imagePublicId FROM products WHERE id = ? AND farmerId = ?",
      [req.params.id, req.user.id]
    );
    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found or you do not own this listing",
      });
    }

    await db.query("DELETE FROM products WHERE id = ? AND farmerId = ?", [
      req.params.id,
      req.user.id,
    ]);
    await deleteProductImage(products[0].image, products[0].imagePublicId);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ success: false, message: "Failed to delete product" });
  }
};
