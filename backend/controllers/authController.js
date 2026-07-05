import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../config/db.js";

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
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
    } = req.body;

    const finalName = fullName || name;
    const finalPhone = phoneNumber || phone;
    const finalCity = city || district;

    if (!finalName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `
      INSERT INTO users
      (fullName, email, phoneNumber, password, role, city, state, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalName,
        email,
        finalPhone || "",
        hashedPassword,
        role || "farmer",
        finalCity || "",
        state || "",
        address || "",
      ]
    );

    const user = {
      id: result.insertId,
      name: finalName,
      email,
      phone: finalPhone || "",
      role: role || "farmer",
      city: finalCity || "",
      state: state || "",
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
        address
      FROM users 
      WHERE email = ?
      `,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    let isMatch = false;

    if (user.password?.startsWith("$2")) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Demo users ke plain password ke liye
      isMatch = password === user.password;
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
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