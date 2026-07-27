import { Op } from "sequelize";
import SpiceLevelMaster from "../models/spiceLevelMaster.model.js";
import { SPICE_LEVELS } from "../utils/spiceLevel.js";

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
};

export const createSpiceLevel = async (req, res) => {
  try {
    const { spice_level, description, display_order, is_active } = req.body;
    const spiceLevel =
      typeof spice_level === "string" ? spice_level.trim().toUpperCase() : "";

    if (!spiceLevel) {
      return res.status(400).json({
        success: false,
        message: "spice_level is required.",
      });
    }

    const exists = await SpiceLevelMaster.findOne({
      where: { spice_level: { [Op.iLike]: spiceLevel } },
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Spice level already exists.",
      });
    }

    const spice = await SpiceLevelMaster.create({
      spice_level: spiceLevel,
      description,
      display_order,
      is_active,
    });

    return res.status(201).json({
      success: true,
      message: "Spice level created successfully.",
      data: spice,
    });
  } catch (error) {
    console.error("Create spice level error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create spice level.",
    });
  }
};

export const getSpiceLevels = async (req, res) => {
  try {
    let { page = 1, limit = 10, search, is_active } = req.query;
    page = Number(page);
    limit = Number(limit);

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({
        success: false,
        message: "page and limit must be positive integers.",
      });
    }

    const where = {};
    const active = parseBoolean(is_active);

    if (active === null) {
      return res.status(400).json({
        success: false,
        message: "is_active must be true or false.",
      });
    }

    if (active !== undefined) where.is_active = active;

    const searchTerm = typeof search === "string" ? search.trim() : "";
    if (searchTerm) {
      where.spice_level = { [Op.iLike]: `%${searchTerm}%` };
    }

    const { rows, count } = await SpiceLevelMaster.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [
        ["display_order", "ASC"],
        ["spice_level", "ASC"],
      ],
    });

    return res.json({
      success: true,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      data: rows,
    });
  } catch (error) {
    console.error("Fetch spice levels error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch spice levels.",
    });
  }
};

export const getSpiceLevelById = async (req, res) => {
  try {
    const spice = await SpiceLevelMaster.findByPk(req.params.id);

    if (!spice) {
      return res.status(404).json({
        success: false,
        message: "Spice level not found.",
      });
    }

    return res.json({ success: true, data: spice });
  } catch (error) {
    console.error("Fetch spice level error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch spice level.",
    });
  }
};

export const updateSpiceLevel = async (req, res) => {
  try {
    const spice = await SpiceLevelMaster.findByPk(req.params.id);

    if (!spice) {
      return res.status(404).json({
        success: false,
        message: "Spice level not found.",
      });
    }

    const updates = {};
    for (const field of ["description", "display_order", "is_active"]) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (req.body.spice_level !== undefined) {
      if (typeof req.body.spice_level !== "string" || !req.body.spice_level.trim()) {
        return res.status(400).json({
          success: false,
          message: "spice_level must be a non-empty string.",
        });
      }

      updates.spice_level = req.body.spice_level.trim().toUpperCase();

      const duplicate = await SpiceLevelMaster.findOne({
        where: {
          spice_level: { [Op.iLike]: updates.spice_level },
          id: { [Op.ne]: spice.id },
        },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Spice level already exists.",
        });
      }
    }

    await spice.update(updates);

    return res.json({
      success: true,
      message: "Spice level updated successfully.",
      data: spice,
    });
  } catch (error) {
    console.error("Update spice level error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update spice level.",
    });
  }
};

export const deleteSpiceLevel = async (req, res) => {
  try {
    const spice = await SpiceLevelMaster.findByPk(req.params.id);

    if (!spice) {
      return res.status(404).json({
        success: false,
        message: "Spice level not found.",
      });
    }

    await spice.destroy();

    return res.json({
      success: true,
      message: "Spice level deleted successfully.",
    });
  } catch (error) {
    console.error("Delete spice level error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete spice level.",
    });
  }
};

export const seedSpiceLevels = async (req, res) => {
  try {
    await SpiceLevelMaster.bulkCreate(SPICE_LEVELS, {
      updateOnDuplicate: ["display_order"],
    });

    const spices = await SpiceLevelMaster.findAll({
      order: [["display_order", "ASC"]],
    });

    return res.json({
      success: true,
      message: "Spice levels seeded successfully.",
      data: spices,
    });
  } catch (error) {
    console.error("Seed spice levels error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to seed spice levels.",
    });
  }
};
