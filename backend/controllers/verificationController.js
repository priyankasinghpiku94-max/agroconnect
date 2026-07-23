import fs from "fs";
import { db } from "../config/db.js";
import {
  deleteKycDocument,
  resolveKycDocument,
} from "../middleware/uploadMiddleware.js";

const allowedDocumentTypes = new Set([
  "aadhaar",
  "pan",
  "farmer_id",
  "gst",
  "business_registration",
]);

export const submitKyc = async (req, res) => {
  try {
    const documentType = String(req.body.documentType || "").trim();

    if (!allowedDocumentTypes.has(documentType)) {
      if (req.file) deleteKycDocument(req.file.filename);
      return res.status(400).json({
        success: false,
        message: "Please select a valid KYC document type",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a KYC document",
      });
    }

    const [existing] = await db.query(
      "SELECT kycDocumentPath FROM users WHERE id = ?",
      [req.user.id]
    );

    await db.query(
      `
      UPDATE users
      SET
        kycDocumentType = ?,
        kycDocumentPath = ?,
        verificationStatus = 'pending',
        verificationNote = NULL,
        verifiedAt = NULL,
        verifiedBy = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [documentType, req.file.filename, req.user.id]
    );

    if (
      existing[0]?.kycDocumentPath &&
      existing[0].kycDocumentPath !== req.file.filename
    ) {
      deleteKycDocument(existing[0].kycDocumentPath);
    }

    res.json({
      success: true,
      message: "KYC submitted successfully. Admin review is pending.",
      verification_status: "pending",
    });
  } catch (error) {
    if (req.file) deleteKycDocument(req.file.filename);
    console.error("KYC submission error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit KYC",
    });
  }
};

export const getVerificationStatus = async (req, res) => {
  try {
    const [users] = await db.query(
      `
      SELECT
        verificationStatus AS verification_status,
        verificationNote AS verification_note,
        kycDocumentType AS document_type,
        verifiedAt AS verified_at
      FROM users
      WHERE id = ?
      `,
      [req.user.id]
    );

    res.json({ success: true, verification: users[0] });
  } catch (error) {
    console.error("Verification status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification status",
    });
  }
};

export const getVerifications = async (_req, res) => {
  try {
    const [verifications] = await db.query(
      `
      SELECT
        id,
        fullName AS name,
        email,
        phoneNumber AS phone,
        role,
        businessName AS business_name,
        city,
        state,
        kycDocumentType AS document_type,
        verificationStatus AS verification_status,
        verificationNote AS verification_note,
        verifiedAt AS verified_at,
        created_at
      FROM users
      WHERE role IN ('farmer', 'distributor')
        AND verificationStatus != 'unsubmitted'
      ORDER BY
        CASE verificationStatus
          WHEN 'pending' THEN 1
          WHEN 'rejected' THEN 2
          ELSE 3
        END,
        id DESC
      `
    );

    res.json({ success: true, verifications });
  } catch (error) {
    console.error("Admin verification list error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification requests",
    });
  }
};

export const reviewVerification = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const status = String(req.body.status || "").trim();
    const note = String(req.body.note || "").trim();

    if (!Number.isInteger(userId) || !["verified", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "A valid user and review status are required",
      });
    }

    if (status === "rejected" && !note) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required",
      });
    }

    const [result] = await db.query(
      `
      UPDATE users
      SET
        verificationStatus = ?,
        verificationNote = ?,
        verifiedAt = CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END,
        verifiedBy = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND role IN ('farmer', 'distributor')
        AND kycDocumentPath IS NOT NULL
      `,
      [status, note || null, status, req.user.id, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "KYC request not found",
      });
    }

    res.json({
      success: true,
      message:
        status === "verified"
          ? "User verification approved"
          : "User verification rejected",
    });
  } catch (error) {
    console.error("KYC review error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review KYC",
    });
  }
};

export const downloadKycDocument = async (req, res) => {
  try {
    const [users] = await db.query(
      `
      SELECT kycDocumentPath, kycDocumentType
      FROM users
      WHERE id = ? AND role IN ('farmer', 'distributor')
      `,
      [req.params.userId]
    );

    if (!users[0]?.kycDocumentPath) {
      return res.status(404).json({
        success: false,
        message: "KYC document not found",
      });
    }

    const absolutePath = resolveKycDocument(users[0].kycDocumentPath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "KYC document file is unavailable",
      });
    }

    res.download(
      absolutePath,
      `${users[0].kycDocumentType}-${req.params.userId}${absolutePath.slice(
        absolutePath.lastIndexOf(".")
      )}`
    );
  } catch (error) {
    console.error("KYC document download error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download KYC document",
    });
  }
};
