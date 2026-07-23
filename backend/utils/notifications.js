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
  await database.query(
    `
    INSERT INTO notifications
      (userId, type, title, message, relatedType, relatedId)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      String(type).slice(0, 50),
      String(title).slice(0, 150),
      String(message).slice(0, 500),
      relatedType,
      relatedId,
    ]
  );
};
