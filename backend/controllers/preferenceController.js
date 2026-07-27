import { db } from "../config/db.js";

const booleanFields = [
  "in_app_enabled",
  "email_enabled",
  "sms_enabled",
  "order_updates",
  "price_alerts",
  "chat_messages",
  "weather_advisories",
];

const validTime = (value) =>
  value === null ||
  value === "" ||
  /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));

export const getPreferences = async (req, res) => {
  try {
    await db.query(
      "INSERT IGNORE INTO notification_preferences (userId) VALUES (?)",
      [req.user.id]
    );
    const [rows] = await db.query(
      `
      SELECT
        userId AS user_id,
        inAppEnabled AS in_app_enabled,
        emailEnabled AS email_enabled,
        smsEnabled AS sms_enabled,
        orderUpdates AS order_updates,
        priceAlerts AS price_alerts,
        chatMessages AS chat_messages,
        weatherAdvisories AS weather_advisories,
        preferredLanguage AS preferred_language,
        TIME_FORMAT(quietStart, '%H:%i') AS quiet_start,
        TIME_FORMAT(quietEnd, '%H:%i') AS quiet_end
      FROM notification_preferences
      WHERE userId = ?
      `,
      [req.user.id]
    );
    res.json({ success: true, preferences: rows[0] });
  } catch (error) {
    console.error("Get preferences error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch preferences" });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    for (const field of booleanFields) {
      if (typeof req.body[field] !== "boolean") {
        return res.status(400).json({
          success: false,
          message: `${field} must be true or false`,
        });
      }
    }
    const language = String(req.body.preferred_language || "");
    const quietStart = req.body.quiet_start ?? null;
    const quietEnd = req.body.quiet_end ?? null;
    if (
      !["en", "hi"].includes(language) ||
      !validTime(quietStart) ||
      !validTime(quietEnd) ||
      Boolean(quietStart) !== Boolean(quietEnd)
    ) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid language and complete quiet-hours range",
      });
    }
    await db.query(
      `
      INSERT INTO notification_preferences
      (
        userId, inAppEnabled, emailEnabled, smsEnabled, orderUpdates,
        priceAlerts, chatMessages, weatherAdvisories, preferredLanguage,
        quietStart, quietEnd
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        inAppEnabled = VALUES(inAppEnabled),
        emailEnabled = VALUES(emailEnabled),
        smsEnabled = VALUES(smsEnabled),
        orderUpdates = VALUES(orderUpdates),
        priceAlerts = VALUES(priceAlerts),
        chatMessages = VALUES(chatMessages),
        weatherAdvisories = VALUES(weatherAdvisories),
        preferredLanguage = VALUES(preferredLanguage),
        quietStart = VALUES(quietStart),
        quietEnd = VALUES(quietEnd)
      `,
      [
        req.user.id,
        req.body.in_app_enabled ? 1 : 0,
        req.body.email_enabled ? 1 : 0,
        req.body.sms_enabled ? 1 : 0,
        req.body.order_updates ? 1 : 0,
        req.body.price_alerts ? 1 : 0,
        req.body.chat_messages ? 1 : 0,
        req.body.weather_advisories ? 1 : 0,
        language,
        quietStart || null,
        quietEnd || null,
      ]
    );
    res.json({
      success: true,
      message:
        "Notification preferences saved. Email/SMS delivery requires a configured provider worker.",
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    res.status(500).json({ success: false, message: "Failed to update preferences" });
  }
};

export const getOutbox = async (req, res) => {
  try {
    const status = String(req.query.status || "");
    const validStatuses = new Set(["queued", "sent", "failed", "skipped"]);
    const values = [];
    let filter = "";
    if (status && validStatuses.has(status)) {
      filter = "WHERE no.status = ?";
      values.push(status);
    }
    const [outbox] = await db.query(
      `
      SELECT
        no.id,
        no.userId AS user_id,
        no.notificationId AS notification_id,
        no.channel,
        no.recipient,
        no.payload,
        no.status,
        no.attempts,
        no.lastError AS last_error,
        no.processedAt AS processed_at,
        no.created_at,
        u.fullName AS user_name
      FROM notification_outbox no
      INNER JOIN users u ON u.id = no.userId
      ${filter}
      ORDER BY no.id DESC
      LIMIT 100
      `,
      values
    );
    res.json({ success: true, outbox });
  } catch (error) {
    console.error("Get outbox error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch delivery outbox" });
  }
};
