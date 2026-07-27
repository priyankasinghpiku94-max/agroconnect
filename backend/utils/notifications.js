export const createNotification = async (
  database,
  {
    userId,
    type,
    title,
    message,
    relatedType = null,
    relatedId = null,
  }
) => {
  const safeType = String(type).slice(0, 50);
  const safeTitle = String(title).slice(0, 150);
  const safeMessage = String(message).slice(0, 500);
  let settings = {
    inAppEnabled: 1,
    emailEnabled: 0,
    smsEnabled: 0,
    orderUpdates: 1,
    priceAlerts: 1,
    chatMessages: 1,
    weatherAdvisories: 1,
  };
  let recipient = null;

  try {
    const [rows] = await database.query(
      `
      SELECT
        u.email,
        u.phoneNumber,
        COALESCE(np.inAppEnabled, 1) AS inAppEnabled,
        COALESCE(np.emailEnabled, 0) AS emailEnabled,
        COALESCE(np.smsEnabled, 0) AS smsEnabled,
        COALESCE(np.orderUpdates, 1) AS orderUpdates,
        COALESCE(np.priceAlerts, 1) AS priceAlerts,
        COALESCE(np.chatMessages, 1) AS chatMessages,
        COALESCE(np.weatherAdvisories, 1) AS weatherAdvisories,
        np.preferredLanguage,
        TIME_FORMAT(np.quietStart, '%H:%i') AS quietStart,
        TIME_FORMAT(np.quietEnd, '%H:%i') AS quietEnd
      FROM users u
      LEFT JOIN notification_preferences np ON np.userId = u.id
      WHERE u.id = ?
      `,
      [userId]
    );
    if (rows.length) {
      settings = { ...settings, ...rows[0] };
      recipient = rows[0];
    }
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
  }

  const categoryEnabled =
    safeType.includes("price")
      ? Boolean(settings.priceAlerts)
      : safeType.includes("chat")
        ? Boolean(settings.chatMessages)
        : safeType.includes("weather")
          ? Boolean(settings.weatherAdvisories)
          : Boolean(settings.orderUpdates);
  if (!categoryEnabled) return null;

  let notificationId = null;
  if (settings.inAppEnabled) {
    const [result] = await database.query(
      `
      INSERT INTO notifications
        (userId, type, title, message, relatedType, relatedId)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [userId, safeType, safeTitle, safeMessage, relatedType, relatedId]
    );
    notificationId = result.insertId;
  }

  if (!recipient) return notificationId;
  const payload = JSON.stringify({
    type: safeType,
    title: safeTitle,
    message: safeMessage,
    related_type: relatedType,
    related_id: relatedId,
    preferred_language: recipient.preferredLanguage || "en",
    quiet_start: recipient.quietStart || null,
    quiet_end: recipient.quietEnd || null,
  });
  const deliveries = [];
  if (settings.emailEnabled && recipient.email) {
    deliveries.push(["email", recipient.email]);
  }
  if (settings.smsEnabled && recipient.phoneNumber) {
    deliveries.push(["sms", recipient.phoneNumber]);
  }
  for (const [channel, address] of deliveries) {
    await database.query(
      `
      INSERT INTO notification_outbox
        (userId, notificationId, channel, recipient, payload)
      VALUES (?, ?, ?, ?, ?)
      `,
      [userId, notificationId, channel, address, payload]
    );
  }
  return notificationId;
};
