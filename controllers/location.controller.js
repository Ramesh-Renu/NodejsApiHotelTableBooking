import { Op } from "sequelize";
import Location from "../models/location.model.js";
import Area from "../models/area.model.js";
import { sequelize } from "../config/db.js";
import HotelTable from "../models/hotelTable.model.js";

const cleanText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const findDuplicateName = (name, exceptId) =>
  Location.findOne({
    where: {
      name: { [Op.iLike]: name },
      ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}),
    },
  });

export const createLocation = async (req, res) => {
  try {
    const name = cleanText(req.body.name);
    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const existing = await findDuplicateName(name);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A location named "${existing.name}" already exists.`,
      });
    }

    const location = await Location.create({ name, description: cleanText(req.body.description) });
    res.status(201).json({ success: true, message: "Location added successfully.", data: location });
  } catch (error) {
    console.error("Create location error:", error);
    res.status(500).json({ success: false, message: "Failed to create location" });
  }
};

/** Each location with area_count and hotel_count (what uses it). */
export const getAllLocations = async (req, res) => {
  try {
    const locations = await Location.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(
              '(SELECT COUNT(*)::int FROM "areas" AS a WHERE a."location_id" = "Location"."id")',
            ),
            "area_count",
          ],
          [
            sequelize.literal(
              '(SELECT COUNT(*)::int FROM "hotel_tables" AS h WHERE h."location_id" = "Location"."id")',
            ),
            "hotel_count",
          ],
        ],
      },
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: locations });
  } catch (error) {
    console.error("Fetch locations error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch locations" });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: "Location not found." });

    const updates = {};
    if (req.body.name !== undefined) {
      updates.name = cleanText(req.body.name);
      if (!updates.name) {
        return res.status(400).json({ success: false, message: "name cannot be empty." });
      }
      const duplicate = await findDuplicateName(updates.name, location.id);
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `A location named "${duplicate.name}" already exists.`,
        });
      }
    }
    if (req.body.description !== undefined) updates.description = cleanText(req.body.description);

    await location.update(updates);
    res.json({ success: true, message: "Location updated successfully.", data: location });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({ success: false, message: "Failed to update location" });
  }
};

export const deleteLocation = async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: "Location not found." });

    // Areas and hotels (deleted ones too) point at their location.
    const [areas, hotels] = await Promise.all([
      Area.count({ where: { location_id: location.id } }),
      HotelTable.count({ where: { location_id: location.id }, paranoid: false }),
    ]);
    if (areas || hotels) {
      const parts = [
        areas && `${areas} area(s)`,
        hotels && `${hotels} hotel(s)`,
      ].filter(Boolean);
      return res.status(409).json({
        success: false,
        message: `${location.name} is used by ${parts.join(" and ")}. Move them to another location first.`,
      });
    }

    await location.destroy();
    res.json({ success: true, message: "Location deleted successfully." });
  } catch (error) {
    console.error("Delete location error:", error);
    res.status(500).json({ success: false, message: "Failed to delete location" });
  }
};

// Create Location entries for each distinct HotelTable.location and set hotel.location_id
export const bulkAssignLocations = async (req, res) => {
  try {
    const hotels = await HotelTable.findAll({ attributes: ["id", "location"] });

    const map = new Map();
    for (const h of hotels) {
      const name = (h.location || "").trim();
      if (!name) continue;
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(h.id);
    }

    const results = [];
    for (const [name, hotelIds] of map.entries()) {
      let location = await Location.findOne({ where: { name } });
      if (!location) location = await Location.create({ name });

      await HotelTable.update({ location_id: location.id }, { where: { id: hotelIds } });
      results.push({ name, location_id: location.id, hotelsUpdated: hotelIds.length });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Bulk assign locations error:", error);
    res.status(500).json({ success: false, message: "Failed to bulk assign locations" });
  }
};

export default {
  createLocation,
  getAllLocations,
  updateLocation,
  deleteLocation,
  bulkAssignLocations,
};
