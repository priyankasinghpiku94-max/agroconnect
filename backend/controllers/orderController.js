import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

export const createOrder = async (req, res) => {
  let connection;
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid order quantity",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [products] = await connection.query(
      `
      SELECT p.farmerId, p.productName, p.price, p.quantity,
        p.minOrderQuantity, p.status
      FROM products p
      WHERE id = ?
      FOR UPDATE
      `,
      [req.params.id]
    );
    if (!products.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const product = products[0];
    if (product.status !== "available" || Number(product.quantity) <= 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "This product is currently out of stock",
      });
    }
    if (quantity < Number(product.minOrderQuantity || 1)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Minimum order quantity is ${product.minOrderQuantity}`,
      });
    }
    if (quantity > Number(product.quantity)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} units are currently available`,
      });
    }
    if (Number(product.farmerId) === Number(req.user.id)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "You cannot order your own product",
      });
    }

    const [result] = await connection.query(
      `
      INSERT INTO orders
      (productId, farmerId, distributorId, quantity, message, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
      `,
      [
        req.params.id,
        product.farmerId,
        req.user.id,
        quantity,
        String(req.body.message || "").trim().slice(0, 1000),
      ]
    );
    await createNotification(connection, {
      userId: product.farmerId,
      type: "order_received",
      title: "New direct order request",
      message: `${req.user.name} requested ${quantity} units of ${product.productName}.`,
      relatedType: "order",
      relatedId: result.insertId,
    });
    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Order request sent successfully",
      order_id: result.insertId,
      total_price: quantity * Number(product.price),
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Create order error:", error);
    res.status(500).json({ success: false, message: "Order failed" });
  } finally {
    if (connection) connection.release();
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const ownerColumn =
      req.user.role === "farmer" ? "o.farmerId" : "o.distributorId";
    const [orders] = await db.query(
      `
      SELECT
        o.id,
        o.productId AS product_id,
        p.productName AS crop_name,
        o.quantity,
        p.unit,
        COALESCE(o.agreedPrice, p.price) AS unit_price,
        (CAST(o.quantity AS DECIMAL(12,2)) * COALESCE(o.agreedPrice, p.price))
          AS total_price,
        o.status,
        o.message,
        o.demandId AS demand_id,
        o.quotationId AS quotation_id,
        CASE WHEN o.quotationId IS NULL THEN 'direct' ELSE 'demand' END AS source,
        f.fullName AS farmer_name,
        d.fullName AS distributor_name,
        o.created_at,
        o.updated_at
      FROM orders o
      LEFT JOIN products p ON o.productId = p.id
      LEFT JOIN users f ON o.farmerId = f.id
      LEFT JOIN users d ON o.distributorId = d.id
      WHERE ${ownerColumn} = ?
      ORDER BY o.id DESC
      `,
      [req.user.id]
    );
    res.json({ success: true, orders });
  } catch (error) {
    console.error("Get my orders error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
};

export const updateOrderStatus = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const requestedStatus = String(req.body.status || "");
    if (!["accepted", "rejected", "completed"].includes(requestedStatus)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    await connection.beginTransaction();
    const [orders] = await connection.query(
      `
      SELECT o.*, p.quantity AS availableQuantity
      FROM orders o
      INNER JOIN products p ON o.productId = p.id
      WHERE o.id = ? AND o.farmerId = ?
      FOR UPDATE
      `,
      [req.params.id, req.user.id]
    );
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Order not found or you do not own it",
      });
    }

    const order = orders[0];
    const transitions = {
      pending: ["accepted", "rejected"],
      accepted: ["completed", "rejected"],
      rejected: [],
      completed: [],
    };
    if (!transitions[order.status]?.includes(requestedStatus)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Order cannot change from ${order.status} to ${requestedStatus}`,
      });
    }

    if (requestedStatus === "completed") {
      const remaining = Number(order.availableQuantity) - Number(order.quantity);
      if (remaining < 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "Available stock is lower than this order quantity",
        });
      }
      await connection.query(
        `
        UPDATE products
        SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [remaining, remaining === 0 ? "out_of_stock" : "available", order.productId]
      );
    }

    await connection.query(
      "UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [requestedStatus, req.params.id]
    );
    await createNotification(connection, {
      userId: order.distributorId,
      type: `order_${requestedStatus}`,
      title: `Order ${requestedStatus}`,
      message: `Order #${order.id} was ${requestedStatus} by the farmer.`,
      relatedType: "order",
      relatedId: order.id,
    });
    await connection.commit();
    res.json({ success: true, message: "Order status updated successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  } finally {
    if (connection) connection.release();
  }
};
