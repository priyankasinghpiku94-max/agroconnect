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
import scaleRoutes from "./routes/scaleRoutes.js";
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

/*
  Required when deployed behind Render / reverse proxy.
*/
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/* =========================================================
   CORS
========================================================= */

/*
  Production frontend:
  https://agroconnect-rouge.vercel.app

  Other existing frontend domains are also kept.
*/

const allowedOrigins = [
  // Local development
  "http://localhost:3000",
  "http://localhost:5173",

  // Main production Vercel domain
  "https://agroconnect-rouge.vercel.app",

  // Existing Vercel production domain
  "https://agroconnect-skas.vercel.app",

  // Existing Vercel deployment domain
  "https://agroconnect-kaso5jlv-skas.vercel.app",

  // Environment variable URLs
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean)
    : []),
];

console.log("==============================================");
console.log("🌐 Allowed CORS Origins:");
console.log(allowedOrigins);
console.log("==============================================");

app.use(
  cors({
    origin: (origin, callback) => {
      /*
        Requests like Postman/server-to-server may not
        contain an Origin header.
      */
      if (!origin) {
        return callback(null, true);
      }

      /*
        Remove trailing slash if present.
      */
      const normalizedOrigin = origin.replace(/\/$/, "");

      /*
        Check allowed frontend origin.
      */
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      console.error(
        "❌ CORS blocked origin:",
        origin
      );

      return callback(
        new Error(
          `Origin not allowed by CORS: ${origin}`
        )
      );
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

    optionsSuccessStatus: 204,
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

app.use(
  express.json({
    limit: "1mb",
  })
);

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

/*
  AUTH
*/
app.use(
  "/api/auth",
  authLimiter,
  authRoutes
);

/*
  PRODUCTS
*/
app.use(
  "/api/products",
  productRoutes
);

/*
  ORDERS
*/
app.use(
  "/api/orders",
  orderRoutes
);

/*
  ADMIN
*/
app.use(
  "/api/admin",
  adminRoutes
);

/*
  VERIFICATION
*/
app.use(
  "/api/verification",
  verificationRoutes
);

/*
  DEMANDS
*/
app.use(
  "/api/demands",
  demandRoutes
);

/*
  QUOTATIONS
*/
app.use(
  "/api/quotations",
  quotationRoutes
);

/*
  NOTIFICATIONS
*/
app.use(
  "/api/notifications",
  notificationRoutes
);

/*
  FPO
*/
app.use(
  "/api/fpos",
  fpoRoutes
);

/*
  CONTRACTS
*/
app.use(
  "/api/contracts",
  contractRoutes
);

/*
  WAREHOUSES
*/
app.use(
  "/api/warehouses",
  warehouseRoutes
);

/*
  ANALYTICS
*/
app.use(
  "/api/analytics",
  analyticsRoutes
);

/*
  EQUIPMENT
*/
app.use(
  "/api/equipment",
  equipmentRoutes
);

/*
  INPUTS
*/
app.use(
  "/api/inputs",
  inputRoutes
);

/*
  INTELLIGENCE
*/
app.use(
  "/api/intelligence",
  intelligenceRoutes
);

/*
  COLLECTION CENTRES
*/
app.use(
  "/api/collection-centres",
  collectionRoutes
);

/*
  FINANCE
*/
app.use(
  "/api/finance",
  financeRoutes
);

/*
  FULFILMENT
*/
app.use(
  "/api/fulfilment",
  fulfilmentRoutes
);

/*
  TRUST
*/
app.use(
  "/api/trust",
  trustRoutes
);

/*
  COMMUNICATION
*/
app.use(
  "/api/communication",
  communicationRoutes
);

/*
  ADVISORY
*/
app.use(
  "/api/advisory",
  advisoryRoutes
);

/*
  PREFERENCES
*/
app.use(
  "/api/preferences",
  preferenceRoutes
);

app.use(
  "/api/scale",
  scaleRoutes
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  console.log(
    "404:",
    req.method,
    req.originalUrl
  );

  res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled request error:",
      error
    );

    /* ---------------------------------------------
       CORS ERROR
    --------------------------------------------- */

    const errorMessage = String(
      error?.message || ""
    ).toLowerCase();

    if (
      errorMessage.includes("cors") ||
      errorMessage.includes("origin not allowed")
    ) {
      return res.status(403).json({
        success: false,
        message: "CORS blocked this request",
      });
    }

    /* ---------------------------------------------
       UPLOAD ERROR
    --------------------------------------------- */

    const isUploadError =
      error?.name === "MulterError" ||
      String(error?.message || "").includes(
        "allowed"
      );

    /* ---------------------------------------------
       RESPONSE
    --------------------------------------------- */

    return res.status(
      isUploadError ? 400 : 500
    ).json({
      success: false,

      message: isUploadError
        ? error.message
        : "Internal server error",
    });
  }
);

/* =========================================================
   SERVER
========================================================= */

const PORT =
  process.env.PORT || 8000;

/* =========================================================
   START SERVER
========================================================= */

const startServer = async () => {
  try {
    /*
      Connect database first.
    */
    await connectDB();

    /*
      Start Express server.
    */
    app.listen(PORT, () => {
      console.log(
        "=============================================="
      );

      console.log(
        `✅ AgroConnect backend running on port ${PORT}`
      );

      console.log(
        "🌐 Backend URL:"
      );

      console.log(
        "https://agroconnect-backend-9nvp.onrender.com"
      );

      console.log(
        "=============================================="
      );
    });
  } catch (error) {
    console.error(
      "❌ Server startup failed:",
      error
    );

    process.exit(1);
  }
};

startServer();