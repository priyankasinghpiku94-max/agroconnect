import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const paymentMethods = new Set([
  "upi",
  "bank_transfer",
  "cash",
  "cheque",
  "other",
]);

const orderQuery = `
  SELECT
    o.id,
    o.farmerId,
    o.distributorId,
    o.quantity,
    o.status,
    p.productName,
    p.unit,
    COALESCE(o.agreedPrice, p.price) AS unitPrice,
    f.fullName AS farmerName,
    f.businessName AS farmerBusiness,
    f.address AS farmerAddress,
    d.fullName AS distributorName,
    d.businessName AS distributorBusiness,
    d.address AS distributorAddress
  FROM orders o
  INNER JOIN products p ON p.id = o.productId
  INNER JOIN users f ON f.id = o.farmerId
  INNER JOIN users d ON d.id = o.distributorId
  WHERE o.id = ?
`;

const orderParticipant = (order, user) =>
  user.role === "admin" ||
  Number(order.farmerId) === Number(user.id) ||
  Number(order.distributorId) === Number(user.id);

const activeCommission = async (database, distributorId) => {
  const [plans] = await database.query(
    `
    SELECT sp.commissionPercent
    FROM user_subscriptions us
    INNER JOIN subscription_plans sp ON sp.code = us.planCode
    WHERE us.distributorId = ?
      AND us.status = 'active'
      AND us.startsAt <= CURRENT_DATE
      AND us.endsAt >= CURRENT_DATE
    ORDER BY sp.commissionPercent ASC, us.id DESC
    LIMIT 1
    `,
    [distributorId]
  );
  if (plans.length) return Number(plans[0].commissionPercent);
  const [starter] = await database.query(
    "SELECT commissionPercent FROM subscription_plans WHERE code = 'starter'"
  );
  return Number(starter[0]?.commissionPercent || 2.5);
};

const ensureInvoice = async (database, order) => {
  const [existing] = await database.query(
    "SELECT * FROM invoices WHERE orderId = ?",
    [order.id]
  );
  if (existing.length) return existing[0];
  if (!["accepted", "completed"].includes(order.status)) {
    const error = new Error("Invoice is available after the farmer accepts the order");
    error.statusCode = 409;
    throw error;
  }
  const subtotal = Number(order.quantity) * Number(order.unitPrice);
  const feePercent = await activeCommission(database, order.distributorId);
  const platformFee = Number(((subtotal * feePercent) / 100).toFixed(2));
  const invoiceNumber = `AGC-${new Date().getFullYear()}-${String(order.id).padStart(7, "0")}`;
  const [result] = await database.query(
    `
    INSERT INTO invoices
    (
      invoiceNumber, orderId, sellerId, buyerId, subtotal,
      platformFeePercent, platformFee, totalAmount, sellerNetAmount
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      invoiceNumber,
      order.id,
      order.farmerId,
      order.distributorId,
      subtotal,
      feePercent,
      platformFee,
      subtotal,
      subtotal - platformFee,
    ]
  );
  const [created] = await database.query("SELECT * FROM invoices WHERE id = ?", [
    result.insertId,
  ]);
  return created[0];
};

const invoiceSelect = `
  SELECT
    i.id,
    i.invoiceNumber AS invoice_number,
    i.orderId AS order_id,
    i.sellerId AS seller_id,
    i.buyerId AS buyer_id,
    i.subtotal,
    i.platformFeePercent AS platform_fee_percent,
    i.platformFee AS platform_fee,
    i.taxAmount AS tax_amount,
    i.totalAmount AS total_amount,
    i.sellerNetAmount AS seller_net_amount,
    i.status,
    i.issuedAt AS issued_at,
    i.paidAt AS paid_at,
    p.productName AS crop_name,
    p.unit,
    o.quantity,
    COALESCE(o.agreedPrice, p.price) AS unit_price,
    f.fullName AS seller_name,
    f.businessName AS seller_business,
    f.address AS seller_address,
    d.fullName AS buyer_name,
    d.businessName AS buyer_business,
    d.address AS buyer_address,
    COALESCE((
      SELECT SUM(pr.amount)
      FROM payment_records pr
      WHERE pr.invoiceId = i.id AND pr.status = 'verified'
    ), 0) AS paid_amount
  FROM invoices i
  INNER JOIN orders o ON o.id = i.orderId
  INNER JOIN products p ON p.id = o.productId
  INNER JOIN users f ON f.id = i.sellerId
  INNER JOIN users d ON d.id = i.buyerId
`;

export const createInvoice = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query(`${orderQuery} FOR UPDATE`, [
      req.params.orderId,
    ]);
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (!orderParticipant(orders[0], req.user)) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: "Order access denied" });
    }
    const invoice = await ensureInvoice(connection, orders[0]);
    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Invoice is ready",
      invoice_id: invoice.id,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create invoice error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to create invoice",
    });
  } finally {
    connection.release();
  }
};

export const getInvoices = async (req, res) => {
  try {
    const values = [];
    let scope = "";
    if (req.user.role === "farmer") {
      scope = "WHERE i.sellerId = ?";
      values.push(req.user.id);
    } else if (req.user.role === "distributor") {
      scope = "WHERE i.buyerId = ?";
      values.push(req.user.id);
    }
    const [invoices] = await db.query(
      `${invoiceSelect} ${scope} ORDER BY i.id DESC`,
      values
    );
    res.json({ success: true, invoices });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch invoices" });
  }
};

export const getPayments = async (req, res) => {
  try {
    const values = [];
    let scope = "";
    if (req.user.role !== "admin") {
      scope = "WHERE pr.payerId = ? OR pr.payeeId = ?";
      values.push(req.user.id, req.user.id);
    }
    const [payments] = await db.query(
      `
      SELECT
        pr.id,
        pr.invoiceId AS invoice_id,
        pr.orderId AS order_id,
        pr.payerId AS payer_id,
        pr.payeeId AS payee_id,
        pr.amount,
        pr.paymentMethod AS payment_method,
        pr.transactionReference AS transaction_reference,
        pr.proofNote AS proof_note,
        pr.status,
        pr.verifiedAt AS verified_at,
        pr.created_at,
        i.invoiceNumber AS invoice_number,
        payer.fullName AS payer_name,
        payee.fullName AS payee_name
      FROM payment_records pr
      INNER JOIN invoices i ON i.id = pr.invoiceId
      INNER JOIN users payer ON payer.id = pr.payerId
      INNER JOIN users payee ON payee.id = pr.payeeId
      ${scope}
      ORDER BY pr.id DESC
      `,
      values
    );
    res.json({ success: true, payments });
  } catch (error) {
    console.error("Get payments error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payments" });
  }
};

export const submitPayment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const orderId = Number(req.params.orderId);
    const amount = Number(req.body.amount);
    const method = String(req.body.payment_method || "");
    const reference = String(req.body.transaction_reference || "").trim();
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !paymentMethods.has(method) ||
      (method !== "cash" && reference.length < 3)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid amount, payment method and transaction reference are required",
      });
    }
    await connection.beginTransaction();
    const [orders] = await connection.query(`${orderQuery} FOR UPDATE`, [orderId]);
    if (!orders.length || Number(orders[0].distributorId) !== Number(req.user.id)) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Buyer order not found" });
    }
    const invoice = await ensureInvoice(connection, orders[0]);
    const [[submitted]] = await connection.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS amount
      FROM payment_records
      WHERE invoiceId = ? AND status IN ('submitted', 'verified')
      `,
      [invoice.id]
    );
    const outstanding = Number(invoice.totalAmount) - Number(submitted.amount);
    if (amount > outstanding + 0.001) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Maximum outstanding amount is ₹${Math.max(0, outstanding).toFixed(2)}`,
      });
    }
    const [result] = await connection.query(
      `
      INSERT INTO payment_records
      (
        invoiceId, orderId, payerId, payeeId, amount, paymentMethod,
        transactionReference, proofNote
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        invoice.id,
        orderId,
        req.user.id,
        orders[0].farmerId,
        amount,
        method,
        reference.slice(0, 150) || null,
        String(req.body.proof_note || "").trim().slice(0, 1000),
      ]
    );
    const [admins] = await connection.query(
      "SELECT id FROM users WHERE role = 'admin' AND isActive = 1"
    );
    for (const admin of admins) {
      await createNotification(connection, {
        userId: admin.id,
        type: "payment_submitted",
        title: "Payment verification required",
        message: `₹${amount.toLocaleString()} submitted for ${invoice.invoiceNumber}.`,
        relatedType: "payment",
        relatedId: result.insertId,
      });
    }
    await createNotification(connection, {
      userId: orders[0].farmerId,
      type: "payment_submitted",
      title: "Buyer submitted payment record",
      message: `₹${amount.toLocaleString()} was submitted for order #${orderId}; admin verification is pending.`,
      relatedType: "payment",
      relatedId: result.insertId,
    });
    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Payment record submitted for verification",
      payment_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Submit payment error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to submit payment record",
    });
  } finally {
    connection.release();
  }
};

export const reviewPayment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const next = String(req.body.status || "");
    if (!["verified", "rejected"].includes(next)) {
      return res.status(400).json({ success: false, message: "Invalid payment decision" });
    }
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM payment_records WHERE id = ? FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length || rows[0].status !== "submitted") {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Payment is not reviewable" });
    }
    const payment = rows[0];
    await connection.query(
      `
      UPDATE payment_records
      SET status = ?, verifiedBy = ?, verifiedAt = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [next, req.user.id, payment.id]
    );
    if (next === "verified") {
      const [[totals]] = await connection.query(
        `
        SELECT i.totalAmount,
          COALESCE(SUM(CASE WHEN pr.status = 'verified' THEN pr.amount ELSE 0 END), 0)
            AS paid
        FROM invoices i
        LEFT JOIN payment_records pr ON pr.invoiceId = i.id
        WHERE i.id = ?
        GROUP BY i.id
        `,
        [payment.invoiceId]
      );
      const paid = Number(totals.paid);
      const total = Number(totals.totalAmount);
      await connection.query(
        `
        UPDATE invoices
        SET status = ?,
            paidAt = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE paidAt END
        WHERE id = ?
        `,
        [paid >= total ? "paid" : "partially_paid", paid >= total ? "paid" : "partially_paid", payment.invoiceId]
      );
    }
    for (const userId of [payment.payerId, payment.payeeId]) {
      await createNotification(connection, {
        userId,
        type: "payment_review",
        title: `Payment ${next}`,
        message: `Payment record #${payment.id} was ${next} by AgroConnect admin.`,
        relatedType: "payment",
        relatedId: payment.id,
      });
    }
    await connection.commit();
    res.json({ success: true, message: `Payment ${next}` });
  } catch (error) {
    await connection.rollback();
    console.error("Review payment error:", error);
    res.status(500).json({ success: false, message: "Failed to review payment" });
  } finally {
    connection.release();
  }
};

export const getSubscriptions = async (req, res) => {
  try {
    await db.query(
      `
      UPDATE user_subscriptions
      SET status = 'expired'
      WHERE status = 'active' AND endsAt < CURRENT_DATE
      `
    );
    const [plans] = await db.query(
      `
      SELECT code, name, monthlyPrice AS monthly_price,
             commissionPercent AS commission_percent, features
      FROM subscription_plans
      WHERE status = 'active'
      ORDER BY monthlyPrice
      `
    );
    const values = [];
    let scope = "";
    if (req.user.role === "distributor") {
      scope = "WHERE us.distributorId = ?";
      values.push(req.user.id);
    }
    const [subscriptions] = await db.query(
      `
      SELECT
        us.id,
        us.distributorId AS distributor_id,
        us.planCode AS plan_code,
        us.amount,
        us.paymentReference AS payment_reference,
        us.startsAt AS starts_at,
        us.endsAt AS ends_at,
        us.status,
        us.created_at,
        u.fullName AS distributor_name,
        u.businessName AS business_name,
        sp.name AS plan_name,
        sp.commissionPercent AS commission_percent
      FROM user_subscriptions us
      INNER JOIN users u ON u.id = us.distributorId
      INNER JOIN subscription_plans sp ON sp.code = us.planCode
      ${scope}
      ORDER BY us.id DESC
      `,
      values
    );
    res.json({ success: true, plans, subscriptions });
  } catch (error) {
    console.error("Get subscriptions error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch subscriptions" });
  }
};

export const requestSubscription = async (req, res) => {
  try {
    const planCode = String(req.body.plan_code || "");
    const reference = String(req.body.payment_reference || "").trim();
    const [plans] = await db.query(
      "SELECT * FROM subscription_plans WHERE code = ? AND status = 'active'",
      [planCode]
    );
    if (!plans.length) {
      return res.status(400).json({ success: false, message: "Subscription plan not found" });
    }
    const plan = plans[0];
    if (Number(plan.monthlyPrice) > 0 && reference.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required for paid plans",
      });
    }
    const [[existing]] = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM user_subscriptions
      WHERE distributorId = ? AND status IN ('pending', 'active')
      `,
      [req.user.id]
    );
    if (Number(existing.count) > 0) {
      return res.status(409).json({
        success: false,
        message: "Cancel or finish the current subscription before requesting another",
      });
    }
    const autoActive = Number(plan.monthlyPrice) === 0;
    const [result] = await db.query(
      `
      INSERT INTO user_subscriptions
      (
        distributorId, planCode, amount, paymentReference,
        startsAt, endsAt, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        plan.code,
        plan.monthlyPrice,
        reference.slice(0, 150) || null,
        autoActive ? new Date().toISOString().slice(0, 10) : null,
        autoActive
          ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
          : null,
        autoActive ? "active" : "pending",
      ]
    );
    res.status(201).json({
      success: true,
      message: autoActive
        ? "Starter subscription activated"
        : "Subscription request submitted for admin verification",
      subscription_id: result.insertId,
    });
  } catch (error) {
    console.error("Request subscription error:", error);
    res.status(500).json({ success: false, message: "Failed to request subscription" });
  }
};

export const reviewSubscription = async (req, res) => {
  try {
    const next = String(req.body.status || "");
    if (!["active", "rejected", "cancelled"].includes(next)) {
      return res.status(400).json({ success: false, message: "Invalid subscription decision" });
    }
    const [rows] = await db.query(
      "SELECT * FROM user_subscriptions WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }
    const transitions = {
      pending: ["active", "rejected", "cancelled"],
      active: ["cancelled"],
      expired: [],
      cancelled: [],
      rejected: [],
    };
    if (!(transitions[rows[0].status] || []).includes(next)) {
      return res.status(409).json({
        success: false,
        message: `Subscription cannot change from ${rows[0].status} to ${next}`,
      });
    }
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await db.query(
      `
      UPDATE user_subscriptions
      SET status = ?, startsAt = CASE WHEN ? = 'active' THEN ? ELSE startsAt END,
          endsAt = CASE WHEN ? = 'active' THEN ? ELSE endsAt END,
          reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [next, next, start, next, end, req.user.id, req.params.id]
    );
    await createNotification(db, {
      userId: rows[0].distributorId,
      type: "subscription",
      title: `Subscription ${next}`,
      message: `Your ${rows[0].planCode} subscription is ${next}.`,
      relatedType: "subscription",
      relatedId: rows[0].id,
    });
    res.json({ success: true, message: `Subscription ${next}` });
  } catch (error) {
    console.error("Review subscription error:", error);
    res.status(500).json({ success: false, message: "Failed to review subscription" });
  }
};
