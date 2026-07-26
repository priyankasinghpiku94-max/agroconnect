import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const allowedUnits = new Set(["kg", "quintal", "ton"]);
const clean = (value, max = 255) =>
  String(value || "").trim().slice(0, max);

const bookingDays = (start, end) => {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate < startDate
  ) {
    return 0;
  }
  return Math.floor((endDate - startDate) / 86400000) + 1;
};

export const getWarehouses = async (req, res) => {
  try {
    const visibility = req.user.role === "admin" ? "" : "WHERE w.status = 'active'";
    const [warehouses] = await db.query(
      `
      SELECT
        w.id,
        w.name,
        w.operatorName AS operator_name,
        w.phone,
        w.city,
        w.state,
        w.address,
        w.totalCapacity AS total_capacity,
        w.availableCapacity AS available_capacity,
        w.capacityUnit AS capacity_unit,
        w.ratePerUnitDay AS rate_per_unit_day,
        w.minBookingDays AS min_booking_days,
        w.status,
        w.created_at,
        (
          SELECT COUNT(*) FROM warehouse_bookings wb
          WHERE wb.warehouseId = w.id AND wb.status = 'approved'
        ) AS active_bookings
      FROM warehouses w
      ${visibility}
      ORDER BY w.status = 'active' DESC, w.id DESC
      `
    );
    res.json({ success: true, warehouses });
  } catch (error) {
    console.error("Get warehouses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load warehouses",
    });
  }
};

export const createWarehouse = async (req, res) => {
  try {
    const name = clean(req.body.name, 150);
    const operatorName = clean(req.body.operator_name, 120);
    const phone = clean(req.body.phone, 20).replace(/\D/g, "");
    const city = clean(req.body.city, 100);
    const state = clean(req.body.state, 100);
    const address = clean(req.body.address, 500);
    const totalCapacity = Number(req.body.total_capacity);
    const capacityUnit = clean(req.body.capacity_unit, 20);
    const rate = Number(req.body.rate_per_unit_day);
    const minDays = Number(req.body.min_booking_days || 1);

    if (
      name.length < 3 ||
      !operatorName ||
      !city ||
      !state ||
      !address ||
      !allowedUnits.has(capacityUnit) ||
      !Number.isFinite(totalCapacity) ||
      totalCapacity <= 0 ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      !Number.isInteger(minDays) ||
      minDays < 1 ||
      minDays > 365
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter valid warehouse, capacity and pricing details",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO warehouses
      (
        name, operatorName, phone, city, state, address, totalCapacity,
        availableCapacity, capacityUnit, ratePerUnitDay, minBookingDays,
        status, createdBy
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `,
      [
        name,
        operatorName,
        phone,
        city,
        state,
        address,
        totalCapacity,
        totalCapacity,
        capacityUnit,
        rate,
        minDays,
        req.user.id,
      ]
    );
    res.status(201).json({
      success: true,
      message: "Warehouse added successfully",
      warehouse_id: result.insertId,
    });
  } catch (error) {
    console.error("Create warehouse error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add warehouse",
    });
  }
};

export const updateWarehouse = async (req, res) => {
  try {
    const status = clean(req.body.status, 20).toLowerCase();
    const rate = Number(req.body.rate_per_unit_day);
    if (!["active", "inactive"].includes(status) || !Number.isFinite(rate) || rate <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid warehouse status and rate are required",
      });
    }
    const [result] = await db.query(
      `
      UPDATE warehouses
      SET status = ?, ratePerUnitDay = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [status, rate, req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }
    res.json({ success: true, message: "Warehouse updated successfully" });
  } catch (error) {
    console.error("Update warehouse error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update warehouse",
    });
  }
};

export const createWarehouseBooking = async (req, res) => {
  let connection;
  try {
    const warehouseId = Number(req.params.id);
    const quantity = Number(req.body.quantity);
    const startDate = clean(req.body.start_date, 10);
    const endDate = clean(req.body.end_date, 10);
    const orderId = req.body.order_id ? Number(req.body.order_id) : null;
    const notes = clean(req.body.notes, 1000);
    const days = bookingDays(startDate, endDate);
    const today = new Date().toISOString().slice(0, 10);

    if (
      !Number.isInteger(warehouseId) ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !days ||
      startDate < today ||
      (orderId !== null && !Number.isInteger(orderId))
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid quantity and future booking dates",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [warehouses] = await connection.query(
      "SELECT * FROM warehouses WHERE id = ? AND status = 'active' FOR UPDATE",
      [warehouseId]
    );
    if (!warehouses.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Active warehouse not found",
      });
    }
    const warehouse = warehouses[0];
    if (days < Number(warehouse.minBookingDays)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Minimum booking period is ${warehouse.minBookingDays} days`,
      });
    }
    if (quantity > Number(warehouse.availableCapacity)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Only ${warehouse.availableCapacity} ${warehouse.capacityUnit} is currently available`,
      });
    }

    if (orderId !== null) {
      const ownerColumn =
        req.user.role === "farmer" ? "farmerId" : "distributorId";
      const [orders] = await connection.query(
        `SELECT id FROM orders WHERE id = ? AND ${ownerColumn} = ?`,
        [orderId, req.user.id]
      );
      if (!orders.length) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: "Linked order not found in your account",
        });
      }
    }

    const totalAmount =
      quantity * Number(warehouse.ratePerUnitDay) * Number(days);
    const [result] = await connection.query(
      `
      INSERT INTO warehouse_bookings
      (
        warehouseId, userId, orderId, quantity, capacityUnit, startDate,
        endDate, bookingDays, ratePerUnitDay, totalAmount, status, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?)
      `,
      [
        warehouseId,
        req.user.id,
        orderId,
        quantity,
        warehouse.capacityUnit,
        startDate,
        endDate,
        days,
        warehouse.ratePerUnitDay,
        totalAmount,
        notes,
      ]
    );
    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Warehouse booking request submitted",
      booking_id: result.insertId,
      estimated_total: totalAmount,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Create warehouse booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit warehouse booking",
    });
  } finally {
    if (connection) connection.release();
  }
};

export const getWarehouseBookings = async (req, res) => {
  try {
    const where = req.user.role === "admin" ? "" : "WHERE wb.userId = ?";
    const values = req.user.role === "admin" ? [] : [req.user.id];
    const [bookings] = await db.query(
      `
      SELECT
        wb.id,
        wb.warehouseId AS warehouse_id,
        wb.userId AS user_id,
        wb.orderId AS order_id,
        wb.quantity,
        wb.capacityUnit AS capacity_unit,
        wb.startDate AS start_date,
        wb.endDate AS end_date,
        wb.bookingDays AS booking_days,
        wb.ratePerUnitDay AS rate_per_unit_day,
        wb.totalAmount AS total_amount,
        wb.status,
        wb.notes,
        wb.created_at,
        w.name AS warehouse_name,
        w.city,
        w.state,
        u.fullName AS customer_name,
        u.role AS customer_role
      FROM warehouse_bookings wb
      INNER JOIN warehouses w ON wb.warehouseId = w.id
      INNER JOIN users u ON wb.userId = u.id
      ${where}
      ORDER BY wb.id DESC
      `,
      values
    );
    res.json({ success: true, bookings });
  } catch (error) {
    console.error("Get warehouse bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load warehouse bookings",
    });
  }
};

export const updateWarehouseBookingStatus = async (req, res) => {
  let connection;
  try {
    const requestedStatus = clean(req.body.status, 20).toLowerCase();
    const adminStatuses = new Set(["approved", "rejected", "completed"]);
    const userStatuses = new Set(["cancelled"]);
    const allowed =
      req.user.role === "admin"
        ? adminStatuses.has(requestedStatus)
        : userStatuses.has(requestedStatus);
    if (!allowed) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status action",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const params = [req.params.id];
    let ownerCheck = "";
    if (req.user.role !== "admin") {
      ownerCheck = "AND wb.userId = ?";
      params.push(req.user.id);
    }
    const [bookings] = await connection.query(
      `
      SELECT wb.*, w.availableCapacity, w.totalCapacity, w.name AS warehouseName
      FROM warehouse_bookings wb
      INNER JOIN warehouses w ON wb.warehouseId = w.id
      WHERE wb.id = ? ${ownerCheck}
      FOR UPDATE
      `,
      params
    );
    if (!bookings.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Warehouse booking not found",
      });
    }
    const booking = bookings[0];
    const transitions = {
      requested: ["approved", "rejected", "cancelled"],
      approved: ["completed", "cancelled"],
      rejected: [],
      cancelled: [],
      completed: [],
    };
    if (!transitions[booking.status]?.includes(requestedStatus)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Booking cannot change from ${booking.status} to ${requestedStatus}`,
      });
    }

    if (requestedStatus === "approved") {
      const remaining =
        Number(booking.availableCapacity) - Number(booking.quantity);
      if (remaining < 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "Warehouse capacity is no longer sufficient",
        });
      }
      await connection.query(
        "UPDATE warehouses SET availableCapacity = ? WHERE id = ?",
        [remaining, booking.warehouseId]
      );
    }
    if (
      booking.status === "approved" &&
      ["completed", "cancelled"].includes(requestedStatus)
    ) {
      const restored = Math.min(
        Number(booking.totalCapacity),
        Number(booking.availableCapacity) + Number(booking.quantity)
      );
      await connection.query(
        "UPDATE warehouses SET availableCapacity = ? WHERE id = ?",
        [restored, booking.warehouseId]
      );
    }

    await connection.query(
      `
      UPDATE warehouse_bookings
      SET status = ?, reviewedBy = COALESCE(?, reviewedBy),
        reviewedAt = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        requestedStatus,
        req.user.role === "admin" ? req.user.id : null,
        booking.id,
      ]
    );
    await createNotification(connection, {
      userId: booking.userId,
      type: "warehouse_booking_status",
      title: "Warehouse booking updated",
      message: `${booking.warehouseName} booking #${booking.id} is now ${requestedStatus}.`,
      relatedType: "warehouse",
      relatedId: booking.warehouseId,
    });

    await connection.commit();
    res.json({
      success: true,
      message: "Warehouse booking status updated successfully",
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Update warehouse booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update warehouse booking",
    });
  } finally {
    if (connection) connection.release();
  }
};
