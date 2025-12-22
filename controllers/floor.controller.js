import Floor from "../models/floor.model.js";
import HotelTable from "../models/hotelTable.model.js";

/**
 * CREATE floor for a hotel (Admin)
 */
export const createFloor = async (req, res) => {
  try {
    const { hotelTableId } = req.params;
    const { floor_number } = req.body;

    if (floor_number === undefined) {
      return res.status(400).json({
        success: false,
        message: "floor_number is required",
      });
    }

    const hotel = await HotelTable.findByPk(hotelTableId);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    const floor = await Floor.create({
      hotel_table_id: hotelTableId,
      floor_number,
    });

    res.status(201).json({
      success: true,
      message: "Floor created successfully",
      data: floor,
    });
  } catch (error) {
    console.error("Create floor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create floor",
    });
  }
};

/**
 * GET all floors of a hotel (User/Admin)
 */
export const getFloorsByHotel = async (req, res) => {
  try {
    const { hotelTableId } = req.params;

    const floors = await Floor.findAll({
      where: { hotel_table_id: hotelTableId },
      order: [["floor_number", "ASC"]],
    });

    res.json({
      success: true,
      data: floors,
    });
  } catch (error) {
    console.error("Get floors error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch floors",
    });
  }
};

/**
 * DELETE floor (Admin)
 */
export const deleteFloor = async (req, res) => {
  try {
    const { floorId } = req.params;

    const floor = await Floor.findByPk(floorId);
    if (!floor) {
      return res.status(404).json({
        success: false,
        message: "Floor not found",
      });
    }

    await floor.destroy();

    res.json({
      success: true,
      message: "Floor deleted successfully",
    });
  } catch (error) {
    console.error("Delete floor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete floor",
    });
  }
};
