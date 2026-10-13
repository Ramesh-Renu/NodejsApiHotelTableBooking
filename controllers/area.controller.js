import { Op } from "sequelize";
import Area from "../models/area.model.js";
import Location from "../models/location.model.js";
import HotelTable from "../models/hotelTable.model.js";
import { sequelize } from "../config/db.js";

const cleanText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

// Hotels (deleted ones too: they keep their area) using an area.
const hotelCountOf = (areaId) =>
  HotelTable.count({ where: { area_id: areaId }, paranoid: false });

const findLocation = async (locationId) => {
  if (locationId === undefined || locationId === null || locationId === "") {
    return { value: null };
  }
  const location = await Location.findByPk(locationId);
  return location ? { value: location.id } : { error: "Location not found." };
};

const findDuplicateName = (name, exceptId) =>
  Area.findOne({
    where: {
      name: { [Op.iLike]: name },
      ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}),
    },
  });

export const createArea = async (req, res) => {
  try {
    const { description, location_id, location_name } = req.body;
    const name = cleanText(req.body.name);
    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const existing = await findDuplicateName(name);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `An area named "${existing.name}" already exists.`,
      });
    }

    let resolvedLocationId = null;
    if (location_id !== undefined && location_id !== null && location_id !== "") {
      const location = await findLocation(location_id);
      if (location.error) return res.status(404).json({ success: false, message: location.error });
      resolvedLocationId = location.value;
    } else if (cleanText(location_name)) {
      // Find or create the location by name (older clients).
      let loc = await Location.findOne({ where: { name: cleanText(location_name) } });
      if (!loc) loc = await Location.create({ name: cleanText(location_name) });
      resolvedLocationId = loc.id;
    }

    const area = await Area.create({
      name,
      description: cleanText(description),
      location_id: resolvedLocationId,
    });
    res.status(201).json({ success: true, message: "Area added successfully.", data: area });
  } catch (error) {
    console.error("Create area error:", error);
    res.status(500).json({ success: false, message: "Failed to create area" });
  }
};

/** GET ?location_id= — each area with hotel_count (hotels using it). */
export const getAllAreas = async (req, res) => {
  try {
    const where = {};
    if (req.query.location_id) where.location_id = req.query.location_id;

    const areas = await Area.findAll({
      where,
      attributes: {
        include: [
          [
            sequelize.literal(
              '(SELECT COUNT(*)::int FROM "hotel_tables" AS h WHERE h."area_id" = "Area"."id")',
            ),
            "hotel_count",
          ],
        ],
      },
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: areas });
  } catch (error) {
    console.error("Fetch areas error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch areas" });
  }
};

export const updateArea = async (req, res) => {
  try {
    const area = await Area.findByPk(req.params.id);
    if (!area) return res.status(404).json({ success: false, message: "Area not found." });

    const updates = {};
    if (req.body.name !== undefined) {
      updates.name = cleanText(req.body.name);
      if (!updates.name) {
        return res.status(400).json({ success: false, message: "name cannot be empty." });
      }
      const duplicate = await findDuplicateName(updates.name, area.id);
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `An area named "${duplicate.name}" already exists.`,
        });
      }
    }
    if (req.body.description !== undefined) updates.description = cleanText(req.body.description);
    if (req.body.location_id !== undefined) {
      const location = await findLocation(req.body.location_id);
      if (location.error) return res.status(404).json({ success: false, message: location.error });
      updates.location_id = location.value;
    }

    await area.update(updates);
    res.json({ success: true, message: "Area updated successfully.", data: area });
  } catch (error) {
    console.error("Update area error:", error);
    res.status(500).json({ success: false, message: "Failed to update area" });
  }
};

export const deleteArea = async (req, res) => {
  try {
    const area = await Area.findByPk(req.params.id);
    if (!area) return res.status(404).json({ success: false, message: "Area not found." });

    // Hotels point at their area; keep it while any hotel uses it.
    const hotels = await hotelCountOf(area.id);
    if (hotels > 0) {
      return res.status(409).json({
        success: false,
        message: `${area.name} is used by ${hotels} hotel(s). Move them to another area first.`,
      });
    }

    await area.destroy();
    res.json({ success: true, message: "Area deleted successfully." });
  } catch (error) {
    console.error("Delete area error:", error);
    res.status(500).json({ success: false, message: "Failed to delete area" });
  }
};

export default { createArea, getAllAreas, updateArea, deleteArea };
