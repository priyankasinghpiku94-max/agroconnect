import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const services = new Set([
  "aggregation",
  "quality_check",
  "dispatch",
  "full_service",
]);
const units = new Set(["kg", "quintal", "ton"]);
const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const dateOnly = (value) =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value || "").slice(0, 10);

export const getCollectionCentres = async (req, res) => {
  try {
    const scope = req.user.role === "admin" ? "" : "WHERE c.status = 'active'";
    const [centres] = await db.query(
      `
      SELECT
        c.id,
        c.name,
        c.operatorName AS operator_name,
        c.phone,
        c.city,
        c.state,
        c.address,
        c.serviceType AS service_type,
        c.dailyCapacity AS daily_capacity,
        c.capacityUnit AS capacity_unit,
        c.feePerUnit AS fee_per_unit,
        c.status,
        c.created_at,
        GREATEST(
          c.dailyCapacity - COALESCE((
            SELECT SUM(cb.quantity)
            FROM collection_bookings cb
            WHERE cb.centreId = c.id
              AND cb.scheduledDate = CURRENT_DATE
              AND cb.status IN ('confirmed', 'received')
          ), 0),
          0
        ) AS available_today
      FROM collection_centres c
      ${scope}
      ORDER BY c.status = 'active' DESC, c.id DESC
      `
    );
    res.json({ success: true, centres });
  } catch (error) {
    console.error("Get collection centres error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch collection centres" });
  }
};

export const createCollectionCentre = async (req, res) => {
  try {
    const {
      name,
      operator_name,
      phone,
      city,
      state,
      address,
      service_type,
      daily_capacity,
      capacity_unit,
      fee_per_unit,
    } = req.body;
    const capacity = Number(daily_capacity);
    const fee = Number(fee_per_unit || 0);
    if (
      String(name || "").trim().length < 3 ||
      String(operator_name || "").trim().length < 2 ||
      !String(city || "").trim() ||
      !String(state || "").trim() ||
      String(address || "").trim().length < 5 ||
      !services.has(String(service_type)) ||
      !units.has(String(capacity_unit)) ||
      !Number.isFinite(capacity) ||
      capacity <= 0 ||
      !Number.isFinite(fee) ||
      fee < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid centre, service, capacity and address details",
      });
    }
    const [result] = await db.query(
      `
      INSERT INTO collection_centres
      (
        name, operatorName, phone, city, state, address, serviceType,
        dailyCapacity, capacityUnit, feePerUnit, createdBy
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(name).trim().slice(0, 150),
        String(operator_name).trim().slice(0, 120),
        String(phone || "").trim().slice(0, 20) || null,
        String(city).trim().slice(0, 100),
        String(state).trim().slice(0, 100),
        String(address).trim().slice(0, 500),
        service_type,
        capacity,
        capacity_unit,
        fee,
        req.user.id,
      ]
    );
    res.status(201).json({
      success: true,
      message: "Collection centre added",
      centre_id: result.insertId,
    });
  } catch (error) {
    console.error("Create collection centre error:", error);
    res.status(500).json({ success: false, message: "Failed to create collection centre" });
  }
};

export const updateCollectionCentre = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await db.query("SELECT * FROM collection_centres WHERE id = ?", [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Collection centre not found" });
    }
    const current = rows[0];
    const capacity = Number(req.body.daily_capacity ?? current.dailyCapacity);
    const fee = Number(req.body.fee_per_unit ?? current.feePerUnit);
    const status = String(req.body.status ?? current.status);
    if (
      !Number.isFinite(capacity) ||
      capacity <= 0 ||
      !Number.isFinite(fee) ||
      fee < 0 ||
      !["active", "inactive"].includes(status)
    ) {
      return res.status(400).json({ success: false, message: "Invalid centre update" });
    }
    await db.query(
      `
      UPDATE collection_centres
      SET dailyCapacity = ?, feePerUnit = ?, status = ?
      WHERE id = ?
      `,
      [capacity, fee, status, id]
    );
    res.json({ success: true, message: "Collection centre updated" });
  } catch (error) {
    console.error("Update collection centre error:", error);
    res.status(500).json({ success: false, message: "Failed to update collection centre" });
  }
};

export const getCollectionBookings = async (req, res) => {
  try {
    const values = [];
    let scope = "";
    if (req.user.role !== "admin") {
      scope = "WHERE cb.userId = ?";
      values.push(req.user.id);
    }
    const [bookings] = await db.query(
      `
      SELECT
        cb.id,
        cb.centreId AS centre_id,
        cb.userId AS user_id,
        cb.productId AS product_id,
        cb.orderId AS order_id,
        cb.quantity,
        cb.capacityUnit AS capacity_unit,
        cb.scheduledDate AS scheduled_date,
        cb.requestedService AS requested_service,
        cb.totalFee AS total_fee,
        cb.status,
        cb.notes,
        cb.created_at,
        c.name AS centre_name,
        c.city,
        c.state,
        u.fullName AS customer_name,
        u.role AS customer_role,
        p.productName AS product_name
      FROM collection_bookings cb
      INNER JOIN collection_centres c ON c.id = cb.centreId
      INNER JOIN users u ON u.id = cb.userId
      LEFT JOIN products p ON p.id = cb.productId
      ${scope}
      ORDER BY cb.id DESC
      `,
      values
    );
    res.json({ success: true, bookings });
  } catch (error) {
    console.error("Get collection bookings error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch collection bookings" });
  }
};

export const createCollectionBooking = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const centreId = Number(req.params.id);
    const quantity = Number(req.body.quantity);
    const scheduled = String(req.body.scheduled_date || "");
    const requestedService = String(req.body.requested_service || "");
    const productId = req.body.product_id ? Number(req.body.product_id) : null;
    const orderId = req.body.order_id ? Number(req.body.order_id) : null;
    const today = new Date().toISOString().slice(0, 10);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !validDate(scheduled) ||
      scheduled < today ||
      !services.has(requestedService)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity, future schedule and service are required",
      });
    }
    await connection.beginTransaction();
    const [centres] = await connection.query(
      "SELECT * FROM collection_centres WHERE id = ? AND status = 'active' FOR UPDATE",
      [centreId]
    );
    if (!centres.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Collection centre is unavailable" });
    }
    const centre = centres[0];
    if (
      centre.serviceType !== "full_service" &&
      requestedService !== centre.serviceType
    ) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Requested service is not available at this centre",
      });
    }
    if (productId) {
      const [products] = await connection.query(
        "SELECT id FROM products WHERE id = ? AND farmerId = ?",
        [productId, req.user.id]
      );
      if (!products.length) {
        await connection.rollback();
        return res.status(403).json({ success: false, message: "Linked product is not owned by you" });
      }
    }
    if (orderId) {
      const [orders] = await connection.query(
        `
        SELECT id FROM orders
        WHERE id = ? AND (farmerId = ? OR distributorId = ?)
        `,
        [orderId, req.user.id, req.user.id]
      );
      if (!orders.length) {
        await connection.rollback();
        return res.status(403).json({ success: false, message: "Linked order is not accessible" });
      }
    }
    const [[reserved]] = await connection.query(
      `
      SELECT COALESCE(SUM(quantity), 0) AS quantity
      FROM collection_bookings
      WHERE centreId = ? AND scheduledDate = ?
        AND status IN ('confirmed', 'received')
      `,
      [centreId, scheduled]
    );
    if (Number(reserved.quantity) + quantity > Number(centre.dailyCapacity)) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Daily centre capacity is unavailable" });
    }
    const totalFee = quantity * Number(centre.feePerUnit);
    const [result] = await connection.query(
      `
      INSERT INTO collection_bookings
      (
        centreId, userId, productId, orderId, quantity, capacityUnit,
        scheduledDate, requestedService, totalFee, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        centreId,
        req.user.id,
        productId,
        orderId,
        quantity,
        centre.capacityUnit,
        scheduled,
        requestedService,
        totalFee,
        String(req.body.notes || "").trim().slice(0, 1000),
      ]
    );
    const [admins] = await connection.query(
      "SELECT id FROM users WHERE role = 'admin' AND isActive = 1"
    );
    for (const admin of admins) {
      await createNotification(connection, {
        userId: admin.id,
        type: "collection_booking",
        title: "New collection-centre request",
        message: `${req.user.name} requested ${centre.name} for ${scheduled}.`,
        relatedType: "collection_booking",
        relatedId: result.insertId,
      });
    }
    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Collection slot requested",
      booking_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create collection booking error:", error);
    res.status(500).json({ success: false, message: "Failed to request collection slot" });
  } finally {
    connection.release();
  }
};

export const updateCollectionBookingStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const id = Number(req.params.id);
    const next = String(req.body.status || "");
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `
      SELECT cb.*, c.name AS centreName, c.dailyCapacity
      FROM collection_bookings cb
      INNER JOIN collection_centres c ON c.id = cb.centreId
      WHERE cb.id = ?
      FOR UPDATE
      `,
      [id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Collection booking not found" });
    }
    const booking = rows[0];
    const adminTransitions = {
      requested: ["confirmed", "rejected"],
      confirmed: ["received"],
      received: ["completed"],
    };
    const userCanCancel =
      req.user.role !== "admin" &&
      Number(booking.userId) === Number(req.user.id) &&
      ["requested", "confirmed"].includes(booking.status) &&
      next === "cancelled";
    const adminCanUpdate =
      req.user.role === "admin" &&
      (adminTransitions[booking.status] || []).includes(next);
    if (!userCanCancel && !adminCanUpdate) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: "Status transition is not allowed" });
    }
    if (next === "confirmed") {
      const [[reserved]] = await connection.query(
        `
        SELECT COALESCE(SUM(quantity), 0) AS quantity
        FROM collection_bookings
        WHERE centreId = ? AND scheduledDate = ? AND id != ?
          AND status IN ('confirmed', 'received')
        `,
        [booking.centreId, dateOnly(booking.scheduledDate), id]
      );
      if (Number(reserved.quantity) + Number(booking.quantity) > Number(booking.dailyCapacity)) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: "Daily capacity is no longer available" });
      }
    }
    await connection.query(
      `
      UPDATE collection_bookings
      SET status = ?, reviewedBy = COALESCE(?, reviewedBy),
          reviewedAt = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [next, req.user.role === "admin" ? req.user.id : null, id]
    );
    await createNotification(connection, {
      userId:
        req.user.role === "admin"
          ? booking.userId
          : (await connection.query(
              "SELECT id FROM users WHERE role = 'admin' AND isActive = 1 ORDER BY id LIMIT 1"
            ))[0][0]?.id || booking.userId,
      type: "collection_booking",
      title: "Collection-centre booking updated",
      message: `${booking.centreName} booking is now ${next}.`,
      relatedType: "collection_booking",
      relatedId: id,
    });
    await connection.commit();
    res.json({ success: true, message: `Collection booking ${next}` });
  } catch (error) {
    await connection.rollback();
    console.error("Update collection booking error:", error);
    res.status(500).json({ success: false, message: "Failed to update collection booking" });
  } finally {
    connection.release();
  }
};
