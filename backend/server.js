import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import demandRoutes from "./routes/demandRoutes.js";
import quotationRoutes from "./routes/quotationRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import fpoRoutes from "./routes/fpoRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import warehouseRoutes from "./routes/warehouseRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import equipmentRoutes from "./routes/equipmentRoutes.js";
import inputRoutes from "./routes/inputRoutes.js";
import intelligenceRoutes from "./routes/intelligenceRoutes.js";
import collectionRoutes from "./routes/collectionRoutes.js";
import financeRoutes from "./routes/financeRoutes.js";
import fulfilmentRoutes from "./routes/fulfilmentRoutes.js";
import trustRoutes from "./routes/trustRoutes.js";
import communicationRoutes from "./routes/communicationRoutes.js";
import advisoryRoutes from "./routes/advisoryRoutes.js";
import preferenceRoutes from "./routes/preferenceRoutes.js";
import { productUploadDir } from "./middleware/uploadMiddleware.js";

dotenv.config();

/* =========================================================
   ENVIRONMENT VALIDATION
========================================================= */

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET must be configured with at least 32 characters"
  );
}

/* =========================================================
   APP
========================================================= */

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",

  // Main Vercel production domain
  "https://agroconnect-skas.vercel.app",

  // Current Vercel deployment domain
  "https://agroconnect-kaso5jlv-skas.vercel.app",

  // Environment variable can contain comma-separated URLs
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : []),
];

console.log("Allowed CORS origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin
      // Example: Postman, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("❌ CORS blocked origin:", origin);

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  })
);

/* =========================================================
   SECURITY
========================================================= */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

/* =========================================================
   BODY PARSER
========================================================= */

app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

/* =========================================================
   PRODUCT UPLOADS
========================================================= */

app.use(
  "/uploads/products",
  express.static(productUploadDir, {
    immutable: true,
    maxAge: "7d",
    index: false,
  })
);

/* =========================================================
   RATE LIMITER
========================================================= */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many authentication attempts. Please try again later.",
  },
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AgroConnect Backend API is running",
  });
});

/* =========================================================
   API ROUTES
========================================================= */

app.use("/api/auth", authLimiter, authRoutes);

app.use("/api/products", productRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/verification", verificationRoutes);

app.use("/api/demands", demandRoutes);

app.use("/api/quotations", quotationRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/fpos", fpoRoutes);

app.use("/api/contracts", contractRoutes);

app.use("/api/warehouses", warehouseRoutes);

app.use("/api/analytics", analyticsRoutes);

app.use("/api/equipment", equipmentRoutes);

app.use("/api/inputs", inputRoutes);

app.use("/api/intelligence", intelligenceRoutes);

app.use("/api/collection-centres", collectionRoutes);

app.use("/api/finance", financeRoutes);

app.use("/api/fulfilment", fulfilmentRoutes);

app.use("/api/trust", trustRoutes);

app.use("/api/communication", communicationRoutes);

app.use("/api/advisory", advisoryRoutes);

app.use("/api/preferences", preferenceRoutes);

/* =========================================================
   404
========================================================= */

app.use((req, res) => {
  console.log("404:", req.method, req.originalUrl);

  res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error("Unhandled request error:", error);

  // CORS error
  if (
    String(error?.message || "")
      .toLowerCase()
      .includes("cors")
    ||
    String(error?.message || "")
      .toLowerCase()
      .includes("origin not allowed")
  ) {
    return res.status(403).json({
      success: false,
      message: "CORS blocked this request",
    });
  }

  const isUploadError =
    error?.name === "MulterError" ||
    String(error?.message || "").includes("allowed");

  return res.status(isUploadError ? 400 : 500).json({
    success: false,
    message: isUploadError
      ? error.message
      : "Internal server error",
  });
});

/* =========================================================
   SERVER
========================================================= */

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `✅ AgroConnect backend running on port ${PORT}`
      );

      console.log(
        `🌐 Backend URL: https://agroconnect-backend-9nvp.onrender.com`
      );
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();