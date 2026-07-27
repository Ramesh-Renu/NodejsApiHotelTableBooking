// controllers/menu.controller.js

import { Op, col, fn, where } from "sequelize";
import Menu from "../models/menu.model.js";
import MenuCategory from "../models/menuCategory.model.js";
import HotelTable from "../models/hotelTable.model.js";
import SpiceLevelMaster from "../models/spiceLevelMaster.model.js";
import { uploadImage } from "../utils/uploadImage.js";
import MenuSideDishMapping from "../models/menuSideDishMapping.model.js";
import sequelize from "../config/db.js";
import MenuSideDish from "../models/menuSideDish.model.js";

const transaction = await sequelize.transaction();

/**
 * Create Menu
 */
export const createMenu = async (req, res) => {
  try {
    const {
      hotel_id,
      category_id,
      menu_name,
      menu_code,
      description,
      price,
      preparation_time,
      is_veg,
      spice_level,
      calories,
      is_available,
      display_order,
      side_dishes = [],
    } = req.body;

    if (
      !hotel_id ||
      !category_id ||
      !menu_name ||
      price === undefined ||
      price === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Hotel, Category, Menu Name and Price are required.",
      });
    }

    const spiceLevelId = spice_level === undefined ? 1 : Number(spice_level);
    if (!Number.isInteger(spiceLevelId) || spiceLevelId < 1) {
      return res.status(400).json({
        success: false,
        message: "spice_level must be a valid integer ID.",
      });
    }

    const spiceLevel = await SpiceLevelMaster.findByPk(spiceLevelId);
    if (!spiceLevel) {
      return res.status(404).json({
        success: false,
        message: "Spice level not found.",
      });
    }

    const category = await MenuCategory.findOne({
      where: {
        id: category_id,
        hotel_id,
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Menu category not found.",
      });
    }
    const formattedMenuName = menu_name.trim();

    const exists = await Menu.findOne({
      where: {
        hotel_id,
        [Op.and]: where(
          fn("LOWER", col("menu_name")),
          formattedMenuName.toLowerCase(),
        ),
      },
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Menu already exists.",
      });
    }
    let image_url = null;
    let image_file_id = null;
    let image_name = req.file?.originalname || req.body.image || null;

    if (req.file) {
      const uploadedImage = await uploadImage(req.file);

      if (!uploadedImage.success) {
        return res.status(500).json({
          success: false,
          message: uploadedImage.message,
        });
      }

      image_url = uploadedImage.url;
      image_file_id = uploadedImage.fileId;
    }

    if (req.file && !req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        success: false,
        message: "Only image files are allowed.",
      });
    }
    if (Number(price) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be greater than 0.",
      });
    }

    const menu = await Menu.create(
      {
        hotel_id,
        category_id,
        menu_name,
        menu_code,
        description,
        image: image_name,
        image_url,
        image_file_id,
        price,
        preparation_time,
        is_veg,
        spice_level: spiceLevelId,
        calories,
        is_available,
        display_order,
      },
      { transaction },
    );
    if (side_dishes.length) {
      const mappings = side_dishes.map((sideDishId) => ({
        menu_id: menu.id,
        side_dish_id: sideDishId,
      }));

      await MenuSideDishMapping.bulkCreate(mappings, {
        transaction,
      });
    }
    await transaction.commit();
    return res.status(201).json({
      success: true,
      message: "Menu created successfully.",
      data: menu,
    });
  } catch (error) {
    console.error(error);
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to create menu.",
    });
  }
};

/**
 * Get All Menus
 */
export const getMenus = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search,
      hotel_id,
      category_id,
      is_available,
      is_veg,
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const where = {};

    if (hotel_id) where.hotel_id = hotel_id;
    if (category_id) where.category_id = category_id;

    if (is_available !== undefined) where.is_available = is_available;

    if (is_veg !== undefined) where.is_veg = is_veg;

    if (search) {
      where[Op.or] = [
        {
          menu_name: {
            [Op.iLike]: `%${search}%`,
          },
        },
        {
          description: {
            [Op.iLike]: `%${search}%`,
          },
        },
      ];
    }

    const { rows, count } = await Menu.findAndCountAll({
      where,
      attributes: [
        "id",
        "hotel_id",
        "category_id",
        "menu_name",
        "menu_code",
        "description",
        "image",
        "image_url",
        "image_file_id",
        "price",
        "preparation_time",
        "is_veg",
        "spice_level",
        "calories",
        "is_available",
        "display_order",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: MenuCategory,
          as: "category",
          attributes: ["id", "category_name"],
        },
        {
          model: HotelTable,
          as: "hotel",
          attributes: ["id", "hotel_name"],
        },
        {
          model: SpiceLevelMaster,
          as: "spiceLevel",
          attributes: ["id", "spice_level", "description", "is_active"],
        },
        {
          model: MenuSideDishMapping,
          as: "sideDishes",
          required: false,
          include: [
            {
              model: MenuSideDish,
              as: "sideDish",
            },
          ],
        },
      ],
      limit,
      offset: (page - 1) * limit,
      order: [
        ["display_order", "ASC"],
        ["menu_name", "ASC"],
      ],
    });
    const formattedRows = rows.map((menu) => {
      const menuData = menu.toJSON();

      menuData.sideDishes = menuData.sideDishes.map((mapping) => ({
        ...mapping.sideDish,
        is_complimentary: mapping.is_complimentary,
      }));

      return menuData;
    });
    return res.json({
      success: true,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      rows: formattedRows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Menu By Id
 */
export const getMenuById = async (req, res) => {
  try {
    const menu = await Menu.findByPk(req.params.id, {
      attributes: [
        "id",
        "hotel_id",
        "category_id",
        "menu_name",
        "menu_code",
        "description",
        "image",
        "image_url",
        "image_file_id",
        "price",
        "preparation_time",
        "is_veg",
        "spice_level",
        "calories",
        "is_available",
        "display_order",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: MenuCategory,
          as: "category",
        },
        {
          model: HotelTable,
          as: "hotel",
        },
        {
          model: SpiceLevelMaster,
          as: "spiceLevel",
        },
        {
          model: MenuSideDishMapping,
          as: "sideDishes",
          attributes: [
            "id",
            "menu_id",
            "side_dish_id",
            "is_complimentary",
            "created_at",
          ],
          required: false,
          include: [
            {
              model: MenuSideDish,
              as: "sideDish",
              attributes: [
                "id",
                "side_dish_name",
                "description",
                "is_active",
                "display_order",
                "created_at",
                "updated_at",
              ],
            },
          ],
        },
      ],
    });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }

    const menuData = menu.toJSON();

    menuData.sideDishes = menuData.sideDishes.map((mapping) => ({
      ...mapping.sideDish,
      is_complimentary: mapping.is_complimentary,
    }));

    return res.json({
      success: true,
      data: menuData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Update Menu
 */
export const updateMenu = async (req, res) => {
  try {
    const menu = await Menu.findByPk(req.params.id);

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }

    const { side_dishes = [], ...updates } = req.body;

    if (updates.spice_level !== undefined) {
      const spiceLevelId = Number(updates.spice_level);
      if (!Number.isInteger(spiceLevelId) || spiceLevelId < 1) {
        return res.status(400).json({
          success: false,
          message: "spice_level must be a valid integer ID.",
        });
      }

      const spiceLevel = await SpiceLevelMaster.findByPk(spiceLevelId);
      if (!spiceLevel) {
        return res.status(404).json({
          success: false,
          message: "Spice level not found.",
        });
      }

      updates.spice_level = spiceLevelId;
    }

    await menu.update(updates);
    await MenuSideDishMapping.destroy({
      where: {
        menu_id: menu.id,
      },
    });
    if (side_dishes.length) {
      await MenuSideDishMapping.bulkCreate(
        side_dishes.map((id) => ({
          menu_id: menu.id,

          side_dish_id: id,
        })),
      );
    }
    return res.json({
      success: true,
      message: "Menu updated successfully.",
      data: menu,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete Menu
 */
export const deleteMenu = async (req, res) => {
  try {
    const menu = await Menu.findByPk(req.params.id);

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }
    await MenuSideDishMapping.destroy({
      where: {
        menu_id: menu.id,
      },
    });
    await menu.destroy();

    return res.json({
      success: true,
      message: "Menu deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update Availability
 */
export const updateMenuAvailability = async (req, res) => {
  try {
    const menu = await Menu.findByPk(req.params.id);

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }

    menu.is_available = !menu.is_available;

    await menu.save();

    return res.json({
      success: true,
      message: "Availability updated successfully.",
      data: menu,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
