import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const categories = new Set([
  "Vegetables",
  "Fruits",
  "Grains",
  "Pulses",
  "Spices",
  "Other",
]);
const units = new Set(["kg", "quintal", "ton", "box", "piece"]);
const grades = new Set(["Any", "A", "B", "C", "Standard"]);

const demandFields = `
  d.id,
  d.distributorId AS distributor_id,
  d.cropName AS crop_name,
  d.category,
  d.quantity,
  d.unit,
  d.targetPrice AS target_price,
  d.qualityGrade AS quality_grade,
  d.deliveryCity AS delivery_city,
  d.deliveryState AS delivery_state,
  CONCAT_WS(', ', NULLIF(d.deliveryCity, ''), NULLIF(d.deliveryState, ''))
    AS delivery_location,
  d.neededBy AS needed_by,
  d.description,
  d.status,
  d.awardedQuotationId AS awarded_quotation_id,
  d.created_at,
  d.updated_at,
  u.fullName AS distributor_name,
  u.businessName AS distributor_business,
  u.verificationStatus AS distributor_verification
`;

const parseDemand = (body, user) => ({
  cropName: String(body.crop_name || "").trim(),
  category: String(body.category || "").trim(),
  quantity: Number(body.quantity),
  unit: String(body.unit || "").trim(),
  targetPrice:
    body.target_price === "" || body.target_price === undefined
      ? null
      : Number(body.target_price),
  qualityGrade: String(body.quality_grade || "Any"),
  deliveryCity: String(body.delivery_city || user.city || "").trim(),
  deliveryState: String(body.delivery_state || user.state || "").trim(),
  neededBy: String(body.needed_by || "").trim(),
  description: String(body.description || "").trim().slice(0, 2000),
});

const validateDemand = (demand) => {
  if (demand.cropName.length < 2 || demand.cropName.length > 120) {
    return "Crop name must be 2 to 120 characters";
  }
  if (!categories.has(demand.category)) return "Please select a valid category";
  if (!units.has(demand.unit)) return "Please select a valid unit";
  if (!grades.has(demand.qualityGrade)) return "Please select a valid quality grade";
  if (!Number.isFinite(demand.quantity) || demand.quantity <= 0) {
    return "Required quantity must be greater than zero";
  }
  if (
    demand.targetPrice !== null &&
    (!Number.isFinite(demand.targetPrice) || demand.targetPrice <= 0)
  ) {
    return "Target price must be greater than zero";
  }
  if (!demand.deliveryCity || !demand.deliveryState) {
    return "Delivery city and state are required";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(demand.neededBy)) {
    return "Required-by date is required";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const neededDate = new Date(`${demand.neededBy}T00:00:00`);
  if (Number.isNaN(neededDate.getTime()) || neededDate < today) {
    return "Required-by date cannot be in the past";
  }
  return "";
};

export const createDemand = async (req, res) => {
  try {
    const demand = parseDemand(req.body, req.user);
    const validationError = validateDemand(demand);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const [result] = await db.query(
      `
      INSERT INTO demands
      (
        distributorId, cropName, category, quantity, unit, targetPrice,
        qualityGrade, deliveryCity, deliveryState, neededBy, description, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `,
      [
        req.user.id,
        demand.cropName,
        demand.category,
        demand.quantity,
        demand.unit,
        demand.targetPrice,
        demand.qualityGrade,
        demand.deliveryCity,
        demand.deliveryState,
        demand.neededBy,
        demand.description,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Purchase demand published successfully",
      demand_id: result.insertId,
    });
  } catch (error) {
    console.error("Create demand error:", error);
    res.status(500).json({ success: false, message: "Failed to publish demand" });
  }
};

export const getOpenDemands = async (req, res) => {
  try {
    const { search, category, city, state } = req.query;
    let query = `
      SELECT ${demandFields},
        (SELECT COUNT(*) FROM quotations q WHERE q.demandId = d.id) AS quote_count
      FROM demands d
      INNER JOIN users u ON d.distributorId = u.id
      WHERE d.status = 'open'
        AND d.neededBy >= CURRENT_DATE
        AND u.isActive = 1
        AND u.verificationStatus = 'verified'
    `;
    const values = [];

    if (search) {
      query += " AND d.cropName LIKE ?";
      values.push(`%${String(search).trim().slice(0, 80)}%`);
    }
    if (category) {
      query += " AND d.category = ?";
      values.push(String(category).trim());
    }
    if (city) {
      query += " AND d.deliveryCity LIKE ?";
      values.push(`%${String(city).trim().slice(0, 80)}%`);
    }
    if (state) {
      query += " AND d.deliveryState LIKE ?";
      values.push(`%${String(state).trim().slice(0, 80)}%`);
    }

    query += " ORDER BY d.neededBy ASC, d.id DESC";
    const [demands] = await db.query(query, values);
    res.json({ success: true, demands });
  } catch (error) {
    console.error("Get demand board error:", error);
    res.status(500).json({ success: false, message: "Failed to load demand board" });
  }
};

export const getMyDemands = async (req, res) => {
  try {
    const [demands] = await db.query(
      `
      SELECT ${demandFields},
        (SELECT COUNT(*) FROM quotations q WHERE q.demandId = d.id) AS quote_count
      FROM demands d
      INNER JOIN users u ON d.distributorId = u.id
      WHERE d.distributorId = ?
      ORDER BY d.id DESC
      `,
      [req.user.id]
    );
    res.json({ success: true, demands });
  } catch (error) {
    console.error("Get my demands error:", error);
    res.status(500).json({ success: false, message: "Failed to load your demands" });
  }
};

export const updateDemand = async (req, res) => {
  try {
    const [existing] = await db.query(
      "SELECT * FROM demands WHERE id = ? AND distributorId = ?",
      [req.params.id, req.user.id]
    );
    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Demand not found or you do not own it",
      });
    }
    if (existing[0].status !== "open") {
      return res.status(409).json({
        success: false,
        message: "Only open demands can be edited",
      });
    }

    const [[activeOffers]] = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM quotations
      WHERE demandId = ? AND status IN ('submitted', 'countered')
      `,
      [req.params.id]
    );
    if (Number(activeOffers.count) > 0) {
      return res.status(409).json({
        success: false,
        message:
          "A demand with active quotations cannot be edited. Complete the negotiation or close and recreate it.",
      });
    }

    const current = existing[0];
    const demand = parseDemand(
      {
        crop_name: req.body.crop_name ?? current.cropName,
        category: req.body.category ?? current.category,
        quantity: req.body.quantity ?? current.quantity,
        unit: req.body.unit ?? current.unit,
        target_price: req.body.target_price ?? current.targetPrice,
        quality_grade: req.body.quality_grade ?? current.qualityGrade,
        delivery_city: req.body.delivery_city ?? current.deliveryCity,
        delivery_state: req.body.delivery_state ?? current.deliveryState,
        needed_by:
          req.body.needed_by ?? String(current.neededBy).slice(0, 10),
        description: req.body.description ?? current.description,
      },
      req.user
    );
    const validationError = validateDemand(demand);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    await db.query(
      `
      UPDATE demands
      SET cropName = ?, category = ?, quantity = ?, unit = ?, targetPrice = ?,
        qualityGrade = ?, deliveryCity = ?, deliveryState = ?, neededBy = ?,
        description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND distributorId = ?
      `,
      [
        demand.cropName,
        demand.category,
        demand.quantity,
        demand.unit,
        demand.targetPrice,
        demand.qualityGrade,
        demand.deliveryCity,
        demand.deliveryState,
        demand.neededBy,
        demand.description,
        req.params.id,
        req.user.id,
      ]
    );
    res.json({ success: true, message: "Demand updated successfully" });
  } catch (error) {
    console.error("Update demand error:", error);
    res.status(500).json({ success: false, message: "Failed to update demand" });
  }
};

export const closeDemand = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [demands] = await connection.query(
      "SELECT * FROM demands WHERE id = ? AND distributorId = ? FOR UPDATE",
      [req.params.id, req.user.id]
    );
    if (!demands.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Demand not found or you do not own it",
      });
    }
    if (demands[0].status !== "open") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Only open demands can be closed",
      });
    }

    const [activeQuotes] = await connection.query(
      `
      SELECT id, farmerId, quantity, unitPrice
      FROM quotations
      WHERE demandId = ? AND status IN ('submitted', 'countered')
      `,
      [req.params.id]
    );
    await connection.query(
      "UPDATE demands SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.params.id]
    );
    await connection.query(
      `
      UPDATE quotations
      SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
      WHERE demandId = ? AND status IN ('submitted', 'countered')
      `,
      [req.params.id]
    );

    for (const quote of activeQuotes) {
      await connection.query(
        `
        INSERT INTO quotation_history
          (quotationId, actorId, action, quantity, unitPrice, message)
        VALUES (?, ?, 'rejected', ?, ?, ?)
        `,
        [
          quote.id,
          req.user.id,
          quote.quantity,
          quote.unitPrice,
          "Purchase demand closed by distributor",
        ]
      );
      await createNotification(connection, {
        userId: quote.farmerId,
        type: "demand_closed",
        title: "Purchase demand closed",
        message: `${demands[0].cropName} demand was closed by the distributor.`,
        relatedType: "demand",
        relatedId: Number(req.params.id),
      });
    }

    await connection.commit();
    res.json({ success: true, message: "Demand closed successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Close demand error:", error);
    res.status(500).json({ success: false, message: "Failed to close demand" });
  } finally {
    if (connection) connection.release();
  }
};
