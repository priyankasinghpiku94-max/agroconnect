import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const conversationAccess = async (database, conversationId, userId) => {
  const [rows] = await database.query(
    `
    SELECT c.*, p.productName
    FROM conversations c
    INNER JOIN orders o ON o.id = c.orderId
    INNER JOIN products p ON p.id = o.productId
    WHERE c.id = ? AND (c.farmerId = ? OR c.distributorId = ?)
    `,
    [conversationId, userId, userId]
  );
  return rows[0];
};

export const getConversations = async (req, res) => {
  try {
    const [conversations] = await db.query(
      `
      SELECT
        c.id,
        c.orderId AS order_id,
        c.farmerId AS farmer_id,
        c.distributorId AS distributor_id,
        c.status,
        c.lastMessageAt AS last_message_at,
        c.created_at,
        o.status AS order_status,
        p.productName AS crop_name,
        p.unit,
        o.quantity,
        f.fullName AS farmer_name,
        d.fullName AS distributor_name,
        CASE
          WHEN c.farmerId = ? THEN d.fullName
          ELSE f.fullName
        END AS counterpart_name,
        (
          SELECT cm.message
          FROM conversation_messages cm
          WHERE cm.conversationId = c.id
          ORDER BY cm.id DESC
          LIMIT 1
        ) AS last_message,
        (
          SELECT COUNT(*)
          FROM conversation_messages cm
          WHERE cm.conversationId = c.id
            AND cm.senderId != ?
            AND cm.isRead = 0
        ) AS unread_count
      FROM conversations c
      INNER JOIN orders o ON o.id = c.orderId
      INNER JOIN products p ON p.id = o.productId
      INNER JOIN users f ON f.id = c.farmerId
      INNER JOIN users d ON d.id = c.distributorId
      WHERE c.farmerId = ? OR c.distributorId = ?
      ORDER BY COALESCE(c.lastMessageAt, c.created_at) DESC
      `,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );
    res.json({ success: true, conversations });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch conversations" });
  }
};

export const createConversation = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query(
      `
      SELECT o.*, p.productName
      FROM orders o
      INNER JOIN products p ON p.id = o.productId
      WHERE o.id = ?
        AND (o.farmerId = ? OR o.distributorId = ?)
      FOR UPDATE
      `,
      [req.params.orderId, req.user.id, req.user.id]
    );
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (orders[0].status === "rejected") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Chat cannot be started for a rejected order",
      });
    }
    const [result] = await connection.query(
      `
      INSERT INTO conversations (orderId, farmerId, distributorId)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `,
      [orders[0].id, orders[0].farmerId, orders[0].distributorId]
    );
    const conversationId = result.insertId;
    const [[count]] = await connection.query(
      "SELECT COUNT(*) AS count FROM conversation_messages WHERE conversationId = ?",
      [conversationId]
    );
    if (Number(count.count) === 0) {
      await connection.query(
        `
        INSERT INTO conversation_messages
          (conversationId, senderId, message, messageType, isRead)
        VALUES (?, ?, ?, 'system', 1)
        `,
        [
          conversationId,
          req.user.id,
          `Order #${orders[0].id} business chat started`,
        ]
      );
      await connection.query(
        "UPDATE conversations SET lastMessageAt = CURRENT_TIMESTAMP WHERE id = ?",
        [conversationId]
      );
    }
    await connection.commit();
    res.status(201).json({
      success: true,
      message: Number(count.count) === 0 ? "Business chat started" : "Business chat opened",
      conversation_id: conversationId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create conversation error:", error);
    res.status(500).json({ success: false, message: "Failed to start business chat" });
  } finally {
    connection.release();
  }
};

export const getMessages = async (req, res) => {
  try {
    const conversation = await conversationAccess(
      db,
      req.params.id,
      req.user.id
    );
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    const afterId = Math.max(0, Number(req.query.after_id) || 0);
    const [messages] = await db.query(
      `
      SELECT
        cm.id,
        cm.conversationId AS conversation_id,
        cm.senderId AS sender_id,
        cm.message,
        cm.messageType AS message_type,
        cm.isRead AS is_read,
        cm.readAt AS read_at,
        cm.created_at,
        u.fullName AS sender_name,
        u.role AS sender_role
      FROM conversation_messages cm
      INNER JOIN users u ON u.id = cm.senderId
      WHERE cm.conversationId = ? AND cm.id > ?
      ORDER BY cm.id DESC
      LIMIT 100
      `,
      [conversation.id, afterId]
    );
    await db.query(
      `
      UPDATE conversation_messages
      SET isRead = 1, readAt = CURRENT_TIMESTAMP
      WHERE conversationId = ? AND senderId != ? AND isRead = 0
      `,
      [conversation.id, req.user.id]
    );
    res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
};

export const sendMessage = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const message = String(req.body.message || "").trim();
    if (message.length < 1 || message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message must be between 1 and 2000 characters",
      });
    }
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `
      SELECT c.*, p.productName
      FROM conversations c
      INNER JOIN orders o ON o.id = c.orderId
      INNER JOIN products p ON p.id = o.productId
      WHERE c.id = ? AND (c.farmerId = ? OR c.distributorId = ?)
      FOR UPDATE
      `,
      [req.params.id, req.user.id, req.user.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    const conversation = rows[0];
    if (conversation.status !== "active") {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Conversation is archived" });
    }
    const [result] = await connection.query(
      `
      INSERT INTO conversation_messages
        (conversationId, senderId, message)
      VALUES (?, ?, ?)
      `,
      [conversation.id, req.user.id, message]
    );
    await connection.query(
      "UPDATE conversations SET lastMessageAt = CURRENT_TIMESTAMP WHERE id = ?",
      [conversation.id]
    );
    const recipientId =
      Number(conversation.farmerId) === Number(req.user.id)
        ? conversation.distributorId
        : conversation.farmerId;
    await createNotification(connection, {
      userId: recipientId,
      type: "chat_message",
      title: `New message for order #${conversation.orderId}`,
      message: `${req.user.name}: ${message.slice(0, 180)}`,
      relatedType: "conversation",
      relatedId: conversation.id,
    });
    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Message sent",
      message_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: "Failed to send message" });
  } finally {
    connection.release();
  }
};
