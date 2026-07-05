import { db } from "../config/db.js";

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

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers.count,
        totalFarmers: totalFarmers.count,
        totalDistributors: totalDistributors.count,
        totalProducts: totalProducts.count,
        totalOrders: totalOrders.count,
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
        (CAST(o.quantity AS DECIMAL(10,2)) * p.price) AS total_price,
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

    await db.query("DELETE FROM users WHERE id = ? AND role != 'admin'", [id]);

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