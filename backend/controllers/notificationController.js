import { db } from "../config/db.js";

export const getNotifications = async (req, res) => {
  try {
    const [notifications] = await db.query(
      `
      SELECT
        id, type, title, message,
        relatedType AS related_type,
        relatedId AS related_id,
        isRead AS is_read,
        created_at
      FROM notifications
      WHERE userId = ?
      ORDER BY id DESC
      LIMIT 100
      `,
      [req.user.id]
    );
    const [[unread]] = await db.query(
      "SELECT COUNT(*) AS count FROM notifications WHERE userId = ? AND isRead = 0",
      [req.user.id]
    );
    res.json({
      success: true,
      notifications,
      unread_count: unread.count,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const [result] = await db.query(
      `
      UPDATE notifications
      SET isRead = 1
      WHERE id = ? AND userId = ?
      `,
      [req.params.id, req.user.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark notification error:", error);
    res.status(500).json({ success: false, message: "Failed to update notification" });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await db.query(
      "UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0",
      [req.user.id]
    );
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications error:", error);
    res.status(500).json({ success: false, message: "Failed to update notifications" });
  }
};
