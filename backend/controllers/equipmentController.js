import { db } from "../config/db.js";
import { createNotification } from "../utils/notifications.js";

const categories = new Set([
  "tractor",
  "harvester",
  "rotavator",
  "sprayer",
  "irrigation",
  "transport",
  "other",
]);
const listingStatuses = new Set(["active", "inactive", "maintenance"]);
const dateOnly = (value) =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value || "").slice(0, 10);
const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const inclusiveDays = (start, end) =>
  Math.floor(
    (new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) /
      86400000
  ) + 1;

const listingFields = `
  e.id,
  e.ownerId AS owner_id,
  e.name,
  e.category,
  e.description,
  e.city,
  e.state,
  e.ratePerDay AS rate_per_day,
  e.securityDeposit AS security_deposit,
  e.totalUnits AS total_units,
  e.availableFrom AS available_from,
  e.availableUntil AS available_until,
  e.status,
  e.created_at,
  u.fullName AS owner_name,
  u.phoneNumber AS owner_phone,
  u.role AS owner_role,
  (u.verificationStatus = 'verified') AS owner_verified,
  GREATEST(
    e.totalUnits - COALESCE((
      SELECT SUM(eb.units)
      FROM equipment_bookings eb
      WHERE eb.equipmentId = e.id
        AND eb.status IN ('approved', 'active')
        AND CURRENT_DATE BETWEEN eb.startDate AND eb.endDate
    ), 0),
    0
  ) AS available_units_today
`;

export const getEquipment = async (req, res) => {
  try {
    const conditions = [
      "u.isActive = 1",
      "u.verificationStatus = 'verified'",
    ];
    const values = [];

    if (req.user.role !== "admin") conditions.push("e.status = 'active'");
    if (req.query.category) {
      conditions.push("e.category = ?");
      values.push(String(req.query.category));
    }
    if (req.query.city) {
      conditions.push("e.city LIKE ?");
      values.push(`%${String(req.query.city).trim().slice(0, 100)}%`);
    }
    if (req.query.state) {
      conditions.push("e.state LIKE ?");
      values.push(`%${String(req.query.state).trim().slice(0, 100)}%`);
    }
    if (req.query.search) {
      conditions.push("(e.name LIKE ? OR e.description LIKE ?)");
      const search = `%${String(req.query.search).trim().slice(0, 100)}%`;
      values.push(search, search);
    }

    const [equipment] = await db.query(
      `
      SELECT ${listingFields}
      FROM equipment_listings e
      INNER JOIN users u ON u.id = e.ownerId
      WHERE ${conditions.join(" AND ")}
      ORDER BY e.status = 'active' DESC, e.id DESC
      `,
      values
    );
    res.json({ success: true, equipment });
  } catch (error) {
    console.error("Get equipment error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch equipment" });
  }
};

export const createEquipment = async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      city,
      state,
      rate_per_day,
      security_deposit,
      total_units,
      available_from,
      available_until,
    } = req.body;
    const cleanName = String(name || "").trim();
    const start = String(available_from || "");
    const end = String(available_until || "");
    const rate = Number(rate_per_day);
    const deposit = Number(security_deposit || 0);
    const units = Number(total_units);

    if (
      cleanName.length < 3 ||
      cleanName.length > 150 ||
      !categories.has(String(category)) ||
      !String(city || "").trim() ||
      !String(state || "").trim() ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      !Number.isFinite(deposit) ||
      deposit < 0 ||
      !Number.isInteger(units) ||
      units < 1 ||
      units > 100 ||
      !validDate(start) ||
      !validDate(end) ||
      end < start
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid equipment, rate, units, location and availability dates",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO equipment_listings
      (
        ownerId, name, category, description, city, state, ratePerDay,
        securityDeposit, totalUnits, availableFrom, availableUntil
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        cleanName,
        category,
        String(description || "").trim().slice(0, 3000),
        String(city).trim().slice(0, 100),
        String(state).trim().slice(0, 100),
        rate,
        deposit,
        units,
        start,
        end,
      ]
    );
    res.status(201).json({
      success: true,
      message: "Equipment listing published",
      equipment_id: result.insertId,
    });
  } catch (error) {
    console.error("Create equipment error:", error);
    res.status(500).json({ success: false, message: "Failed to create equipment listing" });
  }
};

export const updateEquipment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await db.query(
      "SELECT * FROM equipment_listings WHERE id = ?",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Equipment not found" });
    }
    const current = rows[0];
    if (req.user.role !== "admin" && Number(current.ownerId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: "You do not own this listing" });
    }

    const status = String(req.body.status ?? current.status);
    const rate = Number(req.body.rate_per_day ?? current.ratePerDay);
    const deposit = Number(req.body.security_deposit ?? current.securityDeposit);
    const units = Number(req.body.total_units ?? current.totalUnits);
    const start = dateOnly(req.body.available_from ?? current.availableFrom);
    const end = dateOnly(req.body.available_until ?? current.availableUntil);
    if (
      !listingStatuses.has(status) ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      !Number.isFinite(deposit) ||
      deposit < 0 ||
      !Number.isInteger(units) ||
      units < 1 ||
      !validDate(start) ||
      !validDate(end) ||
      end < start
    ) {
      return res.status(400).json({ success: false, message: "Invalid listing update" });
    }

    await db.query(
      `
      UPDATE equipment_listings
      SET name = ?, category = ?, description = ?, city = ?, state = ?,
          ratePerDay = ?, securityDeposit = ?, totalUnits = ?,
          availableFrom = ?, availableUntil = ?, status = ?
      WHERE id = ?
      `,
      [
        String(req.body.name ?? current.name).trim().slice(0, 150),
        categories.has(String(req.body.category))
          ? String(req.body.category)
          : current.category,
        String(req.body.description ?? current.description ?? "").trim().slice(0, 3000),
        String(req.body.city ?? current.city).trim().slice(0, 100),
        String(req.body.state ?? current.state).trim().slice(0, 100),
        rate,
        deposit,
        units,
        start,
        end,
        status,
        id,
      ]
    );
    res.json({ success: true, message: "Equipment listing updated" });
  } catch (error) {
    console.error("Update equipment error:", error);
    res.status(500).json({ success: false, message: "Failed to update equipment" });
  }
};

export const getEquipmentBookings = async (req, res) => {
  try {
    const values = [];
    let scope = "";
    if (req.user.role !== "admin") {
      scope = "WHERE eb.renterId = ? OR eb.ownerId = ?";
      values.push(req.user.id, req.user.id);
    }
    const [bookings] = await db.query(
      `
      SELECT
        eb.id,
        eb.equipmentId AS equipment_id,
        eb.renterId AS renter_id,
        eb.ownerId AS owner_id,
        eb.startDate AS start_date,
        eb.endDate AS end_date,
        eb.rentalDays AS rental_days,
        eb.units,
        eb.ratePerDay AS rate_per_day,
        eb.securityDeposit AS security_deposit,
        eb.totalAmount AS total_amount,
        eb.deliveryAddress AS delivery_address,
        eb.status,
        eb.notes,
        eb.created_at,
        e.name AS equipment_name,
        e.category,
        r.fullName AS renter_name,
        o.fullName AS owner_name
      FROM equipment_bookings eb
      INNER JOIN equipment_listings e ON e.id = eb.equipmentId
      INNER JOIN users r ON r.id = eb.renterId
      INNER JOIN users o ON o.id = eb.ownerId
      ${scope}
      ORDER BY eb.id DESC
      `,
      values
    );
    res.json({ success: true, bookings });
  } catch (error) {
    console.error("Get equipment bookings error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch rental bookings" });
  }
};

export const createEquipmentBooking = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const equipmentId = Number(req.params.id);
    const start = String(req.body.start_date || "");
    const end = String(req.body.end_date || "");
    const units = Number(req.body.units || 1);
    const address = String(req.body.delivery_address || "").trim();
    const today = new Date().toISOString().slice(0, 10);
    if (
      !validDate(start) ||
      !validDate(end) ||
      start < today ||
      end < start ||
      !Number.isInteger(units) ||
      units < 1 ||
      address.length < 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid future dates, unit count and delivery address are required",
      });
    }

    await connection.beginTransaction();
    const [listings] = await connection.query(
      `
      SELECT * FROM equipment_listings
      WHERE id = ? AND status = 'active'
      FOR UPDATE
      `,
      [equipmentId]
    );
    if (!listings.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Equipment is not available" });
    }
    const equipment = listings[0];
    if (Number(equipment.ownerId) === Number(req.user.id)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "You cannot rent your own equipment" });
    }
    if (start < dateOnly(equipment.availableFrom) || end > dateOnly(equipment.availableUntil)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Requested dates are outside the listing availability window",
      });
    }
    const [[reserved]] = await connection.query(
      `
      SELECT COALESCE(SUM(units), 0) AS units
      FROM equipment_bookings
      WHERE equipmentId = ?
        AND status IN ('approved', 'active')
        AND startDate <= ?
        AND endDate >= ?
      `,
      [equipmentId, end, start]
    );
    if (Number(reserved.units) + units > Number(equipment.totalUnits)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Requested units are not available for these dates",
      });
    }

    const days = inclusiveDays(start, end);
    const total =
      Number(equipment.ratePerDay) * days * units +
      Number(equipment.securityDeposit);
    const [result] = await connection.query(
      `
      INSERT INTO equipment_bookings
      (
        equipmentId, renterId, ownerId, startDate, endDate, rentalDays,
        units, ratePerDay, securityDeposit, totalAmount, deliveryAddress, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        equipmentId,
        req.user.id,
        equipment.ownerId,
        start,
        end,
        days,
        units,
        equipment.ratePerDay,
        equipment.securityDeposit,
        total,
        address.slice(0, 500),
        String(req.body.notes || "").trim().slice(0, 1000),
      ]
    );
    await createNotification(connection, {
      userId: equipment.ownerId,
      type: "equipment_booking",
      title: "New equipment rental request",
      message: `${req.user.name} requested ${equipment.name} for ${days} day(s).`,
      relatedType: "equipment_booking",
      relatedId: result.insertId,
    });
    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Rental request submitted",
      booking_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create equipment booking error:", error);
    res.status(500).json({ success: false, message: "Failed to create rental request" });
  } finally {
    connection.release();
  }
};

export const updateEquipmentBookingStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const id = Number(req.params.id);
    const next = String(req.body.status || "");
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `
      SELECT eb.*, e.name AS equipmentName, e.totalUnits
      FROM equipment_bookings eb
      INNER JOIN equipment_listings e ON e.id = eb.equipmentId
      WHERE eb.id = ?
      FOR UPDATE
      `,
      [id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Rental booking not found" });
    }
    const booking = rows[0];
    const isAdmin = req.user.role === "admin";
    const isOwner = Number(booking.ownerId) === Number(req.user.id);
    const isRenter = Number(booking.renterId) === Number(req.user.id);
    const ownerTransitions = {
      requested: ["approved", "rejected"],
      approved: ["active"],
      active: ["completed"],
    };
    const renterCanCancel =
      isRenter &&
      ["requested", "approved"].includes(booking.status) &&
      next === "cancelled";
    const managerCanUpdate =
      (isAdmin || isOwner) &&
      (ownerTransitions[booking.status] || []).includes(next);
    if (!renterCanCancel && !managerCanUpdate) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: "Status transition is not allowed" });
    }

    if (next === "approved") {
      const [[reserved]] = await connection.query(
        `
        SELECT COALESCE(SUM(units), 0) AS units
        FROM equipment_bookings
        WHERE equipmentId = ?
          AND id != ?
          AND status IN ('approved', 'active')
          AND startDate <= ?
          AND endDate >= ?
        `,
        [booking.equipmentId, id, dateOnly(booking.endDate), dateOnly(booking.startDate)]
      );
      if (Number(reserved.units) + Number(booking.units) > Number(booking.totalUnits)) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "Capacity is no longer available for these dates",
        });
      }
    }

    await connection.query(
      `
      UPDATE equipment_bookings
      SET status = ?, reviewedAt = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [next, id]
    );
    const notifyUserId = isRenter ? booking.ownerId : booking.renterId;
    await createNotification(connection, {
      userId: notifyUserId,
      type: "equipment_booking",
      title: "Equipment booking updated",
      message: `${booking.equipmentName} rental is now ${next}.`,
      relatedType: "equipment_booking",
      relatedId: id,
    });
    await connection.commit();
    res.json({ success: true, message: `Rental booking ${next}` });
  } catch (error) {
    await connection.rollback();
    console.error("Update equipment booking error:", error);
    res.status(500).json({ success: false, message: "Failed to update rental booking" });
  } finally {
    connection.release();
  }
};
