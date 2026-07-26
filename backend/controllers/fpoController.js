import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const clean = (value, max = 255) =>
  String(value || "").trim().slice(0, max);

const getManagedFpo = async (database, fpoId, userId) => {
  const [rows] = await database.query(
    `
    SELECT f.id, f.name
    FROM fpos f
    INNER JOIN fpo_members fm ON fm.fpoId = f.id
    WHERE f.id = ? AND fm.userId = ?
      AND fm.status = 'active'
      AND fm.memberRole = 'manager'
      AND f.status = 'active'
    `,
    [fpoId, userId]
  );
  return rows[0];
};

export const createFpo = async (req, res) => {
  let connection;
  try {
    const name = clean(req.body.name, 150);
    const registrationNumber = clean(req.body.registration_number, 100);
    const district = clean(req.body.district || req.user.city, 100);
    const state = clean(req.body.state || req.user.state, 100);
    const address = clean(req.body.address, 500);
    const description = clean(req.body.description, 2000);

    if (name.length < 3 || !registrationNumber || !district || !state) {
      return res.status(400).json({
        success: false,
        message: "FPO name, registration number, district and state are required",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [owned] = await connection.query(
      "SELECT id FROM fpos WHERE ownerId = ? FOR UPDATE",
      [req.user.id]
    );
    if (owned.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "You already manage an FPO workspace",
      });
    }

    const [result] = await connection.query(
      `
      INSERT INTO fpos
        (ownerId, name, registrationNumber, district, state, address, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        name,
        registrationNumber,
        district,
        state,
        address,
        description,
      ]
    );
    await connection.query(
      `
      INSERT INTO fpo_members
        (fpoId, userId, invitedBy, memberRole, status, joinedAt)
      VALUES (?, ?, ?, 'manager', 'active', CURRENT_TIMESTAMP)
      `,
      [result.insertId, req.user.id, req.user.id]
    );

    await connection.commit();
    res.status(201).json({
      success: true,
      message: "FPO workspace created successfully",
      fpo_id: result.insertId,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Create FPO error:", error);
    const duplicate = error?.code === "ER_DUP_ENTRY";
    res.status(duplicate ? 409 : 500).json({
      success: false,
      message: duplicate
        ? "This FPO registration number is already registered"
        : "Failed to create FPO workspace",
    });
  } finally {
    if (connection) connection.release();
  }
};

export const getMyFpo = async (req, res) => {
  try {
    const [invitations] = await db.query(
      `
      SELECT
        fm.id,
        fm.fpoId AS fpo_id,
        f.name AS fpo_name,
        f.district,
        f.state,
        inviter.fullName AS invited_by,
        fm.created_at
      FROM fpo_members fm
      INNER JOIN fpos f ON fm.fpoId = f.id
      INNER JOIN users inviter ON fm.invitedBy = inviter.id
      WHERE fm.userId = ? AND fm.status = 'pending' AND f.status = 'active'
      ORDER BY fm.id DESC
      `,
      [req.user.id]
    );

    const [memberships] = await db.query(
      `
      SELECT
        f.id,
        f.name,
        f.registrationNumber AS registration_number,
        f.district,
        f.state,
        f.address,
        f.description,
        f.plan,
        f.status,
        f.ownerId AS owner_id,
        fm.memberRole AS my_role,
        f.created_at
      FROM fpo_members fm
      INNER JOIN fpos f ON fm.fpoId = f.id
      WHERE fm.userId = ? AND fm.status = 'active' AND f.status = 'active'
      ORDER BY (f.ownerId = ?) DESC, fm.id DESC
      LIMIT 1
      `,
      [req.user.id, req.user.id]
    );

    if (!memberships.length) {
      return res.json({
        success: true,
        fpo: null,
        members: [],
        inventory: [],
        invitations,
      });
    }

    const fpo = memberships[0];
    const [members] = await db.query(
      `
      SELECT
        fm.id AS membership_id,
        u.id AS user_id,
        u.fullName AS name,
        u.email,
        u.phoneNumber AS phone,
        u.city,
        u.state,
        u.businessName AS business_name,
        u.verificationStatus AS verification_status,
        fm.memberRole AS member_role,
        fm.status,
        fm.joinedAt AS joined_at
      FROM fpo_members fm
      INNER JOIN users u ON fm.userId = u.id
      WHERE fm.fpoId = ? AND fm.status IN ('active', 'pending')
      ORDER BY fm.memberRole = 'manager' DESC, fm.id ASC
      `,
      [fpo.id]
    );
    const [inventory] = await db.query(
      `
      SELECT
        p.id,
        p.productName AS crop_name,
        p.category,
        p.quantity,
        p.unit,
        p.price AS price_per_unit,
        p.qualityGrade AS quality_grade,
        p.status,
        u.fullName AS farmer_name
      FROM products p
      INNER JOIN users u ON p.farmerId = u.id
      INNER JOIN fpo_members fm ON fm.userId = p.farmerId
      WHERE fm.fpoId = ? AND fm.status = 'active'
      ORDER BY p.status = 'available' DESC, p.id DESC
      `,
      [fpo.id]
    );
    const [[summary]] = await db.query(
      `
      SELECT
        COUNT(DISTINCT CASE WHEN fm.status = 'active' THEN fm.userId END)
          AS active_members,
        COUNT(DISTINCT CASE WHEN p.status = 'available' THEN p.id END)
          AS active_products,
        COALESCE(SUM(
          CASE WHEN p.status = 'available' THEN p.quantity * p.price ELSE 0 END
        ), 0) AS inventory_value
      FROM fpo_members fm
      LEFT JOIN products p ON p.farmerId = fm.userId
      WHERE fm.fpoId = ?
      `,
      [fpo.id]
    );

    res.json({
      success: true,
      fpo: { ...fpo, summary },
      members,
      inventory,
      invitations,
    });
  } catch (error) {
    console.error("Get FPO workspace error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load FPO workspace",
    });
  }
};

export const inviteFpoMember = async (req, res) => {
  try {
    const fpoId = Number(req.params.id);
    const email = clean(req.body.email, 150).toLowerCase();
    if (!Number.isInteger(fpoId) || !email) {
      return res.status(400).json({
        success: false,
        message: "A valid FPO and farmer email are required",
      });
    }

    const fpo = await getManagedFpo(db, fpoId, req.user.id);
    if (!fpo) {
      return res.status(404).json({
        success: false,
        message: "FPO workspace not found or manager access required",
      });
    }

    const [farmers] = await db.query(
      `
      SELECT id, fullName
      FROM users
      WHERE email = ? AND role = 'farmer' AND isActive = 1
        AND verificationStatus = 'verified'
      `,
      [email]
    );
    if (!farmers.length || Number(farmers[0].id) === Number(req.user.id)) {
      return res.status(404).json({
        success: false,
        message: "Verified farmer account not found",
      });
    }

    const farmer = farmers[0];
    const [existing] = await db.query(
      "SELECT id, status FROM fpo_members WHERE fpoId = ? AND userId = ?",
      [fpoId, farmer.id]
    );
    if (existing[0]?.status === "active" || existing[0]?.status === "pending") {
      return res.status(409).json({
        success: false,
        message: "This farmer is already a member or has a pending invitation",
      });
    }

    if (existing.length) {
      await db.query(
        `
        UPDATE fpo_members
        SET invitedBy = ?, memberRole = 'member', status = 'pending',
          joinedAt = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [req.user.id, existing[0].id]
      );
    } else {
      await db.query(
        `
        INSERT INTO fpo_members
          (fpoId, userId, invitedBy, memberRole, status)
        VALUES (?, ?, ?, 'member', 'pending')
        `,
        [fpoId, farmer.id, req.user.id]
      );
    }

    await createNotification(db, {
      userId: farmer.id,
      type: "fpo_invitation",
      title: "FPO membership invitation",
      message: `${req.user.name} invited you to join ${fpo.name}.`,
      relatedType: "fpo",
      relatedId: fpoId,
    });

    res.status(201).json({
      success: true,
      message: "Farmer invitation sent successfully",
    });
  } catch (error) {
    console.error("Invite FPO member error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send FPO invitation",
    });
  }
};

export const respondFpoInvitation = async (req, res) => {
  let connection;
  try {
    const invitationId = Number(req.params.id);
    const response = clean(req.body.response, 20).toLowerCase();
    if (!Number.isInteger(invitationId) || !["accept", "decline"].includes(response)) {
      return res.status(400).json({
        success: false,
        message: "Response must be accept or decline",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `
      SELECT fm.*, f.name, f.ownerId
      FROM fpo_members fm
      INNER JOIN fpos f ON fm.fpoId = f.id
      WHERE fm.id = ? AND fm.userId = ? AND fm.status = 'pending'
      FOR UPDATE
      `,
      [invitationId, req.user.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Pending FPO invitation not found",
      });
    }

    const invitation = rows[0];
    await connection.query(
      `
      UPDATE fpo_members
      SET status = ?, joinedAt = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        response === "accept" ? "active" : "declined",
        response === "accept" ? new Date() : null,
        invitationId,
      ]
    );
    await createNotification(connection, {
      userId: invitation.ownerId,
      type: "fpo_invitation_response",
      title: `FPO invitation ${response === "accept" ? "accepted" : "declined"}`,
      message: `${req.user.name} ${
        response === "accept" ? "accepted" : "declined"
      } the invitation to ${invitation.name}.`,
      relatedType: "fpo",
      relatedId: invitation.fpoId,
    });

    await connection.commit();
    res.json({
      success: true,
      message: `FPO invitation ${
        response === "accept" ? "accepted" : "declined"
      } successfully`,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Respond FPO invitation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update FPO invitation",
    });
  } finally {
    if (connection) connection.release();
  }
};

export const removeFpoMember = async (req, res) => {
  try {
    const fpoId = Number(req.params.id);
    const userId = Number(req.params.userId);
    const fpo = await getManagedFpo(db, fpoId, req.user.id);
    if (!fpo) {
      return res.status(404).json({
        success: false,
        message: "FPO workspace not found or manager access required",
      });
    }
    if (userId === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "The FPO owner cannot remove their own manager membership",
      });
    }

    const [result] = await db.query(
      `
      UPDATE fpo_members
      SET status = 'removed', updated_at = CURRENT_TIMESTAMP
      WHERE fpoId = ? AND userId = ? AND memberRole != 'manager'
        AND status IN ('active', 'pending')
      `,
      [fpoId, userId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "FPO member not found",
      });
    }
    await createNotification(db, {
      userId,
      type: "fpo_membership_removed",
      title: "FPO membership updated",
      message: `Your membership in ${fpo.name} was removed.`,
      relatedType: "fpo",
      relatedId: fpoId,
    });
    res.json({ success: true, message: "FPO member removed successfully" });
  } catch (error) {
    console.error("Remove FPO member error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove FPO member",
    });
  }
};
