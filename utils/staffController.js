import { Op } from "sequelize";
import HotelTable from "../models/hotelTable.model.js";

/**
 * CRUD handlers for kitchen / floor staff master data (cooks, servers).
 *
 *   Model       Sequelize model with <nameField>, <detailField>, photo_url,
 *               photo_file_id, hotel_id (nullable = all hotels), is_active
 *   nameField   e.g. "cook_name"
 *   detailField e.g. "speciality" / "section"
 *   usage       where this person is referenced: [{ Model, field, noun }],
 *               e.g. [{ Model: ReservationOrder, field: "cook_id", noun: "order" }]
 *   label       "Cook" / "Server" (used in messages)
 */
export const createStaffController = ({
  Model,
  nameField,
  detailField,
  usage = [],
  label,
}) => {
  const lower = label.toLowerCase();
  const hotelInclude = {
    model: HotelTable,
    as: "hotel",
    attributes: ["id", "hotel_name"],
  };

  const parseBoolean = (value) => {
    if (value === undefined) return undefined;
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return null;
  };

  const cleanText = (value) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  // Optional personal details / working hours. Only fields present in the
  // body are returned ("" clears one). { values } or { error }.
  const readPersonalFields = (body) => {
    const values = {};
    const text = (field) => {
      if (body[field] !== undefined) values[field] = cleanText(body[field]);
    };
    ["gender", "address", "emergency_contact"].forEach(text);

    if (body.phone !== undefined) {
      const phone = cleanText(body.phone);
      if (phone && !/^\+?[0-9][0-9\s-]{5,18}$/.test(phone)) {
        return { error: "Enter a valid phone number." };
      }
      values.phone = phone;
    }
    if (body.email !== undefined) {
      const email = cleanText(body.email);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "Enter a valid email address." };
      }
      values.email = email ? email.toLowerCase() : null;
    }
    for (const [field, label] of [
      ["date_of_birth", "Date of birth"],
      ["joined_on", "Joining date"],
    ]) {
      if (body[field] === undefined) continue;
      const date = cleanText(body[field]);
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) {
        return { error: `${label} must be a valid date.` };
      }
      values[field] = date;
    }
    for (const [field, label] of [
      ["shift_start", "Shift start"],
      ["shift_end", "Shift end"],
    ]) {
      if (body[field] === undefined) continue;
      const time = cleanText(body[field]);
      if (time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) {
        return { error: `${label} must be a time like 09:30.` };
      }
      values[field] = time;
    }
    return { values };
  };

  // "" / 0 / null mean "all hotels".
  const parseHotelId = async (value) => {
    if (value === undefined) return { value: undefined };
    if (value === null || value === "" || Number(value) === 0) return { value: null };
    const hotel = await HotelTable.findByPk(value);
    return hotel ? { value: hotel.id } : { error: "Hotel not found." };
  };

  /** GET ?hotel_id=&is_active=&search= (hotel_id also returns all-hotel staff) */
  const list = async (req, res) => {
    try {
      const { hotel_id, is_active, search } = req.query;
      const where = {};

      if (hotel_id) where.hotel_id = { [Op.or]: [Number(hotel_id), null] };

      const active = parseBoolean(is_active);
      if (active === null) {
        return res.status(400).json({
          success: false,
          message: "is_active must be true or false.",
        });
      }
      if (active !== undefined) where.is_active = active;

      const term = typeof search === "string" ? search.trim() : "";
      if (term) {
        where[Op.or] = [
          { [nameField]: { [Op.iLike]: `%${term}%` } },
          { [detailField]: { [Op.iLike]: `%${term}%` } },
        ];
      }

      const rows = await Model.findAll({
        where,
        include: [hotelInclude],
        order: [[nameField, "ASC"]],
      });
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error(`Get ${lower}s error:`, error);
      return res.status(500).json({ success: false, message: `Failed to fetch ${lower}s.` });
    }
  };

  const get = async (req, res) => {
    try {
      const row = await Model.findByPk(req.params.id, { include: [hotelInclude] });
      if (!row) {
        return res.status(404).json({ success: false, message: `${label} not found.` });
      }
      return res.json({ success: true, data: row });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  const create = async (req, res) => {
    try {
      const name = cleanText(req.body[nameField]);
      if (!name) {
        return res.status(400).json({ success: false, message: `${label} name is required.` });
      }

      const hotel = await parseHotelId(req.body.hotel_id);
      if (hotel.error) {
        return res.status(404).json({ success: false, message: hotel.error });
      }

      const personal = readPersonalFields(req.body);
      if (personal.error) {
        return res.status(400).json({ success: false, message: personal.error });
      }

      const row = await Model.create({
        ...personal.values,
        [nameField]: name,
        [detailField]: cleanText(req.body[detailField]),
        photo_url: cleanText(req.body.photo_url),
        photo_file_id: cleanText(req.body.photo_file_id),
        hotel_id: hotel.value ?? null,
        is_active: parseBoolean(req.body.is_active) ?? true,
      });

      return res.status(201).json({
        success: true,
        message: `${label} added successfully.`,
        data: row,
      });
    } catch (error) {
      console.error(`Create ${lower} error:`, error);
      return res.status(500).json({ success: false, message: `Failed to add ${lower}.` });
    }
  };

  const update = async (req, res) => {
    try {
      const row = await Model.findByPk(req.params.id);
      if (!row) {
        return res.status(404).json({ success: false, message: `${label} not found.` });
      }

      const updates = {};
      if (req.body[nameField] !== undefined) {
        updates[nameField] = cleanText(req.body[nameField]);
        if (!updates[nameField]) {
          return res.status(400).json({ success: false, message: `${label} name is required.` });
        }
      }
      for (const field of [detailField, "photo_url", "photo_file_id"]) {
        if (req.body[field] !== undefined) updates[field] = cleanText(req.body[field]);
      }
      const personal = readPersonalFields(req.body);
      if (personal.error) {
        return res.status(400).json({ success: false, message: personal.error });
      }
      Object.assign(updates, personal.values);
      if (req.body.is_active !== undefined) {
        const active = parseBoolean(req.body.is_active);
        if (active === null) {
          return res.status(400).json({
            success: false,
            message: "is_active must be true or false.",
          });
        }
        updates.is_active = active;
      }

      const hotel = await parseHotelId(req.body.hotel_id);
      if (hotel.error) {
        return res.status(404).json({ success: false, message: hotel.error });
      }
      if (hotel.value !== undefined) updates.hotel_id = hotel.value;

      await row.update(updates);
      return res.json({
        success: true,
        message: `${label} updated successfully.`,
        data: row,
      });
    } catch (error) {
      console.error(`Update ${lower} error:`, error);
      return res.status(500).json({ success: false, message: `Failed to update ${lower}.` });
    }
  };

  const remove = async (req, res) => {
    try {
      const row = await Model.findByPk(req.params.id);
      if (!row) {
        return res.status(404).json({ success: false, message: `${label} not found.` });
      }

      // Keep history intact: staff who have been assigned anywhere are
      // deactivated instead of deleted.
      for (const { Model: UsedBy, field, noun } of usage) {
        const assigned = await UsedBy.count({ where: { [field]: row.id } });
        if (assigned > 0) {
          return res.status(409).json({
            success: false,
            message: `${row[nameField]} is assigned to ${assigned} ${noun}(s). Mark the ${lower} inactive instead.`,
          });
        }
      }

      await row.destroy();
      return res.json({ success: true, message: `${label} deleted successfully.` });
    } catch (error) {
      console.error(`Delete ${lower} error:`, error);
      return res.status(500).json({ success: false, message: `Failed to delete ${lower}.` });
    }
  };

  return { list, get, create, update, remove };
};

/**
 * Validates a cook/server id for an assignment. Returns { staff } or
 * { error } (message for a 400 response).
 */
export const findAssignableStaff = async (Model, id, hotelId, { nameField, label }) => {
  const staff = await Model.findByPk(id);
  if (!staff || !staff.is_active) {
    return { error: `Select an active ${label}.` };
  }
  if (staff.hotel_id && Number(staff.hotel_id) !== Number(hotelId)) {
    return { error: `${staff[nameField]} does not work at this hotel.` };
  }
  return { staff };
};
