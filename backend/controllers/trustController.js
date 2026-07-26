import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const disputeCategories = new Set([
  "quality",
  "payment",
  "delivery",
  "quantity",
  "other",
]);

const disputeTransitions = {
  open: ["under_review", "resolved", "rejected", "closed"],
  under_review: ["resolved", "rejected", "closed"],
  resolved: ["closed"],
  rejected: ["closed"],
  closed: [],
};

const getOrderForParticipant = async (database, orderId, userId) => {
  const [orders] = await database.query(
    `
    SELECT
      o.id, o.farmerId, o.distributorId, o.status,
      p.productName, f.fullName AS farmerName, d.fullName AS distributorName
    FROM orders o
    INNER JOIN products p ON p.id = o.productId
    INNER JOIN users f ON f.id = o.farmerId
    INNER JOIN users d ON d.id = o.distributorId
    WHERE o.id = ? AND (o.farmerId = ? OR o.distributorId = ?)
    `,
    [orderId, userId, userId]
  );
  return orders[0];
};

export const getReviews = async (req, res) => {
  try {
    const values = [];
    let scope = "WHERE r.isVisible = 1";
    if (req.user.role !== "admin") {
      scope += " AND (r.reviewerId = ? OR r.reviewedUserId = ?)";
      values.push(req.user.id, req.user.id);
    }
    const [reviews] = await db.query(
      `
      SELECT
        r.id,
        r.orderId AS order_id,
        r.reviewerId AS reviewer_id,
        r.reviewedUserId AS reviewed_user_id,
        r.rating,
        r.comment,
        r.isVisible AS is_visible,
        r.created_at,
        p.productName AS crop_name,
        reviewer.fullName AS reviewer_name,
        reviewed.fullName AS reviewed_user_name,
        reviewed.role AS reviewed_user_role
      FROM reviews r
      INNER JOIN orders o ON o.id = r.orderId
      INNER JOIN products p ON p.id = o.productId
      INNER JOIN users reviewer ON reviewer.id = r.reviewerId
      INNER JOIN users reviewed ON reviewed.id = r.reviewedUserId
      ${req.user.role === "admin" ? "" : scope}
      ORDER BY r.id DESC
      `,
      values
    );
    const [[summary]] =
      req.user.role === "admin"
        ? await db.query(
            `
            SELECT
              COUNT(*) AS review_count,
              COALESCE(ROUND(AVG(rating), 2), 0) AS average_rating
            FROM reviews
            WHERE isVisible = 1
            `
          )
        : await db.query(
            `
            SELECT
              COUNT(*) AS review_count,
              COALESCE(ROUND(AVG(rating), 2), 0) AS average_rating
            FROM reviews
            WHERE reviewedUserId = ? AND isVisible = 1
            `,
            [req.user.id]
          );
    res.json({ success: true, reviews, summary });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};

export const createReview = async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a whole number from 1 to 5",
      });
    }
    const order = await getOrderForParticipant(
      db,
      req.params.orderId,
      req.user.id
    );
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.status !== "completed") {
      return res.status(409).json({
        success: false,
        message: "A review can be added only after order completion",
      });
    }
    const reviewedUserId =
      Number(order.farmerId) === Number(req.user.id)
        ? order.distributorId
        : order.farmerId;
    const [result] = await db.query(
      `
      INSERT INTO reviews
        (orderId, reviewerId, reviewedUserId, rating, comment)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        order.id,
        req.user.id,
        reviewedUserId,
        rating,
        comment.slice(0, 1500) || null,
      ]
    );
    await createNotification(db, {
      userId: reviewedUserId,
      type: "review",
      title: "New verified-order review",
      message: `${req.user.name} left a ${rating}-star review for order #${order.id}.`,
      relatedType: "review",
      relatedId: result.insertId,
    });
    res.status(201).json({
      success: true,
      message: "Review published",
      review_id: result.insertId,
    });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      success: false,
      message:
        error?.code === "ER_DUP_ENTRY"
          ? "You have already reviewed this order"
          : "Failed to publish review",
    });
  }
};

export const updateReviewVisibility = async (req, res) => {
  try {
    if (typeof req.body.is_visible !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "is_visible must be true or false",
      });
    }
    const [result] = await db.query(
      "UPDATE reviews SET isVisible = ? WHERE id = ?",
      [req.body.is_visible ? 1 : 0, req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    res.json({
      success: true,
      message: req.body.is_visible ? "Review restored" : "Review hidden",
    });
  } catch (error) {
    console.error("Review moderation error:", error);
    res.status(500).json({ success: false, message: "Failed to moderate review" });
  }
};

export const getDisputes = async (req, res) => {
  try {
    const values = [];
    let scope = "";
    if (req.user.role !== "admin") {
      scope = "WHERE d.openedBy = ? OR d.againstUserId = ?";
      values.push(req.user.id, req.user.id);
    }
    const [disputes] = await db.query(
      `
      SELECT
        d.id,
        d.orderId AS order_id,
        d.openedBy AS opened_by,
        d.againstUserId AS against_user_id,
        d.category,
        d.subject,
        d.description,
        d.status,
        d.resolution,
        d.assignedTo AS assigned_to,
        d.resolvedAt AS resolved_at,
        d.created_at,
        p.productName AS crop_name,
        opener.fullName AS opened_by_name,
        againstUser.fullName AS against_user_name,
        assignee.fullName AS assigned_to_name
      FROM disputes d
      INNER JOIN orders o ON o.id = d.orderId
      INNER JOIN products p ON p.id = o.productId
      INNER JOIN users opener ON opener.id = d.openedBy
      INNER JOIN users againstUser ON againstUser.id = d.againstUserId
      LEFT JOIN users assignee ON assignee.id = d.assignedTo
      ${scope}
      ORDER BY d.id DESC
      `,
      values
    );
    if (disputes.length) {
      const [messages] = await db.query(
        `
        SELECT
          dm.id,
          dm.disputeId AS dispute_id,
          dm.senderId AS sender_id,
          dm.message,
          dm.isInternal AS is_internal,
          dm.created_at,
          u.fullName AS sender_name,
          u.role AS sender_role
        FROM dispute_messages dm
        INNER JOIN users u ON u.id = dm.senderId
        WHERE dm.disputeId IN (?)
          ${req.user.role === "admin" ? "" : "AND dm.isInternal = 0"}
        ORDER BY dm.id ASC
        `,
        [disputes.map((item) => item.id)]
      );
      const grouped = messages.reduce((result, message) => {
        (result[message.dispute_id] ||= []).push(message);
        return result;
      }, {});
      for (const dispute of disputes) {
        dispute.messages = grouped[dispute.id] || [];
      }
    }
    res.json({ success: true, disputes });
  } catch (error) {
    console.error("Get disputes error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch disputes" });
  }
};

export const createDispute = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const category = String(req.body.category || "");
    const subject = String(req.body.subject || "").trim();
    const description = String(req.body.description || "").trim();
    if (
      !disputeCategories.has(category) ||
      subject.length < 5 ||
      description.length < 10
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid category, subject and dispute details are required",
      });
    }
    await connection.beginTransaction();
    const order = await getOrderForParticipant(
      connection,
      req.params.orderId,
      req.user.id
    );
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.status === "rejected") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "A dispute cannot be opened for a rejected order",
      });
    }
    const [[existing]] = await connection.query(
      `
      SELECT COUNT(*) AS count
      FROM disputes
      WHERE orderId = ? AND openedBy = ?
        AND status IN ('open', 'under_review')
      `,
      [order.id, req.user.id]
    );
    if (Number(existing.count) > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "You already have an active dispute for this order",
      });
    }
    const againstUserId =
      Number(order.farmerId) === Number(req.user.id)
        ? order.distributorId
        : order.farmerId;
    const [result] = await connection.query(
      `
      INSERT INTO disputes
        (orderId, openedBy, againstUserId, category, subject, description)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        order.id,
        req.user.id,
        againstUserId,
        category,
        subject.slice(0, 180),
        description.slice(0, 3000),
      ]
    );
    await connection.query(
      `
      INSERT INTO dispute_messages
        (disputeId, senderId, message, isInternal)
      VALUES (?, ?, ?, 0)
      `,
      [result.insertId, req.user.id, description.slice(0, 2000)]
    );
    await createNotification(connection, {
      userId: againstUserId,
      type: "dispute",
      title: "Order dispute opened",
      message: `A ${category} dispute was opened for order #${order.id}.`,
      relatedType: "dispute",
      relatedId: result.insertId,
    });
    const [admins] = await connection.query(
      "SELECT id FROM users WHERE role = 'admin' AND isActive = 1"
    );
    for (const admin of admins) {
      await createNotification(connection, {
        userId: admin.id,
        type: "dispute",
        title: "New dispute requires review",
        message: `${subject.slice(0, 90)} — order #${order.id}.`,
        relatedType: "dispute",
        relatedId: result.insertId,
      });
    }
    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Dispute opened",
      dispute_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create dispute error:", error);
    res.status(500).json({ success: false, message: "Failed to open dispute" });
  } finally {
    connection.release();
  }
};

export const addDisputeMessage = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const message = String(req.body.message || "").trim();
    const isInternal = req.user.role === "admin" && req.body.is_internal === true;
    if (message.length < 2) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM disputes WHERE id = ? FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Dispute not found" });
    }
    const dispute = rows[0];
    const participant =
      Number(dispute.openedBy) === Number(req.user.id) ||
      Number(dispute.againstUserId) === Number(req.user.id);
    if (req.user.role !== "admin" && !participant) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: "Dispute access denied" });
    }
    if (
      req.user.role !== "admin" &&
      ["resolved", "rejected", "closed"].includes(dispute.status)
    ) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "This dispute is closed" });
    }
    const [result] = await connection.query(
      `
      INSERT INTO dispute_messages
        (disputeId, senderId, message, isInternal)
      VALUES (?, ?, ?, ?)
      `,
      [dispute.id, req.user.id, message.slice(0, 2000), isInternal ? 1 : 0]
    );
    if (!isInternal) {
      const recipients = new Set([dispute.openedBy, dispute.againstUserId]);
      recipients.delete(Number(req.user.id));
      if (req.user.role !== "admin") {
        const [admins] = await connection.query(
          "SELECT id FROM users WHERE role = 'admin' AND isActive = 1"
        );
        admins.forEach((admin) => recipients.add(admin.id));
      }
      for (const userId of recipients) {
        await createNotification(connection, {
          userId,
          type: "dispute",
          title: "New dispute message",
          message: `Dispute #${dispute.id} has a new message.`,
          relatedType: "dispute",
          relatedId: dispute.id,
        });
      }
    }
    await connection.commit();
    res.status(201).json({
      success: true,
      message: isInternal ? "Internal note added" : "Message added",
      message_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Add dispute message error:", error);
    res.status(500).json({ success: false, message: "Failed to add message" });
  } finally {
    connection.release();
  }
};

export const updateDispute = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const next = String(req.body.status || "");
    const resolution = String(req.body.resolution || "").trim();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM disputes WHERE id = ? FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Dispute not found" });
    }
    const dispute = rows[0];
    if (!(disputeTransitions[dispute.status] || []).includes(next)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Dispute cannot change from ${dispute.status} to ${next}`,
      });
    }
    if (["resolved", "rejected"].includes(next) && resolution.length < 5) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Resolution note is required for this decision",
      });
    }
    await connection.query(
      `
      UPDATE disputes
      SET status = ?,
          resolution = COALESCE(NULLIF(?, ''), resolution),
          assignedTo = ?,
          resolvedAt = CASE
            WHEN ? IN ('resolved', 'rejected', 'closed') THEN CURRENT_TIMESTAMP
            ELSE resolvedAt
          END
      WHERE id = ?
      `,
      [next, resolution.slice(0, 3000), req.user.id, next, dispute.id]
    );
    for (const userId of [dispute.openedBy, dispute.againstUserId]) {
      await createNotification(connection, {
        userId,
        type: "dispute",
        title: "Dispute status updated",
        message: `Dispute #${dispute.id} is now ${next.replaceAll("_", " ")}.`,
        relatedType: "dispute",
        relatedId: dispute.id,
      });
    }
    await connection.commit();
    res.json({ success: true, message: `Dispute ${next.replaceAll("_", " ")}` });
  } catch (error) {
    await connection.rollback();
    console.error("Update dispute error:", error);
    res.status(500).json({ success: false, message: "Failed to update dispute" });
  } finally {
    connection.release();
  }
};
