import { db } from "../config/db.js";

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const sendCsv = (res, filename, columns, rows) => {
  const header = columns.map((column) => csvCell(column.label)).join(",");
  const body = rows
    .map((row) => columns.map((column) => csvCell(row[column.key])).join(","))
    .join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );
  res.send(`\uFEFF${header}\n${body}`);
};

export const getAnalyticsOverview = async (req, res) => {
  try {
    let metrics = {};
    let monthlyWhere = "";
    const monthlyValues = [];

    if (req.user.role === "farmer") {
      const [[summary]] = await db.query(
        `
        SELECT
          (SELECT COUNT(*) FROM products WHERE farmerId = ?) AS products,
          (
            SELECT COALESCE(SUM(quantity * price), 0)
            FROM products WHERE farmerId = ? AND status = 'available'
          ) AS inventory_value,
          (SELECT COUNT(*) FROM orders WHERE farmerId = ?) AS orders,
          (
            (
  SELECT COALESCE(
    SUM(o.quantity * COALESCE(o.agreedPrice, p.price)),
    0
  )
  FROM orders o
  INNER JOIN products p ON o.productId = p.id
  WHERE o.farmerId = ? AND o.status = 'completed'
) AS completed_revenue,
          (SELECT COUNT(*) FROM quotations WHERE farmerId = ?) AS quotations,
          (
            SELECT COUNT(*) FROM quotations
            WHERE farmerId = ? AND status = 'accepted'
          ) AS accepted_quotations,
          (
            SELECT COUNT(*) FROM procurement_contracts
            WHERE farmerId = ? AND status = 'active'
          ) AS active_contracts,
          (
            SELECT COUNT(*) FROM fpo_members
            WHERE userId = ? AND status = 'active'
          ) AS fpo_memberships
        `,
        Array(8).fill(req.user.id)
      );
      metrics = summary;
      monthlyWhere = "WHERE o.farmerId = ?";
      monthlyValues.push(req.user.id);
    } else if (req.user.role === "distributor") {
      const [[summary]] = await db.query(
        `
        SELECT
          (SELECT COUNT(*) FROM demands WHERE distributorId = ?) AS demands,
          (
            SELECT COUNT(*) FROM demands
            WHERE distributorId = ? AND status = 'open'
          ) AS open_demands,
          (SELECT COUNT(*) FROM orders WHERE distributorId = ?) AS orders,
          (
    SELECT COALESCE(
        SUM(
            o.quantity * COALESCE(o.agreedPrice, p.price)
        ),
        0
    )
    FROM orders o
    INNER JOIN products p
        ON o.productId = p.id
    WHERE o.status = 'completed'
) AS completed_gmv,
          (
            SELECT COUNT(*) FROM quotations
            WHERE distributorId = ? AND status IN ('submitted', 'countered')
          ) AS active_negotiations,
          (
            SELECT COUNT(*) FROM procurement_contracts
            WHERE distributorId = ? AND status = 'active'
          ) AS active_contracts,
          (
            SELECT COUNT(*) FROM warehouse_bookings
            WHERE userId = ? AND status IN ('requested', 'approved')
          ) AS warehouse_bookings
        `,
        Array(7).fill(req.user.id)
      );
      metrics = summary;
      monthlyWhere = "WHERE o.distributorId = ?";
      monthlyValues.push(req.user.id);
    } else {
      const [[summary]] = await db.query(
        `
        SELECT
          (SELECT COUNT(*) FROM users WHERE isActive = 1) AS active_users,
          (SELECT COUNT(*) FROM fpos WHERE status = 'active') AS active_fpos,
          (SELECT COUNT(*) FROM demands WHERE status = 'open') AS open_demands,
          (
            SELECT COUNT(*) FROM procurement_contracts WHERE status = 'active'
          ) AS active_contracts,
          (SELECT COUNT(*) FROM orders) AS orders,
          (
            SELECT COALESCE(SUM(
              quantity * COALESCE(agreedPrice, p.price)
            ), 0)
            FROM orders o
            INNER JOIN products p ON o.productId = p.id
            WHERE o.status = 'completed'
          ) AS completed_gmv,
          (
            SELECT COUNT(*) FROM warehouse_bookings
            WHERE status = 'requested'
          ) AS pending_warehouse_bookings,
          (
            SELECT COALESCE(
              ROUND(
                100 * SUM(totalCapacity - availableCapacity) /
                NULLIF(SUM(totalCapacity), 0),
                1
              ),
              0
            )
            FROM warehouses WHERE status = 'active'
          ) AS warehouse_utilization
        `
      );
      metrics = summary;
    }

    const [monthly] = await db.query(
      `
      SELECT
        DATE_FORMAT(o.created_at, '%Y-%m') AS month,
        COUNT(*) AS order_count,
        COALESCE(SUM(
          CASE WHEN o.status = 'completed'
            THEN o.quantity * COALESCE(o.agreedPrice, p.price)
            ELSE 0
          END
        ), 0) AS completed_value
      FROM orders o
      INNER JOIN products p ON o.productId = p.id
      ${monthlyWhere}
        ${monthlyWhere ? "AND" : "WHERE"} o.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
      ORDER BY month ASC
      `,
      monthlyValues
    );

    const [categoryBreakdown] = await db.query(
      `
      SELECT
        p.category,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(
          CASE WHEN o.status = 'completed'
            THEN o.quantity * COALESCE(o.agreedPrice, p.price)
            ELSE 0
          END
        ), 0) AS completed_value
      FROM products p
      LEFT JOIN orders o ON o.productId = p.id
      ${
        req.user.role === "farmer"
          ? "WHERE p.farmerId = ?"
          : req.user.role === "distributor"
            ? "WHERE o.distributorId = ?"
            : ""
      }
      GROUP BY p.category
      ORDER BY completed_value DESC, order_count DESC
      LIMIT 8
      `,
      req.user.role === "admin" ? [] : [req.user.id]
    );

    res.json({
      success: true,
      role: req.user.role,
      metrics,
      monthly,
      category_breakdown: categoryBreakdown,
    });
  } catch (error) {
    console.error("Analytics overview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load business analytics",
    });
  }
};

export const exportAnalyticsCsv = async (req, res) => {
  try {
    const type = String(req.query.type || "orders").toLowerCase();

    if (type === "orders") {
      const values = [];
      let where = "";
      if (req.user.role === "farmer") {
        where = "WHERE o.farmerId = ?";
        values.push(req.user.id);
      } else if (req.user.role === "distributor") {
        where = "WHERE o.distributorId = ?";
        values.push(req.user.id);
      }
      const [rows] = await db.query(
        `
        SELECT
          o.id,
          p.productName AS crop,
          o.quantity,
          p.unit,
          COALESCE(o.agreedPrice, p.price) AS unit_price,
          o.quantity * COALESCE(o.agreedPrice, p.price) AS total,
          o.status,
          CASE
            WHEN o.contractId IS NOT NULL THEN 'contract'
            WHEN o.quotationId IS NOT NULL THEN 'demand'
            ELSE 'direct'
          END AS source,
          f.fullName AS farmer,
          d.fullName AS distributor,
          o.created_at
        FROM orders o
        INNER JOIN products p ON o.productId = p.id
        INNER JOIN users f ON o.farmerId = f.id
        INNER JOIN users d ON o.distributorId = d.id
        ${where}
        ORDER BY o.id DESC
        `,
        values
      );
      return sendCsv(
        res,
        "agroconnect-orders.csv",
        [
          { key: "id", label: "Order ID" },
          { key: "crop", label: "Crop" },
          { key: "quantity", label: "Quantity" },
          { key: "unit", label: "Unit" },
          { key: "unit_price", label: "Unit Price" },
          { key: "total", label: "Total" },
          { key: "status", label: "Status" },
          { key: "source", label: "Source" },
          { key: "farmer", label: "Farmer" },
          { key: "distributor", label: "Distributor" },
          { key: "created_at", label: "Created At" },
        ],
        rows
      );
    }

    if (type === "contracts") {
      const values = [];
      let where = "";
      if (req.user.role === "farmer") {
        where = "WHERE c.farmerId = ?";
        values.push(req.user.id);
      } else if (req.user.role === "distributor") {
        where = "WHERE c.distributorId = ?";
        values.push(req.user.id);
      }
      const [rows] = await db.query(
        `
        SELECT
          c.id,
          c.institutionName AS institution,
          c.cropName AS crop,
          c.quantity,
          c.unit,
          c.unitPrice AS unit_price,
          c.deliveryFrequency AS frequency,
          c.startDate AS start_date,
          c.endDate AS end_date,
          c.nextDeliveryDate AS next_delivery,
          c.deliveriesCompleted AS deliveries_completed,
          c.status,
          f.fullName AS farmer,
          d.fullName AS distributor
        FROM procurement_contracts c
        INNER JOIN users f ON c.farmerId = f.id
        INNER JOIN users d ON c.distributorId = d.id
        ${where}
        ORDER BY c.id DESC
        `,
        values
      );
      return sendCsv(
        res,
        "agroconnect-contracts.csv",
        [
          { key: "id", label: "Contract ID" },
          { key: "institution", label: "Institution" },
          { key: "crop", label: "Crop" },
          { key: "quantity", label: "Quantity" },
          { key: "unit", label: "Unit" },
          { key: "unit_price", label: "Unit Price" },
          { key: "frequency", label: "Frequency" },
          { key: "start_date", label: "Start Date" },
          { key: "end_date", label: "End Date" },
          { key: "next_delivery", label: "Next Delivery" },
          { key: "deliveries_completed", label: "Deliveries Completed" },
          { key: "status", label: "Status" },
          { key: "farmer", label: "Farmer" },
          { key: "distributor", label: "Distributor" },
        ],
        rows
      );
    }

    if (type === "warehouse") {
      const values = [];
      const where =
        req.user.role === "admin" ? "" : "WHERE wb.userId = ?";
      if (req.user.role !== "admin") values.push(req.user.id);
      const [rows] = await db.query(
        `
        SELECT
          wb.id,
          w.name AS warehouse,
          u.fullName AS customer,
          wb.quantity,
          wb.capacityUnit AS unit,
          wb.startDate AS start_date,
          wb.endDate AS end_date,
          wb.bookingDays AS days,
          wb.ratePerUnitDay AS rate,
          wb.totalAmount AS total,
          wb.status,
          wb.created_at
        FROM warehouse_bookings wb
        INNER JOIN warehouses w ON wb.warehouseId = w.id
        INNER JOIN users u ON wb.userId = u.id
        ${where}
        ORDER BY wb.id DESC
        `,
        values
      );
      return sendCsv(
        res,
        "agroconnect-warehouse-bookings.csv",
        [
          { key: "id", label: "Booking ID" },
          { key: "warehouse", label: "Warehouse" },
          { key: "customer", label: "Customer" },
          { key: "quantity", label: "Quantity" },
          { key: "unit", label: "Unit" },
          { key: "start_date", label: "Start Date" },
          { key: "end_date", label: "End Date" },
          { key: "days", label: "Days" },
          { key: "rate", label: "Rate" },
          { key: "total", label: "Total" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Created At" },
        ],
        rows
      );
    }

    return res.status(400).json({
      success: false,
      message: "Export type must be orders, contracts or warehouse",
    });
  } catch (error) {
    console.error("Analytics export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export analytics",
    });
  }
};
