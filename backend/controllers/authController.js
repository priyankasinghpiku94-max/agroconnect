import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../config/db.js";

const allowedRoles = new Set(["farmer", "distributor"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10,15}$/;

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
};

export const register = async (req, res) => {
  try {
    const {
      name,
      fullName,
      email,
      phone,
      phoneNumber,
      password,
      role,
      city,
      district,
      state,
      address,
      businessName,
      businessType,
    } = req.body;

    const finalName = String(fullName || name || "").trim();
    const finalEmail = String(email || "").trim().toLowerCase();
    const finalPhone = String(phoneNumber || phone || "").replace(/\D/g, "");
    const finalCity = String(city || district || "").trim();
    const finalRole = String(role || "").trim().toLowerCase();
    const finalPassword = String(password || "");

    if (!finalName || !finalEmail || !finalPhone || !finalPassword || !finalRole) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, password and role are required",
      });
    }

    if (!emailPattern.test(finalEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (!phonePattern.test(finalPhone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must contain 10 to 15 digits",
      });
    }

    if (finalPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    if (!allowedRoles.has(finalRole)) {
      return res.status(400).json({
        success: false,
        message: "Role must be farmer or distributor",
      });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      finalEmail,
    ]);

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(finalPassword, 12);

    const [result] = await db.query(
      `
      INSERT INTO users
      (
        fullName, email, phoneNumber, password, role, city, state, address,
        businessName, businessType, verificationStatus
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unsubmitted')
      `,
      [
        finalName,
        finalEmail,
        finalPhone,
        hashedPassword,
        finalRole,
        finalCity,
        String(state || "").trim(),
        String(address || "").trim(),
        String(businessName || "").trim(),
        String(businessType || "").trim(),
      ]
    );

    const user = {
      id: result.insertId,
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      role: finalRole,
      city: finalCity,
      state: String(state || "").trim(),
      address: String(address || "").trim(),
      business_name: String(businessName || "").trim(),
      business_type: String(businessType || "").trim(),
      verification_status: "unsubmitted",
      is_active: 1,
    };

    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const [users] = await db.query(
      `
      SELECT 
        id,
        fullName AS name,
        email,
        phoneNumber AS phone,
        password,
        role,
        city,
        state,
        address,
        businessName AS business_name,
        businessType AS business_type,
        verificationStatus AS verification_status,
        verificationNote AS verification_note,
        isActive AS is_active
      FROM users 
      WHERE email = ?
      `,
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    const isMatch =
      typeof password === "string" &&
      user.password?.startsWith("$2") &&
      (await bcrypt.compare(password, user.password));

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact AgroConnect support.",
      });
    }

    const token = createToken(user);

    delete user.password;

    res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

export const getProfile = async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
};

export const updateProfile = async (req, res) => {
  try {
    const {
      name,
      fullName,
      phone,
      phoneNumber,
      city,
      district,
      state,
      address,
      businessName,
      businessType,
    } = req.body;

    const finalName = String(fullName || name || "").trim();
    const finalPhone = String(phoneNumber || phone || "").replace(/\D/g, "");
    const finalCity = String(city || district || "").trim();

    if (!finalName || !phonePattern.test(finalPhone)) {
      return res.status(400).json({
        success: false,
        message: "A valid name and phone number are required",
      });
    }

    await db.query(
      `
      UPDATE users
      SET
        fullName = ?,
        phoneNumber = ?,
        city = ?,
        state = ?,
        address = ?,
        businessName = ?,
        businessType = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        finalName,
        finalPhone,
        finalCity,
        String(state || "").trim(),
        String(address || "").trim(),
        String(businessName || "").trim(),
        String(businessType || "").trim(),
        req.user.id,
      ]
    );

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
      [req.user.id]
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: users[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};
