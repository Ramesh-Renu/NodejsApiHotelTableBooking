import Location from "../models/location.model.js";
import HotelTable from "../models/hotelTable.model.js";

export const createLocation = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const existing = await Location.findOne({ where: { name } });
    if (existing) return res.status(409).json({ success: false, message: "Location already exists" });

    const location = await Location.create({ name, description });
    res.status(201).json({ success: true, data: location });
  } catch (error) {
    console.error("Create location error:", error);
    res.status(500).json({ success: false, message: "Failed to create location" });
  }
};

export const getAllLocations = async (req, res) => {
  try {
    const locations = await Location.findAll({ order: [["name", "ASC"]] });
    res.json({ success: true, data: locations });
  } catch (error) {
    console.error("Fetch locations error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch locations" });
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

export default { createLocation, getAllLocations, bulkAssignLocations };
