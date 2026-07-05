import { db } from "../config/db.js";

export const getProducts = async (req, res) => {
  try {
    const { search, category, district, state } = req.query;

    let query = `
      SELECT 
        p.id,
        p.farmerId AS farmer_id,
        p.productName AS crop_name,
        p.category,
        p.quantity,
        p.unit,
        p.price AS price_per_unit,
        p.description,
        p.image AS image_url,
        p.city AS district,
        p.state,
        CONCAT(p.city, ', ', p.state) AS location,
        p.status,
        u.fullName AS farmer_name,
        u.phoneNumber AS farmer_phone
      FROM products p
      LEFT JOIN users u ON p.farmerId = u.id
      WHERE 1 = 1
    `;

    const values = [];

    if (search) {
      query += " AND p.productName LIKE ?";
      values.push(`%${search}%`);
    }

    if (category) {
      query += " AND p.category = ?";
      values.push(category);
    }

    if (district) {
      query += " AND p.city LIKE ?";
      values.push(`%${district}%`);
    }

    if (state) {
      query += " AND p.state LIKE ?";
      values.push(`%${state}%`);
    }

    query += " ORDER BY p.id DESC";

    const [products] = await db.query(query, values);

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const [products] = await db.query(
      `
      SELECT 
        p.id,
        p.farmerId AS farmer_id,
        p.productName AS crop_name,
        p.category,
        p.quantity,
        p.unit,
        p.price AS price_per_unit,
        p.description,
        p.image AS image_url,
        p.city AS district,
        p.state,
        CONCAT(p.city, ', ', p.state) AS location,
        p.status,
        u.fullName AS farmer_name,
        u.phoneNumber AS farmer_phone
      FROM products p
      LEFT JOIN users u ON p.farmerId = u.id
      WHERE p.id = ?
      `,
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      product: products[0],
    });
  } catch (error) {
    console.error("Get product details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product details",
    });
  }
};

export const createProduct = async (req, res) => {
  try {
    const {
      crop_name,
      category,
      quantity,
      unit,
      price_per_unit,
      description,
      location,
      image_url,
    } = req.body;

    const farmerId = req.user?.id || 1;

    let city = "Patna";
    let state = "Bihar";

    if (location && location.includes(",")) {
      const parts = location.split(",");
      city = parts[0].trim();
      state = parts[1]?.trim() || "Bihar";
    } else if (location) {
      city = location;
    }

    await db.query(
      `
      INSERT INTO products
      (farmerId, productName, category, quantity, unit, price, description, image, city, state, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        farmerId,
        crop_name,
        category,
        quantity,
        unit,
        price_per_unit,
        description,
        image_url,
        city,
        state,
        "available",
      ]
    );

    res.status(201).json({
      success: true,
      message: "Product added successfully",
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product",
    });
  }
};

export const getMyProducts = async (req, res) => {
  try {
    const farmerId = req.user?.id || 1;

    const [products] = await db.query(
      `
      SELECT 
        id,
        farmerId AS farmer_id,
        productName AS crop_name,
        category,
        quantity,
        unit,
        price AS price_per_unit,
        description,
        image AS image_url,
        city AS district,
        state,
        CONCAT(city, ', ', state) AS location,
        status
      FROM products
      WHERE farmerId = ?
      ORDER BY id DESC
      `,
      [farmerId]
    );

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Get my products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch my products",
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM products WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};