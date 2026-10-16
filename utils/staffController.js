import { Op } from "sequelize";
import HotelTable from "../models/hotelTable.model.js";
import Floor from "../models/floor.model.js";
import Area from "../models/area.model.js";
import {
  accessRemovedAttribute,
  isAccessRemoved,
  isUnassignable,
  linkStaffAccount,
  linkedAccountHotelIds,
  linkedUsersForHotel,
  releaseStaffAccount,
  syncStaffAccount,
  unassignableUsers,
} from "./staffAccount.js";

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
  const accountOptions = { label, nameField };
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
    for (const field of ["location_id", "area_id", "floor_id"]) {
      if (body[field] === undefined) continue;
      if (body[field] === null || body[field] === "") {
        values[field] = null;
        continue;
      }
      const id = Number(body[field]);
      if (!Number.isInteger(id) || id < 1) {
        return { error: `${field} must be a valid id.` };
      }
      values[field] = id;
    }
    return { values };
  };

  /**
   * Location / area / floor must fit together: with a hotel they come from
   * that hotel (the floor must be one of its floors); without one, the area
   * must be in the chosen location and no floor can be set.
   * Fills `values` in place; returns an error message or null.
   */
  const checkPlace = async (values, hotelId) => {
    if (hotelId) {
      const hotel = await HotelTable.findByPk(hotelId, {
        attributes: ["id", "location_id", "area_id"],
      });
      if (hotel) {
        values.location_id = hotel.location_id ?? null;
        values.area_id = hotel.area_id ?? null;
      }
    }
    if (values.floor_id) {
      if (!hotelId) return "Choose a hotel before picking a floor.";
      const floor = await Floor.findByPk(values.floor_id, {
        attributes: ["id", "hotel_table_id"],
      });
      if (!floor || Number(floor.hotel_table_id) !== Number(hotelId)) {
        return "That floor is not in the selected hotel.";
      }
    }
    if (!hotelId && values.area_id) {
      const area = await Area.findByPk(values.area_id, { attributes: ["id", "location_id"] });
      if (!area) return "Area not found.";
      if (values.location_id && area.location_id && Number(area.location_id) !== Number(values.location_id)) {
        return "That area is not in the selected location.";
      }
      if (!values.location_id) values.location_id = area.location_id ?? null;
    }
    return null;
  };

  // "" / 0 / null mean "all hotels".
  const parseHotelId = async (value) => {
    if (value === undefined) return { value: undefined };
    if (value === null || value === "" || Number(value) === 0) return { value: null };
    const hotel = await HotelTable.findByPk(value);
    return hotel ? { value: hotel.id } : { error: "Hotel not found." };
  };

  /**
   * GET ?hotel_id=&floor_id=&is_active=&search=
   * With hotel_id: only staff relevant to that hotel — assigned to it, or
   * working at all hotels with no location / area limit that rules it out.
   * With floor_id too: staff on that floor or with no floor set.
   * Also staff whose Staff user (login) has that hotel — the hotels can be
   * changed in Settings → Staff users, including more than one.
   * With hotel_id (a pick list), Managers are left out: they supervise.
   */
  const list = async (req, res) => {
    try {
      const { hotel_id, floor_id, is_active, search } = req.query;
      const where = {};
      const and = [];

      if (hotel_id) {
        const hotel = await HotelTable.findByPk(hotel_id, {
          attributes: ["id", "location_id", "area_id"],
          paranoid: false,
        });
        const allHotels = { hotel_id: null };
        if (hotel?.location_id) {
          allHotels.location_id = { [Op.or]: [null, hotel.location_id] };
        }
        if (hotel?.area_id) {
          allHotels.area_id = { [Op.or]: [null, hotel.area_id] };
        }
        const atHotel = [{ [Op.or]: [{ hotel_id: Number(hotel_id) }, allHotels] }];
        if (floor_id) {
          atHotel.push({ floor_id: { [Op.or]: [null, Number(floor_id)] } });
        }
        const linkedUsers = linkedUsersForHotel(hotel_id);
        and.push(
          linkedUsers
            ? { [Op.or]: [{ [Op.and]: atHotel }, { user_id: { [Op.in]: linkedUsers } }] }
            : { [Op.and]: atHotel },
        );
        and.push({
          [Op.or]: [{ user_id: null }, { user_id: { [Op.notIn]: unassignableUsers() } }],
        });
      }
      if (and.length) where[Op.and] = and;

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
        // access_removed: their login is in User Management → Inactive users.
        attributes: { include: [accessRemovedAttribute(Model)] },
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
      const row = await Model.findByPk(req.params.id, {
        attributes: { include: [accessRemovedAttribute(Model)] },
        include: [hotelInclude],
      });
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
      const placeError = await checkPlace(personal.values, hotel.value ?? null);
      if (placeError) {
        return res.status(400).json({ success: false, message: placeError });
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

      // Their Staff user (sign-in), when the phone is a 10-digit mobile.
      const accountNote = await linkStaffAccount(row, accountOptions, req);

      return res.status(201).json({
        success: true,
        message: `${label} added successfully. ${accountNote}`,
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
        // A removed login is brought back from Inactive users, not here.
        if (active && !row.is_active && (await isAccessRemoved(row))) {
          return res.status(409).json({
            success: false,
            message: `${row[nameField]}'s access was removed. Retrieve them in User Management → Inactive users to activate.`,
          });
        }
      }

      const hotel = await parseHotelId(req.body.hotel_id);
      if (hotel.error) {
        return res.status(404).json({ success: false, message: hotel.error });
      }
      if (hotel.value !== undefined) updates.hotel_id = hotel.value;

      // A new hotel makes the old floor meaningless unless a new one is sent.
      const hotelId = updates.hotel_id !== undefined ? updates.hotel_id : row.hotel_id;
      if (
        updates.hotel_id !== undefined &&
        updates.hotel_id !== row.hotel_id &&
        updates.floor_id === undefined
      ) {
        updates.floor_id = null;
      }
      const placeError = await checkPlace(updates, hotelId);
      if (placeError) {
        return res.status(400).json({ success: false, message: placeError });
      }

      const before = { phone: row.phone, hotel_id: row.hotel_id };
      await row.update(updates);
      const accountNote = await syncStaffAccount(row, accountOptions, req, before);
      return res.json({
        success: true,
        message: `${label} updated successfully.${accountNote ? ` ${accountNote}` : ""}`,
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

      await releaseStaffAccount(row, req.user?.id ?? null);
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
  if (await isUnassignable(staff)) {
    return { error: `${staff[nameField]} is a Manager and can't be assigned as a ${label}.` };
  }
  // Their Staff user's hotels (Settings → Staff users) count too.
  const accountHotels = await linkedAccountHotelIds(staff);
  if (accountHotels === null || accountHotels?.includes(Number(hotelId))) {
    return { staff };
  }
  if (staff.hotel_id && Number(staff.hotel_id) !== Number(hotelId)) {
    return { error: `${staff[nameField]} does not work at this hotel.` };
  }
  // "All hotels" staff limited to a location / area only work there.
  if (!staff.hotel_id && (staff.location_id || staff.area_id)) {
    const hotel = await HotelTable.findByPk(hotelId, {
      attributes: ["location_id", "area_id"],
      paranoid: false,
    });
    const outside =
      (staff.location_id && hotel?.location_id && Number(staff.location_id) !== Number(hotel.location_id)) ||
      (staff.area_id && hotel?.area_id && Number(staff.area_id) !== Number(hotel.area_id));
    if (outside) {
      return { error: `${staff[nameField]} does not work in this hotel's area.` };
    }
  }
  return { staff };
};
