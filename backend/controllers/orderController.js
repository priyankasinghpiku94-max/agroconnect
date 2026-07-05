import { db } from "../config/db.js";

export const createOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, message } = req.body;

    const distributorId = req.user?.id || 2;

    const [products] = await db.query(
      "SELECT farmerId, price FROM products WHERE id = ?",
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = products[0];
    const totalPrice = Number(quantity || 0) * Number(product.price || 0);

    await db.query(
      `
      INSERT INTO orders
      (productId, farmerId, distributorId, quantity, message, status)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, product.farmerId, distributorId, quantity, message || "", "pending"]
    );

    res.status(201).json({
      success: true,
      message: "Order request sent successfully",
      total_price: totalPrice,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Order failed",
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const user = req.user || { id: 1, role: "farmer" };

    let query = `
      SELECT 
        o.id,
        o.productId AS product_id,
        p.productName AS crop_name,
        o.quantity,
        p.unit,
        (CAST(o.quantity AS DECIMAL(10,2)) * p.price) AS total_price,
        o.status,
        o.message,
        f.fullName AS farmer_name,
        d.fullName AS distributor_name,
        o.created_at
      FROM orders o
      LEFT JOIN products p ON o.productId = p.id
      LEFT JOIN users f ON o.farmerId = f.id
      LEFT JOIN users d ON o.distributorId = d.id
    `;

    const values = [];

    if (user.role === "farmer") {
      query += " WHERE o.farmerId = ?";
      values.push(user.id);
    } else if (user.role === "distributor") {
      query += " WHERE o.distributorId = ?";
      values.push(user.id);
    }

    query += " ORDER BY o.id DESC";

    const [orders] = await db.query(query, values);

    res.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Get my orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ["pending", "accepted", "rejected", "completed"];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);

    res.json({
      success: true,
      message: "Order status updated successfully",
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};