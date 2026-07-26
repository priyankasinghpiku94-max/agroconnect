import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const dateOnly = (value) =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value || "").slice(0, 10);

const nextScheduleDate = (dateValue, frequency) => {
  const date = new Date(`${dateOnly(dateValue)}T00:00:00Z`);
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (frequency === "biweekly") date.setUTCDate(date.getUTCDate() + 14);
  if (frequency === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
};

export const getContracts = async (req, res) => {
  try {
    let where = "";
    const values = [];
    if (req.user.role === "farmer") {
      where = "WHERE c.farmerId = ?";
      values.push(req.user.id);
    } else if (req.user.role === "distributor") {
      where = "WHERE c.distributorId = ?";
      values.push(req.user.id);
    }

    const [contracts] = await db.query(
      `
      SELECT
        c.id,
        c.demandId AS demand_id,
        c.sourceOrderId AS source_order_id,
        c.productId AS product_id,
        c.farmerId AS farmer_id,
        c.distributorId AS distributor_id,
        c.institutionName AS institution_name,
        c.cropName AS crop_name,
        c.quantity,
        c.unit,
        c.unitPrice AS unit_price,
        c.deliveryFrequency AS delivery_frequency,
        c.startDate AS start_date,
        c.endDate AS end_date,
        c.nextDeliveryDate AS next_delivery_date,
        c.status,
        c.deliveriesCompleted AS deliveries_completed,
        c.created_at,
        f.fullName AS farmer_name,
        f.businessName AS farmer_business,
        d.fullName AS distributor_name,
        d.businessName AS distributor_business,
        (
          SELECT COUNT(*) FROM orders o
          WHERE o.contractId = c.id
        ) AS generated_orders
      FROM procurement_contracts c
      INNER JOIN users f ON c.farmerId = f.id
      INNER JOIN users d ON c.distributorId = d.id
      ${where}
      ORDER BY c.id DESC
      `,
      values
    );
    res.json({ success: true, contracts });
  } catch (error) {
    console.error("Get contracts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load procurement contracts",
    });
  }
};

export const generateContractOrder = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [contracts] = await connection.query(
      `
      SELECT c.*, p.quantity AS productStock, p.status AS productStatus,
        (
          SELECT COALESCE(SUM(o.quantity), 0)
          FROM orders o
          WHERE o.productId = p.id AND o.status IN ('pending', 'accepted')
        ) AS reservedStock
      FROM procurement_contracts c
      INNER JOIN products p ON c.productId = p.id
      WHERE c.id = ? AND c.distributorId = ?
      FOR UPDATE
      `,
      [req.params.id, req.user.id]
    );
    if (!contracts.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Procurement contract not found",
      });
    }

    const contract = contracts[0];
    if (contract.status !== "active" || !contract.nextDeliveryDate) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "This procurement contract is not active",
      });
    }
    const scheduleDate = new Date(`${dateOnly(contract.nextDeliveryDate)}T00:00:00`);
    const generationLimit = new Date();
    generationLimit.setHours(0, 0, 0, 0);
    generationLimit.setDate(generationLimit.getDate() + 30);
    if (scheduleDate > generationLimit) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "The next scheduled order can be generated only within 30 days",
      });
    }
    if (
      contract.productStatus !== "available" ||
      Number(contract.productStock) - Number(contract.reservedStock || 0) <
        Number(contract.quantity)
    ) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Farmer stock is currently insufficient for this scheduled order",
      });
    }

    const [orderResult] = await connection.query(
      `
      INSERT INTO orders
      (
        productId, farmerId, distributorId, quantity, message, status,
        agreedPrice, contractId
      )
      VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?)
      `,
      [
        contract.productId,
        contract.farmerId,
        contract.distributorId,
        contract.quantity,
        `Scheduled ${contract.deliveryFrequency} procurement for ${dateOnly(
          contract.nextDeliveryDate
        )}`,
        contract.unitPrice,
        contract.id,
      ]
    );

    const nextDate = nextScheduleDate(
      contract.nextDeliveryDate,
      contract.deliveryFrequency
    );
    const isFinished = nextDate > dateOnly(contract.endDate);
    await connection.query(
      `
      UPDATE procurement_contracts
      SET nextDeliveryDate = ?,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [isFinished ? null : nextDate, contract.id]
    );
    await createNotification(connection, {
      userId: contract.farmerId,
      type: "contract_order_generated",
      title: "Recurring procurement order",
      message: `Scheduled order #${orderResult.insertId} was generated for ${contract.cropName}.`,
      relatedType: "order",
      relatedId: orderResult.insertId,
    });

    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Scheduled order generated successfully",
      order_id: orderResult.insertId,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Generate contract order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate scheduled order",
    });
  } finally {
    if (connection) connection.release();
  }
};

export const updateContractStatus = async (req, res) => {
  try {
    const status = String(req.body.status || "").trim().toLowerCase();
    if (!["active", "paused", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Contract status must be active, paused or cancelled",
      });
    }

    const values = [req.params.id];
    let ownerCheck = "";
    if (req.user.role !== "admin") {
      ownerCheck = "AND distributorId = ?";
      values.push(req.user.id);
    }
    const [contracts] = await db.query(
      `SELECT * FROM procurement_contracts WHERE id = ? ${ownerCheck}`,
      values
    );
    if (!contracts.length) {
      return res.status(404).json({
        success: false,
        message: "Procurement contract not found",
      });
    }
    if (["completed", "cancelled"].includes(contracts[0].status)) {
      return res.status(409).json({
        success: false,
        message: `A ${contracts[0].status} contract cannot be changed`,
      });
    }

    await db.query(
      `
      UPDATE procurement_contracts
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [status, req.params.id]
    );
    await createNotification(db, {
      userId: contracts[0].farmerId,
      type: "contract_status",
      title: "Procurement contract updated",
      message: `Contract #${contracts[0].id} is now ${status}.`,
      relatedType: "contract",
      relatedId: contracts[0].id,
    });
    res.json({ success: true, message: "Contract status updated successfully" });
  } catch (error) {
    console.error("Update contract status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update procurement contract",
    });
  }
};
