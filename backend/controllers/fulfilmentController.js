import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const shipmentTransitions = {
  booked: ["picked_up", "cancelled"],
  picked_up: ["in_transit", "failed"],
  in_transit: ["out_for_delivery", "failed"],
  out_for_delivery: ["delivered", "failed"],
  failed: ["in_transit", "cancelled"],
  delivered: [],
  cancelled: [],
};
const validDate = (value) => {
  if (!value) return true;
  const normalized = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  const date = new Date(`${normalized}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === normalized
  );
};

export const getShipments = async (req, res) => {
  try {
    const values = [];
    let scope = "";
    if (req.user.role === "farmer") {
      scope = "WHERE s.farmerId = ?";
      values.push(req.user.id);
    } else if (req.user.role === "distributor") {
      scope = "WHERE s.distributorId = ?";
      values.push(req.user.id);
    }
    const [shipments] = await db.query(
      `
      SELECT
        s.id,
        s.orderId AS order_id,
        s.farmerId AS farmer_id,
        s.distributorId AS distributor_id,
        s.carrierName AS carrier_name,
        s.trackingNumber AS tracking_number,
        s.pickupAddress AS pickup_address,
        s.deliveryAddress AS delivery_address,
        s.currentLocation AS current_location,
        s.estimatedDelivery AS estimated_delivery,
        s.status,
        s.created_at,
        p.productName AS crop_name,
        o.quantity,
        p.unit,
        f.fullName AS farmer_name,
        d.fullName AS distributor_name
      FROM shipments s
      INNER JOIN orders o ON o.id = s.orderId
      INNER JOIN products p ON p.id = o.productId
      INNER JOIN users f ON f.id = s.farmerId
      INNER JOIN users d ON d.id = s.distributorId
      ${scope}
      ORDER BY s.id DESC
      `,
      values
    );
    if (shipments.length) {
      const ids = shipments.map((item) => item.id);
      const [events] = await db.query(
        `
        SELECT
          id,
          shipmentId AS shipment_id,
          status,
          location,
          note,
          created_at
        FROM shipment_events
        WHERE shipmentId IN (?)
        ORDER BY id DESC
        `,
        [ids]
      );
      const grouped = events.reduce((result, event) => {
        (result[event.shipment_id] ||= []).push(event);
        return result;
      }, {});
      for (const shipment of shipments) {
        shipment.events = grouped[shipment.id] || [];
      }
    }
    res.json({ success: true, shipments });
  } catch (error) {
    console.error("Get shipments error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch shipments" });
  }
};

export const createShipment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const orderId = Number(req.params.orderId);
    const carrier = String(req.body.carrier_name || "").trim();
    const tracking = String(req.body.tracking_number || "").trim();
    const pickup = String(req.body.pickup_address || "").trim();
    const delivery = String(req.body.delivery_address || "").trim();
    const eta = String(req.body.estimated_delivery || "");
    if (
      carrier.length < 2 ||
      tracking.length < 3 ||
      pickup.length < 5 ||
      delivery.length < 5 ||
      !validDate(eta)
    ) {
      return res.status(400).json({
        success: false,
        message: "Carrier, unique tracking number, addresses and valid ETA are required",
      });
    }
    await connection.beginTransaction();
    const [orders] = await connection.query(
      `
      SELECT o.*, p.productName
      FROM orders o
      INNER JOIN products p ON p.id = o.productId
      WHERE o.id = ?
      FOR UPDATE
      `,
      [orderId]
    );
    if (
      !orders.length ||
      (req.user.role !== "admin" &&
        Number(orders[0].farmerId) !== Number(req.user.id))
    ) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Seller order not found" });
    }
    const order = orders[0];
    if (!["accepted", "completed"].includes(order.status)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Shipment can be created after order acceptance",
      });
    }
    const [result] = await connection.query(
      `
      INSERT INTO shipments
      (
        orderId, farmerId, distributorId, carrierName, trackingNumber,
        pickupAddress, deliveryAddress, currentLocation,
        estimatedDelivery, createdBy
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        order.id,
        order.farmerId,
        order.distributorId,
        carrier.slice(0, 120),
        tracking.slice(0, 120),
        pickup.slice(0, 500),
        delivery.slice(0, 500),
        pickup.slice(0, 200),
        eta || null,
        req.user.id,
      ]
    );
    await connection.query(
      `
      INSERT INTO shipment_events
        (shipmentId, status, location, note, createdBy)
      VALUES (?, 'booked', ?, ?, ?)
      `,
      [result.insertId, pickup.slice(0, 200), "Shipment booked", req.user.id]
    );
    await createNotification(connection, {
      userId: order.distributorId,
      type: "shipment",
      title: "Shipment booked",
      message: `${order.productName} shipment ${tracking} has been booked.`,
      relatedType: "shipment",
      relatedId: result.insertId,
    });
    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Shipment created",
      shipment_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create shipment error:", error);
    const duplicate = error?.code === "ER_DUP_ENTRY";
    res.status(duplicate ? 409 : 500).json({
      success: false,
      message: duplicate
        ? "This order or tracking number already has a shipment"
        : "Failed to create shipment",
    });
  } finally {
    connection.release();
  }
};

export const updateShipment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const next = String(req.body.status || "");
    const location = String(req.body.location || "").trim();
    const note = String(req.body.note || "").trim();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM shipments WHERE id = ? FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Shipment not found" });
    }
    const shipment = rows[0];
    if (
      req.user.role !== "admin" &&
      Number(shipment.farmerId) !== Number(req.user.id)
    ) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: "Shipment update denied" });
    }
    if (!(shipmentTransitions[shipment.status] || []).includes(next)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Shipment cannot change from ${shipment.status} to ${next}`,
      });
    }
    await connection.query(
      `
      UPDATE shipments
      SET status = ?, currentLocation = COALESCE(NULLIF(?, ''), currentLocation)
      WHERE id = ?
      `,
      [next, location.slice(0, 200), shipment.id]
    );
    await connection.query(
      `
      INSERT INTO shipment_events
        (shipmentId, status, location, note, createdBy)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        shipment.id,
        next,
        location.slice(0, 200) || null,
        note.slice(0, 500) || `Shipment ${next.replaceAll("_", " ")}`,
        req.user.id,
      ]
    );
    await createNotification(connection, {
      userId: shipment.distributorId,
      type: "shipment",
      title: "Shipment status updated",
      message: `Tracking ${shipment.trackingNumber} is now ${next.replaceAll("_", " ")}.`,
      relatedType: "shipment",
      relatedId: shipment.id,
    });
    await connection.commit();
    res.json({ success: true, message: `Shipment ${next.replaceAll("_", " ")}` });
  } catch (error) {
    await connection.rollback();
    console.error("Update shipment error:", error);
    res.status(500).json({ success: false, message: "Failed to update shipment" });
  } finally {
    connection.release();
  }
};

export const getInspections = async (req, res) => {
  try {
    const values = [];
    let scope = "";
    if (req.user.role === "farmer") {
      scope = "WHERE qi.farmerId = ?";
      values.push(req.user.id);
    } else if (req.user.role === "distributor") {
      scope = "WHERE qi.distributorId = ?";
      values.push(req.user.id);
    }
    const [inspections] = await db.query(
      `
      SELECT
        qi.id,
        qi.orderId AS order_id,
        qi.requestedBy AS requested_by,
        qi.farmerId AS farmer_id,
        qi.distributorId AS distributor_id,
        qi.inspectorName AS inspector_name,
        qi.scheduledDate AS scheduled_date,
        qi.status,
        qi.qualityGrade AS quality_grade,
        qi.moisturePercent AS moisture_percent,
        qi.reportNote AS report_note,
        qi.created_at,
        p.productName AS crop_name,
        o.quantity,
        p.unit,
        f.fullName AS farmer_name,
        d.fullName AS distributor_name
      FROM quality_inspections qi
      INNER JOIN orders o ON o.id = qi.orderId
      INNER JOIN products p ON p.id = o.productId
      INNER JOIN users f ON f.id = qi.farmerId
      INNER JOIN users d ON d.id = qi.distributorId
      ${scope}
      ORDER BY qi.id DESC
      `,
      values
    );
    res.json({ success: true, inspections });
  } catch (error) {
    console.error("Get inspections error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inspections" });
  }
};

export const requestInspection = async (req, res) => {
  try {
    const [orders] = await db.query(
      `
      SELECT o.*, p.productName
      FROM orders o
      INNER JOIN products p ON p.id = o.productId
      WHERE o.id = ?
      `,
      [req.params.orderId]
    );
    if (!orders.length) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const order = orders[0];
    const participant =
      Number(order.farmerId) === Number(req.user.id) ||
      Number(order.distributorId) === Number(req.user.id);
    if (!participant || ["rejected"].includes(order.status)) {
      return res.status(403).json({ success: false, message: "Inspection request denied" });
    }
    const [result] = await db.query(
      `
      INSERT INTO quality_inspections
        (orderId, requestedBy, farmerId, distributorId, reportNote)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        order.id,
        req.user.id,
        order.farmerId,
        order.distributorId,
        String(req.body.note || "").trim().slice(0, 2000) || null,
      ]
    );
    const [admins] = await db.query(
      "SELECT id FROM users WHERE role = 'admin' AND isActive = 1"
    );
    for (const admin of admins) {
      await createNotification(db, {
        userId: admin.id,
        type: "inspection",
        title: "Quality inspection requested",
        message: `${order.productName} inspection requested for order #${order.id}.`,
        relatedType: "inspection",
        relatedId: result.insertId,
      });
    }
    res.status(201).json({
      success: true,
      message: "Quality inspection requested",
      inspection_id: result.insertId,
    });
  } catch (error) {
    console.error("Request inspection error:", error);
    res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      success: false,
      message:
        error?.code === "ER_DUP_ENTRY"
          ? "This order already has an inspection"
          : "Failed to request inspection",
    });
  }
};

export const updateInspection = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM quality_inspections WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Inspection not found" });
    }
    const inspection = rows[0];
    const next = String(req.body.status || "");
    if (req.user.role !== "admin") {
      if (
        Number(inspection.requestedBy) !== Number(req.user.id) ||
        inspection.status !== "requested" ||
        next !== "cancelled"
      ) {
        return res.status(403).json({ success: false, message: "Inspection update denied" });
      }
    } else {
      const transitions = {
        requested: ["scheduled", "passed", "failed", "cancelled"],
        scheduled: ["passed", "failed", "cancelled"],
      };
      if (!(transitions[inspection.status] || []).includes(next)) {
        return res.status(409).json({ success: false, message: "Invalid inspection transition" });
      }
    }
    const moisture =
      req.body.moisture_percent === "" || req.body.moisture_percent === undefined
        ? null
        : Number(req.body.moisture_percent);
    const qualityGrade = String(req.body.quality_grade || "");
    const scheduledDate = String(req.body.scheduled_date || "");
    if (
      moisture !== null &&
      (!Number.isFinite(moisture) || moisture < 0 || moisture > 100)
    ) {
      return res.status(400).json({ success: false, message: "Moisture must be 0 to 100" });
    }
    if (
      qualityGrade &&
      !["A", "B", "C", "Standard", "Rejected"].includes(qualityGrade)
    ) {
      return res.status(400).json({ success: false, message: "Invalid quality grade" });
    }
    if (!validDate(scheduledDate)) {
      return res.status(400).json({ success: false, message: "Invalid schedule date" });
    }
    await db.query(
      `
      UPDATE quality_inspections
      SET status = ?,
          inspectorName = COALESCE(NULLIF(?, ''), inspectorName),
          scheduledDate = COALESCE(?, scheduledDate),
          qualityGrade = COALESCE(?, qualityGrade),
          moisturePercent = COALESCE(?, moisturePercent),
          reportNote = COALESCE(NULLIF(?, ''), reportNote),
          reviewedBy = CASE WHEN ? THEN ? ELSE reviewedBy END,
          reviewedAt = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        next,
        String(req.body.inspector_name || "").trim().slice(0, 120),
        scheduledDate || null,
        qualityGrade || null,
        moisture,
        String(req.body.report_note || "").trim().slice(0, 2000),
        req.user.role === "admin",
        req.user.id,
        inspection.id,
      ]
    );
    for (const userId of [inspection.farmerId, inspection.distributorId]) {
      await createNotification(db, {
        userId,
        type: "inspection",
        title: "Quality inspection updated",
        message: `Inspection #${inspection.id} is now ${next}.`,
        relatedType: "inspection",
        relatedId: inspection.id,
      });
    }
    res.json({ success: true, message: `Inspection ${next}` });
  } catch (error) {
    console.error("Update inspection error:", error);
    res.status(500).json({ success: false, message: "Failed to update inspection" });
  }
};
