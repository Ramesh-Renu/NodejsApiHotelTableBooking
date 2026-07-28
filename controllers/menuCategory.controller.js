import { Op } from "sequelize";
import MenuCategory from "../models/menuCategory.model.js";
import HotelTable from "../models/hotelTable.model.js";
import Menu from "../models/menu.model.js";

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
};
const hotelInclude = {
  model: HotelTable,
  as: "hotel",
  attributes: ["id", "hotel_name"],
};

const categoryInclude = {
  model: HotelTable,
  as: "hotel",
  attributes: ["id", "hotel_name"],
};

export const createMenuCategory = async (req, res) => {
  try {
    const { hotel_id, category_name, description, display_order, is_active } =
      req.body;

    const categoryName =
      typeof category_name === "string" ? category_name.trim() : "";

    if (!hotel_id || !categoryName) {
      return res.status(400).json({
        success: false,
        message: "hotel_id and category_name are required.",
      });
    }

    const hotel = await HotelTable.findByPk(hotel_id);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found.",
      });
    }

    const existingCategory = await MenuCategory.findOne({
      where: {
        hotel_id,
        category_name: { [Op.iLike]: categoryName },
      },
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Menu category already exists for this hotel.",
      });
    }

    const category = await MenuCategory.create({
      hotel_id,
      category_name: categoryName,
      description,
      display_order,
      is_active,
    });

    return res.status(201).json({
      success: true,
      message: "Menu category created successfully.",
      data: category,
    });
  } catch (error) {
    console.error("========== CREATE MENU CATEGORY ERROR ==========");
    console.error("Name:", error.name);
    console.error("Message:", error.message);
    console.error("Parent:", error.parent?.message);
    console.error("SQL:", error.sql);
    console.error("Fields:", error.fields);
    console.error("Errors:", error.errors);
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.parent?.message || error.message,
    });
  }
};

export const getMenuCategories = async (req, res) => {
  try {
    let { page = 1, limit = 10, search, hotel_id, is_active } = req.query;
    page = Number(page);
    limit = Number(limit);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "page and limit must be positive integers.",
      });
    }

    const where = {};
    if (hotel_id) where.hotel_id = hotel_id;

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
      where.category_name = { [Op.iLike]: `%${searchTerm}%` };
    }

    const { rows, count } = await MenuCategory.findAndCountAll({
      where,
      include: [categoryInclude],
      limit,
      offset: (page - 1) * limit,
      order: [
        ["display_order", "ASC"],
        ["category_name", "ASC"],
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
    console.error("Fetch menu categories error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch menu categories.",
    });
  }
};

export const getMenuCategoryById = async (req, res) => {
  try {
    const category = await MenuCategory.findByPk(req.params.id, {
      include: [categoryInclude, { model: Menu, as: "menus" }],
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Menu category not found.",
      });
    }

    return res.json({ success: true, data: category });
  } catch (error) {
    console.error("Fetch menu category error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch menu category.",
    });
  }
};

export const updateMenuCategory = async (req, res) => {
  try {
    const category = await MenuCategory.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Menu category not found.",
      });
    }

    const allowedFields = [
      "hotel_id",
      "category_name",
      "description",
      "display_order",
      "is_active",
    ];
    const updates = Object.fromEntries(
      allowedFields
        .filter((field) => req.body[field] !== undefined)
        .map((field) => [field, req.body[field]]),
    );

    if (updates.category_name !== undefined) {
      if (typeof updates.category_name !== "string") {
        return res.status(400).json({
          success: false,
          message: "category_name must be a string.",
        });
      }
      updates.category_name = updates.category_name.trim();
      if (!updates.category_name) {
        return res.status(400).json({
          success: false,
          message: "category_name cannot be empty.",
        });
      }
    }

    const hotelId = updates.hotel_id ?? category.hotel_id;
    if (
      updates.hotel_id !== undefined &&
      !(await HotelTable.findByPk(hotelId))
    ) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found.",
      });
    }

    if (updates.category_name !== undefined || updates.hotel_id !== undefined) {
      const duplicate = await MenuCategory.findOne({
        where: {
          hotel_id: hotelId,
          category_name: {
            [Op.iLike]: updates.category_name ?? category.category_name,
          },
          id: { [Op.ne]: category.id },
        },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Menu category already exists for this hotel.",
        });
      }
    }

    await category.update(updates);

    return res.json({
      success: true,
      message: "Menu category updated successfully.",
      data: category,
    });
  } catch (error) {
    console.error("Update menu category error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update menu category.",
    });
  }
};

export const deleteMenuCategory = async (req, res) => {
  try {
    const category = await MenuCategory.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Menu category not found.",
      });
    }

    const menuCount = await Menu.count({ where: { category_id: category.id } });
    if (menuCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a menu category that contains menu items.",
      });
    }

    await category.destroy();

    return res.json({
      success: true,
      message: "Menu category deleted successfully.",
    });
  } catch (error) {
    console.error("Delete menu category error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete menu category.",
    });
  }
};
