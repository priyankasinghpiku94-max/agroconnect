import { db } from "../config/db.js";
import { deleteKycDocument } from "../middleware/uploadMiddleware.js";

export const getStats = async (req, res) => {
  try {
    const [[totalUsers]] = await db.query("SELECT COUNT(*) AS count FROM users");
    const [[totalFarmers]] = await db.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'farmer'"
    );
    const [[totalDistributors]] = await db.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'distributor'"
    );
    const [[totalProducts]] = await db.query(
      "SELECT COUNT(*) AS count FROM products"
    );
    const [[totalOrders]] = await db.query(
      "SELECT COUNT(*) AS count FROM orders"
    );
    const [[pendingVerifications]] = await db.query(
      "SELECT COUNT(*) AS count FROM users WHERE verificationStatus = 'pending'"
    );
    const [[openDemands]] = await db.query(
      "SELECT COUNT(*) AS count FROM demands WHERE status = 'open'"
    );
    const [[activeQuotations]] = await db.query(
      "SELECT COUNT(*) AS count FROM quotations WHERE status IN ('submitted', 'countered')"
    );
    const [[activeFpos]] = await db.query(
      "SELECT COUNT(*) AS count FROM fpos WHERE status = 'active'"
    );
    const [[activeContracts]] = await db.query(
      "SELECT COUNT(*) AS count FROM procurement_contracts WHERE status = 'active'"
    );
    const [[pendingWarehouseBookings]] = await db.query(
      "SELECT COUNT(*) AS count FROM warehouse_bookings WHERE status = 'requested'"
    );
    const [[activeEquipment]] = await db.query(
      "SELECT COUNT(*) AS count FROM equipment_listings WHERE status = 'active'"
    );
    const [[pendingInputOrders]] = await db.query(
      "SELECT COUNT(*) AS count FROM input_orders WHERE status = 'pending'"
    );
    const [[activePriceAlerts]] = await db.query(
      "SELECT COUNT(*) AS count FROM price_alerts WHERE isActive = 1"
    );
    const [[pendingCollectionBookings]] = await db.query(
      "SELECT COUNT(*) AS count FROM collection_bookings WHERE status = 'requested'"
    );
    const [[pendingPayments]] = await db.query(
      "SELECT COUNT(*) AS count FROM payment_records WHERE status = 'submitted'"
    );
    const [[activeSubscriptions]] = await db.query(
      "SELECT COUNT(*) AS count FROM user_subscriptions WHERE status = 'active' AND endsAt >= CURRENT_DATE"
    );
    const [[pendingSubscriptions]] = await db.query(
      "SELECT COUNT(*) AS count FROM user_subscriptions WHERE status = 'pending'"
    );
    const [[activeShipments]] = await db.query(
      "SELECT COUNT(*) AS count FROM shipments WHERE status NOT IN ('delivered', 'cancelled')"
    );
    const [[pendingInspections]] = await db.query(
      "SELECT COUNT(*) AS count FROM quality_inspections WHERE status IN ('requested', 'scheduled')"
    );
    const [[openDisputes]] = await db.query(
      "SELECT COUNT(*) AS count FROM disputes WHERE status IN ('open', 'under_review')"
    );
    const [[averageRating]] = await db.query(
      "SELECT COALESCE(ROUND(AVG(rating), 2), 0) AS value FROM reviews WHERE isVisible = 1"
    );
    const [[activeConversations]] = await db.query(
      "SELECT COUNT(*) AS count FROM conversations WHERE status = 'active'"
    );
    const [[unreadMessages]] = await db.query(
      "SELECT COUNT(*) AS count FROM conversation_messages WHERE isRead = 0"
    );
    const [[queuedNotifications]] = await db.query(
      "SELECT COUNT(*) AS count FROM notification_outbox WHERE status = 'queued'"
    );
    const [[todayAdvisories]] = await db.query(
      "SELECT COUNT(*) AS count FROM weather_advisories WHERE created_at >= CURRENT_DATE"
    );

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers.count,
        totalFarmers: totalFarmers.count,
        totalDistributors: totalDistributors.count,
        totalProducts: totalProducts.count,
        totalOrders: totalOrders.count,
        pendingVerifications: pendingVerifications.count,
        openDemands: openDemands.count,
        activeQuotations: activeQuotations.count,
        activeFpos: activeFpos.count,
        activeContracts: activeContracts.count,
        pendingWarehouseBookings: pendingWarehouseBookings.count,
        activeEquipment: activeEquipment.count,
        pendingInputOrders: pendingInputOrders.count,
        activePriceAlerts: activePriceAlerts.count,
        pendingCollectionBookings: pendingCollectionBookings.count,
        pendingPayments: pendingPayments.count,
        activeSubscriptions: activeSubscriptions.count,
        pendingSubscriptions: pendingSubscriptions.count,
        activeShipments: activeShipments.count,
        pendingInspections: pendingInspections.count,
        openDisputes: openDisputes.count,
        averageRating: averageRating.value,
        activeConversations: activeConversations.count,
        unreadMessages: unreadMessages.count,
        queuedNotifications: queuedNotifications.count,
        todayAdvisories: todayAdvisories.count,
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      `
      SELECT 
        id,
        fullName AS name,
        email,
        phoneNumber AS phone,
        role,
        city AS district,
        state,
        address,
        businessName AS business_name,
        verificationStatus AS verification_status,
        isActive AS is_active,
        created_at
      FROM users
      ORDER BY id DESC
      `
    );

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

export const getAdminProducts = async (req, res) => {
  try {
    const [products] = await db.query(
      `
      SELECT 
        p.id,
        p.productName AS crop_name,
        p.category,
        p.quantity,
        p.unit,
        p.price AS price_per_unit,
        p.status,
        u.fullName AS farmer_name
      FROM products p
      LEFT JOIN users u ON p.farmerId = u.id
      ORDER BY p.id DESC
      `
    );

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Admin products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

export const getAdminOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      `
      SELECT 
        o.id,
        p.productName AS crop_name,
        f.fullName AS farmer_name,
        d.fullName AS distributor_name,
        (CAST(o.quantity AS DECIMAL(12,2)) * COALESCE(o.agreedPrice, p.price))
          AS total_price,
        CASE
          WHEN o.contractId IS NOT NULL THEN 'contract'
          WHEN o.quotationId IS NOT NULL THEN 'demand'
          ELSE 'direct'
        END AS source,
        o.status
      FROM orders o
      LEFT JOIN products p ON o.productId = p.id
      LEFT JOIN users f ON o.farmerId = f.id
      LEFT JOIN users d ON o.distributorId = d.id
      ORDER BY o.id DESC
      `
    );

    res.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Admin orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await db.query(
      "SELECT kycDocumentPath FROM users WHERE id = ? AND role != 'admin'",
      [id]
    );
    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "User not found or protected",
      });
    }
    const [[history]] = await db.query(
      `
      SELECT
        (SELECT COUNT(*) FROM orders
          WHERE farmerId = ? OR distributorId = ?) AS orders_count,
        (SELECT COUNT(*) FROM demands WHERE distributorId = ?) AS demands_count,
        (SELECT COUNT(*) FROM fpos WHERE ownerId = ?) AS fpos_count,
        (SELECT COUNT(*) FROM procurement_contracts
          WHERE farmerId = ? OR distributorId = ?) AS contracts_count,
        (SELECT COUNT(*) FROM warehouse_bookings WHERE userId = ?)
          AS bookings_count,
        (SELECT COUNT(*) FROM equipment_listings WHERE ownerId = ?)
          AS equipment_count,
        (SELECT COUNT(*) FROM equipment_bookings
          WHERE renterId = ? OR ownerId = ?) AS equipment_bookings_count,
        (SELECT COUNT(*) FROM agri_inputs WHERE sellerId = ?)
          AS input_listings_count,
        (SELECT COUNT(*) FROM input_orders
          WHERE buyerId = ? OR sellerId = ?) AS input_orders_count,
        (SELECT COUNT(*) FROM collection_bookings WHERE userId = ?)
          AS collection_bookings_count,
        (SELECT COUNT(*) FROM user_subscriptions WHERE distributorId = ?)
          AS subscriptions_count,
        (SELECT COUNT(*) FROM invoices WHERE sellerId = ? OR buyerId = ?)
          AS invoices_count,
        (SELECT COUNT(*) FROM payment_records WHERE payerId = ? OR payeeId = ?)
          AS payments_count,
        (SELECT COUNT(*) FROM shipments WHERE farmerId = ? OR distributorId = ?)
          AS shipments_count,
        (SELECT COUNT(*) FROM quality_inspections
          WHERE requestedBy = ? OR farmerId = ? OR distributorId = ?)
          AS inspections_count,
        (SELECT COUNT(*) FROM reviews WHERE reviewerId = ? OR reviewedUserId = ?)
          AS reviews_count,
        (SELECT COUNT(*) FROM disputes
          WHERE openedBy = ? OR againstUserId = ?) AS disputes_count,
        (SELECT COUNT(*) FROM conversations
          WHERE farmerId = ? OR distributorId = ?) AS conversations_count
      `,
      [
        id, id, id, id, id, id, id, id, id, id, id, id, id, id,
        id, id, id, id, id, id, id, id, id, id, id, id, id, id,
        id, id,
      ]
    );
    if (
      Object.values(history).some((value) => Number(value) > 0)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This account has business records and cannot be deleted. Deactivate it instead.",
      });
    }
    const [result] = await db.query(
      "DELETE FROM users WHERE id = ? AND role != 'admin'",
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "User not found or protected",
      });
    }

    if (users[0]?.kycDocumentPath) {
      deleteKycDocument(users[0].kycDocumentPath);
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const isActive = req.body.is_active;

    if (!Number.isInteger(id) || typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "A valid user and account status are required",
      });
    }

    const [result] = await db.query(
      `
      UPDATE users
      SET isActive = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND role != 'admin'
      `,
      [isActive ? 1 : 0, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "User not found or protected",
      });
    }

    res.json({
      success: true,
      message: isActive ? "User account activated" : "User account deactivated",
    });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};
