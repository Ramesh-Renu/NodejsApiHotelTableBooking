import MenuSideDish from "../models/menuSideDish.model.js";

/**
 * Create Side Dish
 */
export const createSideDish = async (req, res) => {
  try {
    const {
      side_dish_name,
      description,
      display_order,
      is_active = true,
    } = req.body;

    if (!side_dish_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Side dish name is required.",
      });
    }

    const exists = await MenuSideDish.findOne({
      where: {
        side_dish_name: side_dish_name.trim(),
      },
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Side dish already exists.",
      });
    }

    const sideDish = await MenuSideDish.create({
      side_dish_name: side_dish_name.trim(),
      description,
      display_order,
      is_active,
    });

    return res.status(201).json({
      success: true,
      message: "Side dish created successfully.",
      data: sideDish,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get All Side Dishes
 */
export const getAllSideDishes = async (req, res) => {
  try {
    const sideDishes = await MenuSideDish.findAll({
      order: [["display_order", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: sideDishes,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get Side Dish By Id
 */
export const getSideDishById = async (req, res) => {
  try {
    const sideDish = await MenuSideDish.findByPk(req.params.id);

    if (!sideDish) {
      return res.status(404).json({
        success: false,
        message: "Side dish not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: sideDish,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Update Side Dish
 */
export const updateSideDish = async (req, res) => {
  try {
    const sideDish = await MenuSideDish.findByPk(req.params.id);

    if (!sideDish) {
      return res.status(404).json({
        success: false,
        message: "Side dish not found.",
      });
    }

    const {
      side_dish_name,
      description,
      display_order,
      is_active,
    } = req.body;

    await sideDish.update({
      side_dish_name,
      description,
      display_order,
      is_active,
    });

    return res.status(200).json({
      success: true,
      message: "Side dish updated successfully.",
      data: sideDish,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Delete Side Dish
 */
export const deleteSideDish = async (req, res) => {
  try {
    const sideDish = await MenuSideDish.findByPk(req.params.id);

    if (!sideDish) {
      return res.status(404).json({
        success: false,
        message: "Side dish not found.",
      });
    }

    await sideDish.destroy();

    return res.status(200).json({
      success: true,
      message: "Side dish deleted successfully.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};