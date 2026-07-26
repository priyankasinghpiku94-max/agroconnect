import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const categories = new Set([
  "seed",
  "fertilizer",
  "pesticide",
  "bio_input",
  "tools",
  "other",
]);
const units = new Set(["kg", "litre", "packet", "bag", "piece"]);
const statuses = new Set(["active", "out_of_stock", "inactive"]);

const selectFields = `
  i.id,
  i.sellerId AS seller_id,
  i.name,
  i.category,
  i.brand,
  i.description,
  i.certification,
  i.price,
  i.stockQuantity AS stock_quantity,
  i.unit,
  i.minOrderQuantity AS min_order_quantity,
  i.city,
  i.state,
  i.status,
  i.created_at,
  u.fullName AS seller_name,
  u.businessName AS business_name,
  (u.verificationStatus = 'verified') AS seller_verified,
  GREATEST(
    i.stockQuantity - COALESCE((
      SELECT SUM(io.quantity)
      FROM input_orders io
      WHERE io.inputId = i.id
        AND io.status IN ('pending', 'accepted', 'shipped')
    ), 0),
    0
  ) AS available_quantity
`;

export const getInputs = async (req, res) => {
  try {
    const where = ["u.isActive = 1", "u.verificationStatus = 'verified'"];
    const values = [];
    if (req.user.role !== "admin") {
      where.push("i.status = 'active'", "i.stockQuantity > 0");
    }
    if (req.query.category) {
      where.push("i.category = ?");
      values.push(String(req.query.category));
    }
    if (req.query.city) {
      where.push("i.city LIKE ?");
      values.push(`%${String(req.query.city).trim().slice(0, 100)}%`);
    }
    if (req.query.search) {
      where.push("(i.name LIKE ? OR i.brand LIKE ? OR i.description LIKE ?)");
      const search = `%${String(req.query.search).trim().slice(0, 100)}%`;
      values.push(search, search, search);
    }

    const [inputs] = await db.query(
      `
      SELECT ${selectFields}
      FROM agri_inputs i
      INNER JOIN users u ON u.id = i.sellerId
      WHERE ${where.join(" AND ")}
      ORDER BY i.status = 'active' DESC, i.id DESC
      `,
      values
    );
    res.json({ success: true, inputs });
  } catch (error) {
    console.error("Get agri inputs error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch agriculture inputs" });
  }
};

export const createInput = async (req, res) => {
  try {
    const {
      name,
      category,
      brand,
      description,
      certification,
      price,
      stock_quantity,
      unit,
      min_order_quantity,
      city,
      state,
    } = req.body;
    const cleanName = String(name || "").trim();
    const amount = Number(price);
    const stock = Number(stock_quantity);
    const minimum = Number(min_order_quantity || 1);
    if (
      cleanName.length < 3 ||
      cleanName.length > 150 ||
      !categories.has(String(category)) ||
      !units.has(String(unit)) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(stock) ||
      stock <= 0 ||
      !Number.isFinite(minimum) ||
      minimum <= 0 ||
      minimum > stock ||
      !String(city || "").trim() ||
      !String(state || "").trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid input, price, stock, unit and location details",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO agri_inputs
      (
        sellerId, name, category, brand, description, certification, price,
        stockQuantity, unit, minOrderQuantity, city, state
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        cleanName,
        category,
        String(brand || "").trim().slice(0, 120) || null,
        String(description || "").trim().slice(0, 3000),
        String(certification || "").trim().slice(0, 150) || null,
        amount,
        stock,
        unit,
        minimum,
        String(city).trim().slice(0, 100),
        String(state).trim().slice(0, 100),
      ]
    );
    res.status(201).json({
      success: true,
      message: "Agriculture input published",
      input_id: result.insertId,
    });
  } catch (error) {
    console.error("Create input error:", error);
    res.status(500).json({ success: false, message: "Failed to create input listing" });
  }
};

export const updateInput = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await db.query("SELECT * FROM agri_inputs WHERE id = ?", [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Input listing not found" });
    }
    const current = rows[0];
    if (req.user.role !== "admin" && Number(current.sellerId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: "You do not own this listing" });
    }
    const stock = Number(req.body.stock_quantity ?? current.stockQuantity);
    const minimum = Number(req.body.min_order_quantity ?? current.minOrderQuantity);
    const price = Number(req.body.price ?? current.price);
    const status = String(req.body.status ?? current.status);
    const [[reserved]] = await db.query(
      `
      SELECT COALESCE(SUM(quantity), 0) AS quantity
      FROM input_orders
      WHERE inputId = ? AND status IN ('pending', 'accepted', 'shipped')
      `,
      [id]
    );
    if (
      !Number.isFinite(stock) ||
      stock < Number(reserved.quantity) ||
      !Number.isFinite(minimum) ||
      minimum <= 0 ||
      minimum > stock ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !statuses.has(status)
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid update. Stock must cover ${reserved.quantity} reserved unit(s).`,
      });
    }
    const nextStatus =
      stock === 0 ? "out_of_stock" : status === "out_of_stock" ? "active" : status;
    await db.query(
      `
      UPDATE agri_inputs
      SET name = ?, category = ?, brand = ?, description = ?, certification = ?,
          price = ?, stockQuantity = ?, unit = ?, minOrderQuantity = ?,
          city = ?, state = ?, status = ?
      WHERE id = ?
      `,
      [
        String(req.body.name ?? current.name).trim().slice(0, 150),
        categories.has(String(req.body.category))
          ? String(req.body.category)
          : current.category,
        String(req.body.brand ?? current.brand ?? "").trim().slice(0, 120) || null,
        String(req.body.description ?? current.description ?? "").trim().slice(0, 3000),
        String(req.body.certification ?? current.certification ?? "").trim().slice(0, 150) || null,
        price,
        stock,
        units.has(String(req.body.unit)) ? String(req.body.unit) : current.unit,
        minimum,
        String(req.body.city ?? current.city).trim().slice(0, 100),
        String(req.body.state ?? current.state).trim().slice(0, 100),
        nextStatus,
        id,
      ]
    );
    res.json({ success: true, message: "Agriculture input updated" });
  } catch (error) {
    console.error("Update input error:", error);
    res.status(500).json({ success: false, message: "Failed to update input listing" });
  }
};

export const getInputOrders = async (req, res) => {
  try {
    const values = [];
    let scope = "";
    if (req.user.role === "farmer") {
      scope = "WHERE io.buyerId = ?";
      values.push(req.user.id);
    } else if (req.user.role === "distributor") {
      scope = "WHERE io.sellerId = ?";
      values.push(req.user.id);
    }
    const [orders] = await db.query(
      `
      SELECT
        io.id,
        io.inputId AS input_id,
        io.buyerId AS buyer_id,
        io.sellerId AS seller_id,
        io.quantity,
        io.unitPrice AS unit_price,
        io.totalAmount AS total_amount,
        io.deliveryAddress AS delivery_address,
        io.status,
        io.message,
        io.created_at,
        i.name AS input_name,
        i.unit,
        i.category,
        b.fullName AS buyer_name,
        s.fullName AS seller_name
      FROM input_orders io
      INNER JOIN agri_inputs i ON i.id = io.inputId
      INNER JOIN users b ON b.id = io.buyerId
      INNER JOIN users s ON s.id = io.sellerId
      ${scope}
      ORDER BY io.id DESC
      `,
      values
    );
    res.json({ success: true, orders });
  } catch (error) {
    console.error("Get input orders error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch input orders" });
  }
};

export const createInputOrder = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const inputId = Number(req.params.id);
    const quantity = Number(req.body.quantity);
    const address = String(req.body.delivery_address || "").trim();
    if (!Number.isFinite(quantity) || quantity <= 0 || address.length < 5) {
      return res.status(400).json({
        success: false,
        message: "A valid quantity and delivery address are required",
      });
    }

    await connection.beginTransaction();
    const [rows] = await connection.query(
      `
      SELECT * FROM agri_inputs
      WHERE id = ? AND status = 'active'
      FOR UPDATE
      `,
      [inputId]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Input is not available" });
    }
    const item = rows[0];
    const [[reserved]] = await connection.query(
      `
      SELECT COALESCE(SUM(quantity), 0) AS quantity
      FROM input_orders
      WHERE inputId = ? AND status IN ('pending', 'accepted', 'shipped')
      `,
      [inputId]
    );
    const available = Number(item.stockQuantity) - Number(reserved.quantity);
    if (quantity < Number(item.minOrderQuantity) || quantity > available) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Order must be between ${item.minOrderQuantity} and ${Math.max(0, available)} ${item.unit}`,
      });
    }

    const total = quantity * Number(item.price);
    const [result] = await connection.query(
      `
      INSERT INTO input_orders
      (
        inputId, buyerId, sellerId, quantity, unitPrice,
        totalAmount, deliveryAddress, message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        inputId,
        req.user.id,
        item.sellerId,
        quantity,
        item.price,
        total,
        address.slice(0, 500),
        String(req.body.message || "").trim().slice(0, 1000),
      ]
    );
    await createNotification(connection, {
      userId: item.sellerId,
      type: "input_order",
      title: "New agriculture input order",
      message: `${req.user.name} ordered ${quantity} ${item.unit} of ${item.name}.`,
      relatedType: "input_order",
      relatedId: result.insertId,
    });
    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Input order placed",
      order_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create input order error:", error);
    res.status(500).json({ success: false, message: "Failed to place input order" });
  } finally {
    connection.release();
  }
};

export const updateInputOrderStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const id = Number(req.params.id);
    const next = String(req.body.status || "");
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `
      SELECT io.*, i.name AS inputName, i.unit, i.stockQuantity
      FROM input_orders io
      INNER JOIN agri_inputs i ON i.id = io.inputId
      WHERE io.id = ?
      FOR UPDATE
      `,
      [id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Input order not found" });
    }
    const order = rows[0];
    const isAdmin = req.user.role === "admin";
    const isSeller = Number(order.sellerId) === Number(req.user.id);
    const isBuyer = Number(order.buyerId) === Number(req.user.id);
    const sellerTransitions = {
      pending: ["accepted", "rejected"],
      accepted: ["shipped"],
      shipped: ["completed"],
    };
    const buyerCanCancel =
      isBuyer && order.status === "pending" && next === "cancelled";
    const sellerCanUpdate =
      (isAdmin || isSeller) &&
      (sellerTransitions[order.status] || []).includes(next);
    if (!buyerCanCancel && !sellerCanUpdate) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: "Status transition is not allowed" });
    }

    if (next === "accepted") {
      const [[reserved]] = await connection.query(
        `
        SELECT COALESCE(SUM(quantity), 0) AS quantity
        FROM input_orders
        WHERE inputId = ? AND id != ?
          AND status IN ('pending', 'accepted', 'shipped')
        `,
        [order.inputId, id]
      );
      if (Number(reserved.quantity) + Number(order.quantity) > Number(order.stockQuantity)) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: "Input stock is no longer available" });
      }
    }
    if (next === "completed") {
      const remaining = Number(order.stockQuantity) - Number(order.quantity);
      if (remaining < 0) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: "Input stock is insufficient" });
      }
      await connection.query(
        `
        UPDATE agri_inputs
        SET stockQuantity = ?,
            status = CASE WHEN ? = 0 THEN 'out_of_stock' ELSE status END
        WHERE id = ?
        `,
        [remaining, remaining, order.inputId]
      );
    }

    await connection.query("UPDATE input_orders SET status = ? WHERE id = ?", [
      next,
      id,
    ]);
    const notifyUserId = isBuyer ? order.sellerId : order.buyerId;
    await createNotification(connection, {
      userId: notifyUserId,
      type: "input_order",
      title: "Agriculture input order updated",
      message: `${order.inputName} order is now ${next}.`,
      relatedType: "input_order",
      relatedId: id,
    });
    await connection.commit();
    res.json({ success: true, message: `Input order ${next}` });
  } catch (error) {
    await connection.rollback();
    console.error("Update input order error:", error);
    res.status(500).json({ success: false, message: "Failed to update input order" });
  } finally {
    connection.release();
  }
};
