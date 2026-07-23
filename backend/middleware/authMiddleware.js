import jwt from "jsonwebtoken";
import { db } from "../config/db.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    const token = authHeader.slice(7).trim();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await db.query(
      `
      SELECT 
        id,
        fullName AS name,
        email,
        phoneNumber AS phone,
        role,
        city,
        state,
        address,
        businessName AS business_name,
        businessType AS business_type,
        verificationStatus AS verification_status,
        verificationNote AS verification_note,
        isActive AS is_active,
        created_at
      FROM users
      WHERE id = ?
      `,
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!users[0].is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact AgroConnect support.",
      });
    }

    req.user = users[0];

    next();
  } catch (error) {
    if (error?.code === "ER_BAD_FIELD_ERROR") {
      console.error("Authentication schema error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Phase 1 database migration has not been applied.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  };
};

export const requireVerified = (req, res, next) => {
  if (req.user?.verification_status !== "verified") {
    return res.status(403).json({
      success: false,
      message: "Admin verification is required for this action.",
      verification_status: req.user?.verification_status || "unsubmitted",
    });
  }

  next();
};
