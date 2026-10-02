import { db } from "../config/db.js";

const median = (values) => {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

const round = (n) => Math.round(Number(n || 0) * 100) / 100;

export const recommendPrice = async (req, res) => {
  try {
    const crop = String(req.query.crop || "").trim();
    const category = String(req.query.category || "").trim();
    const city = String(req.query.city || "").trim();
    const target = Number(req.query.target_price || 0);

    if (!crop && !category) {
      return res.status(400).json({ success: false, message: "Crop or category is required" });
    }

    const [rows] = await db.query(
      `SELECT productName, category, city, state, price, unit, quantity
       FROM products
       WHERE status = 'available' AND quantity > 0
         AND (? = '' OR LOWER(productName) = LOWER(?))
         AND (? = '' OR LOWER(category) = LOWER(?))
         AND (? = '' OR LOWER(city) = LOWER(?))
       ORDER BY updated_at DESC
       LIMIT 100`,
      [crop, crop, category, category, city, city]
    );

    // Explainable recommendation: median live supply price with a modest range.
    const prices = rows.map((r) => Number(r.price)).filter((p) => p > 0);
    const reference = median(prices);
    if (!reference) {
      return res.json({ success: true, available: false, message: "Not enough live market data yet", sample_size: 0 });
    }

    const low = round(reference * 0.94);
    const high = round(reference * 1.06);
    const recommendation = target > 0 ? round((reference + target) / 2) : round(reference);

    res.json({
      success: true,
      available: true,
      methodology: "Live available-listing median; indicative range, not a guaranteed market price",
      reference_price: round(reference),
      suggested_price: recommendation,
      range: { low, high },
      unit: rows[0]?.unit || "kg",
      sample_size: prices.length,
      locations: [...new Set(rows.map((r) => [r.city, r.state].filter(Boolean).join(", ")).filter(Boolean))].slice(0, 8),
    });
  } catch (error) {
    console.error("Scale price recommendation error:", error);
    res.status(500).json({ success: false, message: "Failed to calculate price recommendation" });
  }
};

export const demandForecast = async (req, res) => {
  try {
    const crop = String(req.query.crop || "").trim();
    const weeks = Math.min(12, Math.max(4, Number(req.query.weeks || 8)));
    if (!crop) return res.status(400).json({ success: false, message: "Crop is required" });

    const [rows] = await db.query(
      `SELECT YEARWEEK(o.created_at, 3) AS week_key,
              DATE_FORMAT(MIN(o.created_at), '%d %b') AS week_label,
              COALESCE(SUM(o.quantity), 0) AS quantity,
              COUNT(*) AS orders
       FROM orders o
       INNER JOIN products p ON p.id = o.productId
       WHERE o.status = 'completed'
         AND LOWER(p.productName) = LOWER(?)
         AND o.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL ? WEEK)
       GROUP BY YEARWEEK(o.created_at, 3)
       ORDER BY week_key ASC`,
      [crop, weeks]
    );

    const quantities = rows.map((r) => Number(r.quantity));
    const avg = quantities.length ? quantities.reduce((a, b) => a + b, 0) / quantities.length : 0;
    const recent = quantities.slice(-Math.min(3, quantities.length));
    const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : avg;
    const trendPct = avg ? round(((recentAvg - avg) / avg) * 100) : 0;
    const next = round(recentAvg || avg);

    res.json({
      success: true,
      methodology: "Completed-order rolling average; indicative demand signal",
      crop,
      history: rows,
      average_weekly_quantity: round(avg),
      next_week_estimate: next,
      trend_percent: trendPct,
      demand_signal: trendPct > 10 ? "rising" : trendPct < -10 ? "falling" : "stable",
    });
  } catch (error) {
    console.error("Scale demand forecast error:", error);
    res.status(500).json({ success: false, message: "Failed to calculate demand forecast" });
  }
};
