import { Op } from "sequelize";
import SideDish from "../models/sideDish.model.js";
import HotelTable from "../models/hotelTable.model.js";
import MenuCategory from "../models/menuCategory.model.js";

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
};

export const createSideDish = async (req, res) => {
  try {
    const {
      hotel_id,
      category_id,
      side_dish_name,
      description,
      price,
      display_order,
      is_active,
    } = req.body;

    if (!hotel_id || !category_id || !side_dish_name) {
      return res.status(400).json({
        success: false,
        message: "hotel_id, category_id and side_dish_name are required.",
      });
    }

    const hotel = await HotelTable.findByPk(hotel_id);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found.",
      });
    }

    const category = await MenuCategory.findByPk(category_id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    const existing = await SideDish.findOne({
      where: {
        hotel_id,
        category_id,
        side_dish_name: {
          [Op.iLike]: side_dish_name.trim(),
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Side dish already exists.",
      });
    }

    const sideDish = await SideDish.create({
      hotel_id,
      category_id,
      side_dish_name: side_dish_name.trim(),
      description,
      price,
      display_order,
      is_active,
    });

    res.status(201).json({
      success: true,
      message: "Side dish created successfully.",
      data: sideDish,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to create side dish.",
    });
  }
};
export const getAllSideDishes = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search,
      hotel_id,
      category_id,
      is_active,
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const where = {};

    if (hotel_id) where.hotel_id = hotel_id;
    if (category_id) where.category_id = category_id;

    const active = parseBoolean(is_active);

    if (active !== undefined) where.is_active = active;

    if (search) {
      where.side_dish_name = {
        [Op.iLike]: `%${search}%`,
      };
    }

    const { rows, count } = await SideDish.findAndCountAll({
      where,
      include: [
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
      ],
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
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch side dishes.",
    });
  }
};

export const getSideDishById = async (req, res) => {
  const sideDish = await SideDish.findByPk(req.params.id, {
    include: ["hotel", "category"],
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
};

export const updateSideDish = async (req, res) => {
  const sideDish = await SideDish.findByPk(req.params.id);

  if (!sideDish) {
    return res.status(404).json({
      success: false,
      message: "Side dish not found.",
    });
  }

  await sideDish.update(req.body);

  res.json({
    success: true,
    message: "Side dish updated successfully.",
    data: sideDish,
  });
};

export const deleteSideDish = async (req, res) => {
  const sideDish = await SideDish.findByPk(req.params.id);

  if (!sideDish) {
    return res.status(404).json({
      success: false,
      message: "Side dish not found.",
    });
  }

  await sideDish.destroy();

  res.json({
    success: true,
    message: "Side dish deleted successfully.",
  });
};