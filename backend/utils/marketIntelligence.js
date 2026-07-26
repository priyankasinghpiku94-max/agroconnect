import { createNotification } from "./notifications.js";

const alertMatches = (alert, product) => {
  const cropMatch =
    !alert.cropName ||
    String(alert.cropName).toLowerCase() === String(product.cropName).toLowerCase();
  const categoryMatch =
    !alert.category ||
    String(alert.category).toLowerCase() === String(product.category).toLowerCase();
  const cityMatch =
    !alert.city ||
    String(alert.city).toLowerCase() === String(product.city || "").toLowerCase();
  const thresholdMatch =
    alert.direction === "above"
      ? Number(product.price) >= Number(alert.targetPrice)
      : Number(product.price) <= Number(alert.targetPrice);
  return cropMatch && categoryMatch && cityMatch && thresholdMatch;
};

export const recordMarketPriceAndNotify = async (database, product) => {
  try {
    await database.query(
      `
      INSERT INTO market_price_snapshots
        (productId, cropName, category, city, state, unit, price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        product.id,
        String(product.cropName).trim(),
        String(product.category).trim(),
        String(product.city || "").trim() || null,
        String(product.state || "").trim() || null,
        String(product.unit).trim(),
        Number(product.price),
      ]
    );
    const [alerts] = await database.query(
      `
      SELECT *
      FROM price_alerts
      WHERE isActive = 1
        AND (lastTriggeredAt IS NULL OR lastTriggeredAt < DATE_SUB(NOW(), INTERVAL 12 HOUR))
        AND (cropName IS NULL OR LOWER(cropName) = LOWER(?))
        AND (category IS NULL OR LOWER(category) = LOWER(?))
        AND (city IS NULL OR LOWER(city) = LOWER(?))
      `,
      [product.cropName, product.category, product.city || ""]
    );
    for (const alert of alerts) {
      if (!alertMatches(alert, product)) continue;
      await createNotification(database, {
        userId: alert.userId,
        type: "price_alert",
        title: "Crop price alert matched",
        message: `${product.cropName} is listed at ₹${Number(product.price).toLocaleString()}/${product.unit} in ${product.city || product.state || "the marketplace"}.`,
        relatedType: "product",
        relatedId: product.id,
      });
      await database.query(
        "UPDATE price_alerts SET lastTriggeredAt = CURRENT_TIMESTAMP WHERE id = ?",
        [alert.id]
      );
    }
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      console.warn("Phase 4 market intelligence tables are not migrated yet.");
      return;
    }
    console.error("Market price/alert sync failed:", error.message);
  }
};
