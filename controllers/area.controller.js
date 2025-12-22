import Area from "../models/area.model.js";
import Location from "../models/location.model.js";

export const createArea = async (req, res) => {
  try {
    const { name, description, location_id, location_name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const existing = await Area.findOne({ where: { name } });
    if (existing) return res.status(409).json({ success: false, message: "Area already exists" });

    let resolvedLocationId = location_id;
    if (!resolvedLocationId && location_name) {
      // try to find or create location by name
      let loc = await Location.findOne({ where: { name: location_name } });
      if (!loc) loc = await Location.create({ name: location_name });
      resolvedLocationId = loc.id;
    }

    const area = await Area.create({ name, description, location_id: resolvedLocationId });
    res.status(201).json({ success: true, data: area });
  } catch (error) {
    console.error("Create area error:", error);
    res.status(500).json({ success: false, message: "Failed to create area" });
  }
};

export const getAllAreas = async (req, res) => {
  try {
    const areas = await Area.findAll({ order: [["name", "ASC"]] });
    res.json({ success: true, data: areas });
  } catch (error) {
    console.error("Fetch areas error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch areas" });
  }
};

export default { createArea, getAllAreas };
