import { Op } from "sequelize";
import SideDish from "../models/sideDish.model.js";
import HotelTable from "../models/hotelTable.model.js";
import MenuCategory from "../models/menuCategory.model.js";
import MenuSideDishMapping from "../models/menuSideDishMapping.model.js";
import sequelize from "../config/db.js";

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
};

const sideDishIncludes = [
  {
    model: HotelTable,
    as: "hotel",
    attributes: ["id", "hotel_name"],
  },
  {
    model: MenuCategory,
    as: "category",
    attributes: ["id", "category_name"],
  },
];

// A side dish belongs to one (shared) menu category, not to a hotel.
const findDuplicate = (categoryId, name, excludeId) =>
  SideDish.findOne({
    where: {
      category_id: categoryId,
      side_dish_name: { [Op.iLike]: name },
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
    },
  });

export const createSideDish = async (req, res) => {
  try {
    const { category_id, side_dish_name, description, price, display_order, is_active } =
      req.body;

    const name = typeof side_dish_name === "string" ? side_dish_name.trim() : "";

    if (!category_id || !name) {
      return res.status(400).json({
        success: false,
        message: "category_id and side_dish_name are required.",
      });
    }

    const category = await MenuCategory.findByPk(category_id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    if (await findDuplicate(category.id, name)) {
      return res.status(409).json({
        success: false,
        message: "Side dish already exists in this category.",
      });
    }

    const sideDish = await SideDish.create({
      hotel_id: null, // side dishes follow their (shared) category
      category_id: category.id,
      side_dish_name: name,
      description,
      price: Number(price) || 0,
      display_order: Number(display_order) || 0,
      is_active,
    });

    res.status(201).json({
      success: true,
      message: "Side dish created successfully.",
      data: sideDish,
    });
  } catch (error) {
    console.error("Create side dish error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create side dish.",
    });
  }
};

export const getAllSideDishes = async (req, res) => {
  try {
    let { page = 1, limit = 10, search, hotel_id, category_id, is_active } = req.query;

    page = Number(page);
    limit = Number(limit);

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({
        success: false,
        message: "page and limit must be positive integers.",
      });
    }

    const where = {};

    if (hotel_id) where.hotel_id = hotel_id;
    if (category_id) where.category_id = category_id;

    const active = parseBoolean(is_active);

    if (active === null) {
      return res.status(400).json({
        success: false,
        message: "is_active must be true or false.",
      });
    }
    if (active !== undefined) where.is_active = active;

    if (search) {
      where.side_dish_name = {
        [Op.iLike]: `%${search}%`,
      };
    }

    const { rows, count } = await SideDish.findAndCountAll({
      where,
      include: sideDishIncludes,
      limit,
      offset: (page - 1) * limit,
      order: [
        ["display_order", "ASC"],
        ["side_dish_name", "ASC"],
      ],
    });

    res.json({
      success: true,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      data: rows,
    });
  } catch (error) {
    console.error("Fetch side dishes error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch side dishes.",
    });
  }
};

export const getSideDishById = async (req, res) => {
  try {
    const sideDish = await SideDish.findByPk(req.params.id, {
      include: sideDishIncludes,
    });

    if (!sideDish) {
      return res.status(404).json({
        success: false,
        message: "Side dish not found.",
      });
    }

    res.json({
      success: true,
      data: sideDish,
    });
  } catch (error) {
    console.error("Fetch side dish error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch side dish.",
    });
  }
};

export const updateSideDish = async (req, res) => {
  try {
    const sideDish = await SideDish.findByPk(req.params.id);

    if (!sideDish) {
      return res.status(404).json({
        success: false,
        message: "Side dish not found.",
      });
    }

    // category_id is fixed: menus of the category link to this side dish.
    const allowedFields = [
      "side_dish_name",
      "description",
      "price",
      "display_order",
      "is_active",
    ];
    const updates = Object.fromEntries(
      allowedFields
        .filter((field) => req.body[field] !== undefined)
        .map((field) => [field, req.body[field]]),
    );

    if (updates.side_dish_name !== undefined) {
      updates.side_dish_name =
        typeof updates.side_dish_name === "string" ? updates.side_dish_name.trim() : "";

      if (!updates.side_dish_name) {
        return res.status(400).json({
          success: false,
          message: "side_dish_name cannot be empty.",
        });
      }
    }

    if (updates.side_dish_name !== undefined) {
      const duplicate = await findDuplicate(
        sideDish.category_id,
        updates.side_dish_name,
        sideDish.id,
      );

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Side dish already exists in this category.",
        });
      }
    }

    if (updates.price !== undefined) updates.price = Number(updates.price) || 0;
    if (updates.display_order !== undefined) {
      updates.display_order = Number(updates.display_order) || 0;
    }

    await sideDish.update(updates);

    res.json({
      success: true,
      message: "Side dish updated successfully.",
      data: sideDish,
    });
  } catch (error) {
    console.error("Update side dish error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update side dish.",
    });
  }
};

export const deleteSideDish = async (req, res) => {
  try {
    const sideDish = await SideDish.findByPk(req.params.id);

    if (!sideDish) {
      return res.status(404).json({
        success: false,
        message: "Side dish not found.",
      });
    }

    // Also unlink it from the menus that offer it.
    await sequelize.transaction(async (transaction) => {
      await MenuSideDishMapping.destroy({
        where: { side_dish_id: sideDish.id },
        transaction,
      });
      await sideDish.destroy({ transaction });
    });

    res.json({
      success: true,
      message: "Side dish deleted successfully.",
    });
  } catch (error) {
    console.error("Delete side dish error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete side dish.",
    });
  }
};
