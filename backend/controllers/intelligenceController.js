import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const roundScore = (score) => Math.min(99, Math.max(1, Math.round(score)));
const normalize = (value) => String(value || "").trim().toLowerCase();

const scoreLocation = (source, target, reasons) => {
  let score = 0;
  if (
    normalize(source.city) &&
    normalize(source.city) === normalize(target.city)
  ) {
    score += 18;
    reasons.push("Same city");
  } else if (
    normalize(source.state) &&
    normalize(source.state) === normalize(target.state)
  ) {
    score += 10;
    reasons.push("Same state");
  }
  return score;
};

export const getSmartMatches = async (req, res) => {
  try {
    if (req.user.role === "distributor") {
      const [demands] = await db.query(
        `
        SELECT cropName, category, targetPrice, deliveryCity AS city,
               deliveryState AS state
        FROM demands
        WHERE distributorId = ? AND status = 'open'
        ORDER BY id DESC
        `,
        [req.user.id]
      );
      const [products] = await db.query(
        `
        SELECT
          p.id, p.productName AS title, p.category, p.price,
          p.quantity, p.unit, p.city, p.state, p.qualityGrade AS quality,
          u.fullName AS partner_name, u.businessName AS business_name
        FROM products p
        INNER JOIN users u ON u.id = p.farmerId
        WHERE p.status = 'available' AND p.quantity > 0
          AND u.isActive = 1 AND u.verificationStatus = 'verified'
        ORDER BY p.id DESC
        LIMIT 100
        `
      );
      const matches = products.map((product) => {
        const reasons = ["Verified farmer"];
        let score = 42 + scoreLocation(req.user, product, reasons);
        const bestDemand = demands
          .map((demand) => {
            let demandScore = 0;
            if (normalize(demand.cropName) === normalize(product.title)) {
              demandScore += 30;
            } else if (normalize(demand.category) === normalize(product.category)) {
              demandScore += 18;
            }
            if (
              demand.targetPrice &&
              Number(product.price) <= Number(demand.targetPrice)
            ) {
              demandScore += 10;
            }
            return { demand, demandScore };
          })
          .sort((a, b) => b.demandScore - a.demandScore)[0];
        if (bestDemand?.demandScore) {
          score += bestDemand.demandScore;
          reasons.push("Matches an open purchase demand");
          if (bestDemand.demand.targetPrice && Number(product.price) <= Number(bestDemand.demand.targetPrice)) {
            reasons.push("Within target price");
          }
        } else {
          reasons.push("Active market supply");
        }
        return {
          id: `product-${product.id}`,
          entity_id: product.id,
          type: "crop_supply",
          title: product.title,
          subtitle: `${product.quantity} ${product.unit} · ₹${product.price}/${product.unit}`,
          partner_name: product.business_name || product.partner_name,
          location: [product.city, product.state].filter(Boolean).join(", "),
          score: roundScore(score),
          reasons,
          action_url: `/products/${product.id}`,
        };
      });
      return res.json({
        success: true,
        engine: "AgroConnect Explainable Match Engine v1",
        matches: matches.sort((a, b) => b.score - a.score).slice(0, 12),
      });
    }

    if (req.user.role === "farmer") {
      const [inventory] = await db.query(
        `
        SELECT productName, category, price, city, state
        FROM products
        WHERE farmerId = ? AND status = 'available' AND quantity > 0
        `,
        [req.user.id]
      );
      const [demands] = await db.query(
        `
        SELECT
          d.id, d.cropName AS title, d.category, d.quantity, d.unit,
          d.targetPrice AS target_price, d.deliveryCity AS city,
          d.deliveryState AS state, d.neededBy AS needed_by,
          d.procurementType AS procurement_type,
          u.fullName AS partner_name, u.businessName AS business_name
        FROM demands d
        INNER JOIN users u ON u.id = d.distributorId
        WHERE d.status = 'open' AND d.neededBy >= CURRENT_DATE
          AND u.isActive = 1 AND u.verificationStatus = 'verified'
        ORDER BY d.id DESC
        LIMIT 100
        `
      );
      const matches = demands.map((demand) => {
        const reasons = ["Verified buyer"];
        let score = 40 + scoreLocation(req.user, demand, reasons);
        const bestProduct = inventory
          .map((product) => {
            let productScore = 0;
            if (normalize(product.productName) === normalize(demand.title)) {
              productScore += 32;
            } else if (normalize(product.category) === normalize(demand.category)) {
              productScore += 20;
            }
            if (
              demand.target_price &&
              Number(demand.target_price) >= Number(product.price)
            ) {
              productScore += 10;
            }
            return { product, productScore };
          })
          .sort((a, b) => b.productScore - a.productScore)[0];
        if (bestProduct?.productScore) {
          score += bestProduct.productScore;
          reasons.push("Matches your crop inventory");
          if (
            demand.target_price &&
            Number(demand.target_price) >= Number(bestProduct.product.price)
          ) {
            reasons.push("Favourable target price");
          }
        } else {
          reasons.push("Open procurement opportunity");
        }
        if (demand.procurement_type === "recurring") {
          score += 8;
          reasons.push("Recurring income opportunity");
        }
        return {
          id: `demand-${demand.id}`,
          entity_id: demand.id,
          type: "demand_opportunity",
          title: demand.title,
          subtitle: `${demand.quantity} ${demand.unit}${demand.target_price ? ` · target ₹${demand.target_price}` : ""}`,
          partner_name: demand.business_name || demand.partner_name,
          location: [demand.city, demand.state].filter(Boolean).join(", "),
          score: roundScore(score),
          reasons,
          action_url: "/demands",
        };
      });
      return res.json({
        success: true,
        engine: "AgroConnect Explainable Match Engine v1",
        matches: matches.sort((a, b) => b.score - a.score).slice(0, 12),
      });
    }

    const [[summary]] = await db.query(
      `
      SELECT
        (SELECT COUNT(*) FROM products WHERE status = 'available') AS active_products,
        (SELECT COUNT(*) FROM demands WHERE status = 'open') AS open_demands,
        (SELECT COUNT(*) FROM equipment_listings WHERE status = 'active') AS active_equipment,
        (SELECT COUNT(*) FROM agri_inputs WHERE status = 'active') AS active_inputs
      `
    );
    res.json({
      success: true,
      engine: "AgroConnect Explainable Match Engine v1",
      matches: Object.entries(summary).map(([key, value], index) => ({
        id: `admin-${index}`,
        type: "platform_signal",
        title: key.replaceAll("_", " "),
        subtitle: `${value} live records`,
        score: Math.min(99, 50 + Number(value)),
        reasons: ["Live platform supply-demand signal"],
        action_url: "/business/analytics",
      })),
    });
  } catch (error) {
    console.error("Smart matches error:", error);
    res.status(500).json({ success: false, message: "Failed to calculate smart matches" });
  }
};

export const getPriceInsights = async (req, res) => {
  try {
    const values = [];
    let filter = "";
    if (req.query.crop) {
      filter = "WHERE LOWER(cropName) LIKE LOWER(?)";
      values.push(`%${String(req.query.crop).trim().slice(0, 120)}%`);
    }
    const [insights] = await db.query(
      `
      SELECT
        cropName AS crop_name,
        category,
        unit,
        ROUND(AVG(CASE
          WHEN capturedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN price
        END), 2) AS current_average,
        ROUND(AVG(CASE
          WHEN capturedAt < DATE_SUB(NOW(), INTERVAL 30 DAY)
           AND capturedAt >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN price
        END), 2) AS previous_average,
        MIN(price) AS lowest_price,
        MAX(price) AS highest_price,
        COUNT(*) AS sample_count,
        MAX(capturedAt) AS last_updated
      FROM market_price_snapshots
      ${filter}
      GROUP BY cropName, category, unit
      ORDER BY MAX(capturedAt) DESC, cropName
      LIMIT 30
      `,
      values
    );
    res.json({
      success: true,
      insights: insights.map((item) => {
        const current = Number(item.current_average || 0);
        const previous = Number(item.previous_average || current || 0);
        const change = previous ? ((current - previous) / previous) * 100 : 0;
        return {
          ...item,
          trend_percent: Number(change.toFixed(1)),
          trend: change > 1 ? "rising" : change < -1 ? "falling" : "stable",
        };
      }),
    });
  } catch (error) {
    console.error("Price insights error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch market prices" });
  }
};

export const getPriceAlerts = async (req, res) => {
  try {
    const [alerts] = await db.query(
      `
      SELECT
        id,
        cropName AS crop_name,
        category,
        city,
        direction,
        targetPrice AS target_price,
        isActive AS is_active,
        lastTriggeredAt AS last_triggered_at,
        created_at
      FROM price_alerts
      WHERE userId = ?
      ORDER BY id DESC
      `,
      [req.user.id]
    );
    res.json({ success: true, alerts });
  } catch (error) {
    console.error("Get price alerts error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch price alerts" });
  }
};

export const createPriceAlert = async (req, res) => {
  try {
    const cropName = String(req.body.crop_name || "").trim();
    const category = String(req.body.category || "").trim();
    const city = String(req.body.city || "").trim();
    const direction = String(req.body.direction || "below");
    const target = Number(req.body.target_price);
    if (
      (!cropName && !category) ||
      !["below", "above"].includes(direction) ||
      !Number.isFinite(target) ||
      target <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Crop/category, alert direction and target price are required",
      });
    }
    const [result] = await db.query(
      `
      INSERT INTO price_alerts
        (userId, cropName, category, city, direction, targetPrice)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        cropName.slice(0, 120) || null,
        category.slice(0, 100) || null,
        city.slice(0, 100) || null,
        direction,
        target,
      ]
    );
    const comparison = direction === "above" ? ">=" : "<=";
    const [matches] = await db.query(
      `
      SELECT id, productName, price, unit, city
      FROM products
      WHERE status = 'available'
        AND (? IS NULL OR LOWER(productName) = LOWER(?))
        AND (? IS NULL OR LOWER(category) = LOWER(?))
        AND (? IS NULL OR LOWER(city) = LOWER(?))
        AND price ${comparison} ?
      ORDER BY ABS(price - ?) ASC
      LIMIT 1
      `,
      [
        cropName || null,
        cropName || null,
        category || null,
        category || null,
        city || null,
        city || null,
        target,
        target,
      ]
    );
    if (matches.length) {
      const match = matches[0];
      await createNotification(db, {
        userId: req.user.id,
        type: "price_alert",
        title: "Price alert already matched",
        message: `${match.productName} is available at ₹${match.price}/${match.unit}${match.city ? ` in ${match.city}` : ""}.`,
        relatedType: "product",
        relatedId: match.id,
      });
      await db.query(
        "UPDATE price_alerts SET lastTriggeredAt = CURRENT_TIMESTAMP WHERE id = ?",
        [result.insertId]
      );
    }
    res.status(201).json({
      success: true,
      message: matches.length ? "Alert created and a current match was found" : "Price alert created",
      alert_id: result.insertId,
    });
  } catch (error) {
    console.error("Create price alert error:", error);
    res.status(500).json({ success: false, message: "Failed to create price alert" });
  }
};

export const updatePriceAlert = async (req, res) => {
  try {
    const isActive = req.body.is_active;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "Alert status is required" });
    }
    const [result] = await db.query(
      "UPDATE price_alerts SET isActive = ? WHERE id = ? AND userId = ?",
      [isActive ? 1 : 0, req.params.id, req.user.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Price alert not found" });
    }
    res.json({ success: true, message: isActive ? "Alert activated" : "Alert paused" });
  } catch (error) {
    console.error("Update price alert error:", error);
    res.status(500).json({ success: false, message: "Failed to update price alert" });
  }
};

export const deletePriceAlert = async (req, res) => {
  try {
    const [result] = await db.query(
      "DELETE FROM price_alerts WHERE id = ? AND userId = ?",
      [req.params.id, req.user.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Price alert not found" });
    }
    res.json({ success: true, message: "Price alert deleted" });
  } catch (error) {
    console.error("Delete price alert error:", error);
    res.status(500).json({ success: false, message: "Failed to delete price alert" });
  }
};
