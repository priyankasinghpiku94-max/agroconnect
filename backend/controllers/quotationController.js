import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const activeStatuses = new Set(["submitted", "countered"]);

const normalizeCropName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
    .trim();

const cropMatches = (productName, demandCrop) => {
  const product = normalizeCropName(productName);
  const demand = normalizeCropName(demandCrop);
  return Boolean(product && demand) &&
    (product === demand || product.includes(demand) || demand.includes(product));
};

const quotationFields = `
  q.id,
  q.demandId AS demand_id,
  q.productId AS product_id,
  q.farmerId AS farmer_id,
  q.distributorId AS distributor_id,
  q.quantity,
  q.unitPrice AS unit_price,
  q.message,
  q.status,
  q.currentOfferBy AS current_offer_by,
  q.acceptedAt AS accepted_at,
  q.created_at,
  q.updated_at,
  d.cropName AS crop_name,
  d.quantity AS demand_quantity,
  d.unit,
  d.targetPrice AS target_price,
  d.deliveryCity AS delivery_city,
  d.deliveryState AS delivery_state,
  d.neededBy AS needed_by,
  d.status AS demand_status,
  p.productName AS product_name,
  p.quantity AS product_stock,
  p.qualityGrade AS quality_grade,
  f.fullName AS farmer_name,
  f.businessName AS farmer_business,
  buyer.fullName AS distributor_name,
  buyer.businessName AS distributor_business
`;

const getLockedQuotation = async (connection, quotationId) => {
  const [rows] = await connection.query(
    `
    SELECT
      q.*,
      d.cropName AS demandCrop,
      d.category AS demandCategory,
      d.quantity AS demandQuantity,
      d.unit AS demandUnit,
      d.status AS demandStatus,
      d.neededBy,
      p.productName,
      p.category AS productCategory,
      p.quantity AS productStock,
      p.unit AS productUnit,
      p.minOrderQuantity,
      p.status AS productStatus
    FROM quotations q
    INNER JOIN demands d ON q.demandId = d.id
    INNER JOIN products p ON q.productId = p.id
    WHERE q.id = ?
    FOR UPDATE
    `,
    [quotationId]
  );
  return rows[0];
};

const validateOffer = (quantity, unitPrice, quote) => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quotation quantity must be greater than zero";
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return "Quotation price must be greater than zero";
  }
  if (quantity > Number(quote.demandQuantity)) {
    return `Quotation cannot exceed demand quantity ${quote.demandQuantity}`;
  }
  if (quantity > Number(quote.productStock)) {
    return `Only ${quote.productStock} ${quote.demandUnit} is available`;
  }
  if (quantity < Number(quote.minOrderQuantity || 1)) {
    return `Minimum product order is ${quote.minOrderQuantity}`;
  }
  if (quote.productUnit && quote.productUnit !== quote.demandUnit) {
    return `Quoted product must use ${quote.demandUnit} as its unit`;
  }
  if (
    quote.productCategory &&
    (quote.productCategory !== quote.demandCategory ||
      !cropMatches(quote.productName, quote.demandCrop))
  ) {
    return "Quoted inventory product does not match this crop requirement";
  }
  return "";
};

const isParticipant = (quote, user) =>
  (user.role === "farmer" && Number(quote.farmerId) === Number(user.id)) ||
  (user.role === "distributor" &&
    Number(quote.distributorId) === Number(user.id));

const otherUserId = (quote, user) =>
  user.role === "farmer" ? quote.distributorId : quote.farmerId;

export const submitQuotation = async (req, res) => {
  let connection;
  try {
    const demandId = Number(req.params.demandId);
    const productId = Number(req.body.product_id);
    const quantity = Number(req.body.quantity);
    const unitPrice = Number(req.body.unit_price);

    if (!Number.isInteger(demandId) || !Number.isInteger(productId)) {
      return res.status(400).json({
        success: false,
        message: "A valid demand and product are required",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [demands] = await connection.query(
      `
      SELECT d.*, u.fullName AS distributorName
      FROM demands d
      INNER JOIN users u ON d.distributorId = u.id
      WHERE d.id = ?
      FOR UPDATE
      `,
      [demandId]
    );
    if (!demands.length || demands[0].status !== "open") {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Open purchase demand not found",
      });
    }
    const demand = demands[0];
    if (new Date(demand.neededBy) < new Date(new Date().toDateString())) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "This purchase demand has expired",
      });
    }

    const [products] = await connection.query(
      `
      SELECT *
      FROM products
      WHERE id = ? AND farmerId = ?
      FOR UPDATE
      `,
      [productId, req.user.id]
    );
    if (!products.length || products[0].status !== "available") {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Available product not found in your inventory",
      });
    }
    const product = products[0];
    if (product.unit !== demand.unit) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Selected product must use ${demand.unit} as its unit`,
      });
    }
    if (
      product.category !== demand.category ||
      !cropMatches(product.productName, demand.cropName)
    ) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Selected inventory product does not match this crop requirement",
      });
    }

    const validationError = validateOffer(quantity, unitPrice, {
      demandCrop: demand.cropName,
      demandCategory: demand.category,
      demandQuantity: demand.quantity,
      productStock: product.quantity,
      demandUnit: demand.unit,
      productName: product.productName,
      productCategory: product.category,
      productUnit: product.unit,
      minOrderQuantity: product.minOrderQuantity,
    });
    if (validationError) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: validationError });
    }

    const [existing] = await connection.query(
      "SELECT id FROM quotations WHERE demandId = ? AND farmerId = ?",
      [demandId, req.user.id]
    );
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "You already submitted a quotation for this demand",
      });
    }

    const message = String(req.body.message || "").trim().slice(0, 1000);
    const [result] = await connection.query(
      `
      INSERT INTO quotations
      (
        demandId, productId, farmerId, distributorId, quantity, unitPrice,
        message, status, currentOfferBy
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', 'farmer')
      `,
      [
        demandId,
        productId,
        req.user.id,
        demand.distributorId,
        quantity,
        unitPrice,
        message,
      ]
    );
    await connection.query(
      `
      INSERT INTO quotation_history
        (quotationId, actorId, action, quantity, unitPrice, message)
      VALUES (?, ?, 'submitted', ?, ?, ?)
      `,
      [result.insertId, req.user.id, quantity, unitPrice, message]
    );
    await createNotification(connection, {
      userId: demand.distributorId,
      type: "quotation_received",
      title: "New farmer quotation",
      message: `${req.user.name} quoted ₹${unitPrice}/${demand.unit} for ${demand.cropName}.`,
      relatedType: "quotation",
      relatedId: result.insertId,
    });

    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Quotation submitted successfully",
      quotation_id: result.insertId,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Submit quotation error:", error);
    res.status(500).json({ success: false, message: "Failed to submit quotation" });
  } finally {
    if (connection) connection.release();
  }
};

export const getMyQuotations = async (req, res) => {
  try {
    const column = req.user.role === "farmer" ? "q.farmerId" : "q.distributorId";
    const [quotations] = await db.query(
      `
      SELECT ${quotationFields},
        (SELECT COUNT(*) FROM quotation_history h WHERE h.quotationId = q.id)
          AS history_count
      FROM quotations q
      INNER JOIN demands d ON q.demandId = d.id
      INNER JOIN products p ON q.productId = p.id
      INNER JOIN users f ON q.farmerId = f.id
      INNER JOIN users buyer ON q.distributorId = buyer.id
      WHERE ${column} = ?
      ORDER BY q.updated_at DESC, q.id DESC
      `,
      [req.user.id]
    );
    res.json({ success: true, quotations });
  } catch (error) {
    console.error("Get quotations error:", error);
    res.status(500).json({ success: false, message: "Failed to load negotiations" });
  }
};

export const getQuotationHistory = async (req, res) => {
  try {
    const [quotes] = await db.query(
      "SELECT farmerId, distributorId FROM quotations WHERE id = ?",
      [req.params.id]
    );
    if (!quotes.length || (!isParticipant(quotes[0], req.user) && req.user.role !== "admin")) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    const [history] = await db.query(
      `
      SELECT
        h.id,
        h.action,
        h.quantity,
        h.unitPrice AS unit_price,
        h.message,
        h.created_at,
        u.fullName AS actor_name,
        u.role AS actor_role
      FROM quotation_history h
      INNER JOIN users u ON h.actorId = u.id
      WHERE h.quotationId = ?
      ORDER BY h.id ASC
      `,
      [req.params.id]
    );
    res.json({ success: true, history });
  } catch (error) {
    console.error("Quotation history error:", error);
    res.status(500).json({ success: false, message: "Failed to load offer history" });
  }
};

export const counterQuotation = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const quote = await getLockedQuotation(connection, req.params.id);

    if (!quote || !isParticipant(quote, req.user)) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }
    if (!activeStatuses.has(quote.status) || quote.demandStatus !== "open") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "This negotiation is no longer active",
      });
    }
    if (quote.currentOfferBy === req.user.role) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Please wait for the other party to respond to your offer",
      });
    }

    const quantity = Number(req.body.quantity);
    const unitPrice = Number(req.body.unit_price);
    const validationError = validateOffer(quantity, unitPrice, quote);
    if (validationError) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: validationError });
    }

    const message = String(req.body.message || "").trim().slice(0, 1000);
    await connection.query(
      `
      UPDATE quotations
      SET quantity = ?, unitPrice = ?, message = ?, status = 'countered',
        currentOfferBy = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [quantity, unitPrice, message, req.user.role, req.params.id]
    );
    await connection.query(
      `
      INSERT INTO quotation_history
        (quotationId, actorId, action, quantity, unitPrice, message)
      VALUES (?, ?, 'countered', ?, ?, ?)
      `,
      [req.params.id, req.user.id, quantity, unitPrice, message]
    );
    await createNotification(connection, {
      userId: otherUserId(quote, req.user),
      type: "counter_offer",
      title: "New counter-offer",
      message: `${req.user.name} sent a counter-offer of ₹${unitPrice}/${quote.demandUnit}.`,
      relatedType: "quotation",
      relatedId: Number(req.params.id),
    });

    await connection.commit();
    res.json({ success: true, message: "Counter-offer sent successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Counter quotation error:", error);
    res.status(500).json({ success: false, message: "Failed to send counter-offer" });
  } finally {
    if (connection) connection.release();
  }
};

export const acceptQuotation = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const quote = await getLockedQuotation(connection, req.params.id);

    if (!quote || !isParticipant(quote, req.user)) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }
    if (!activeStatuses.has(quote.status) || quote.demandStatus !== "open") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "This negotiation is no longer active",
      });
    }
    if (quote.currentOfferBy === req.user.role) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "You cannot accept your own offer",
      });
    }

    const validationError = validateOffer(
      Number(quote.quantity),
      Number(quote.unitPrice),
      quote
    );
    if (validationError || quote.productStatus !== "available") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: validationError || "Quoted product is no longer available",
      });
    }

    const [otherQuotes] = await connection.query(
      `
      SELECT id, farmerId, quantity, unitPrice
      FROM quotations
      WHERE demandId = ? AND id != ? AND status IN ('submitted', 'countered')
      `,
      [quote.demandId, quote.id]
    );

    const [orderResult] = await connection.query(
      `
      INSERT INTO orders
      (
        productId, farmerId, distributorId, quantity, message, status,
        demandId, quotationId, agreedPrice
      )
      VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?, ?)
      `,
      [
        quote.productId,
        quote.farmerId,
        quote.distributorId,
        quote.quantity,
        `Accepted quotation for demand #${quote.demandId}`,
        quote.demandId,
        quote.id,
        quote.unitPrice,
      ]
    );
    await connection.query(
      `
      UPDATE quotations
      SET status = 'accepted', acceptedAt = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [quote.id]
    );
    await connection.query(
      `
      UPDATE quotations
      SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
      WHERE demandId = ? AND id != ? AND status IN ('submitted', 'countered')
      `,
      [quote.demandId, quote.id]
    );
    await connection.query(
      `
      UPDATE demands
      SET status = 'awarded', awardedQuotationId = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [quote.id, quote.demandId]
    );
    await connection.query(
      `
      INSERT INTO quotation_history
        (quotationId, actorId, action, quantity, unitPrice, message)
      VALUES (?, ?, 'accepted', ?, ?, ?)
      `,
      [
        quote.id,
        req.user.id,
        quote.quantity,
        quote.unitPrice,
        String(req.body.message || "Offer accepted").trim().slice(0, 1000),
      ]
    );
    await createNotification(connection, {
      userId: otherUserId(quote, req.user),
      type: "quotation_accepted",
      title: "Quotation accepted",
      message: `${quote.demandCrop} quotation was accepted and order #${orderResult.insertId} was created.`,
      relatedType: "order",
      relatedId: orderResult.insertId,
    });

    for (const rejected of otherQuotes) {
      await connection.query(
        `
        INSERT INTO quotation_history
          (quotationId, actorId, action, quantity, unitPrice, message)
        VALUES (?, ?, 'rejected', ?, ?, ?)
        `,
        [
          rejected.id,
          quote.distributorId,
          rejected.quantity,
          rejected.unitPrice,
          "Demand awarded to another quotation",
        ]
      );
      await createNotification(connection, {
        userId: rejected.farmerId,
        type: "quotation_rejected",
        title: "Demand awarded to another quotation",
        message: `${quote.demandCrop} demand has been awarded to another farmer.`,
        relatedType: "demand",
        relatedId: quote.demandId,
      });
    }

    await connection.commit();
    res.json({
      success: true,
      message: "Quotation accepted and order created",
      order_id: orderResult.insertId,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Accept quotation error:", error);
    res.status(500).json({ success: false, message: "Failed to accept quotation" });
  } finally {
    if (connection) connection.release();
  }
};

export const rejectQuotation = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const quote = await getLockedQuotation(connection, req.params.id);

    if (!quote || !isParticipant(quote, req.user)) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }
    if (!activeStatuses.has(quote.status)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "This negotiation is no longer active",
      });
    }
    if (quote.currentOfferBy === req.user.role) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "You cannot reject your own offer",
      });
    }

    const message = String(req.body.message || "Offer rejected").trim().slice(0, 1000);
    await connection.query(
      "UPDATE quotations SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [quote.id]
    );
    await connection.query(
      `
      INSERT INTO quotation_history
        (quotationId, actorId, action, quantity, unitPrice, message)
      VALUES (?, ?, 'rejected', ?, ?, ?)
      `,
      [quote.id, req.user.id, quote.quantity, quote.unitPrice, message]
    );
    await createNotification(connection, {
      userId: otherUserId(quote, req.user),
      type: "quotation_rejected",
      title: "Quotation rejected",
      message: `${req.user.name} rejected the ${quote.demandCrop} offer.`,
      relatedType: "quotation",
      relatedId: quote.id,
    });

    await connection.commit();
    res.json({ success: true, message: "Quotation rejected" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Reject quotation error:", error);
    res.status(500).json({ success: false, message: "Failed to reject quotation" });
  } finally {
    if (connection) connection.release();
  }
};
