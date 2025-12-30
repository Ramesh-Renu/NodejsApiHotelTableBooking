import SeatStatusMaster from "../models/seatStatusMaster.model.js";

export const createSeatStatus = async (req, res) => {
  try {
    const { status_id, name } = req.body;

    if (!status_id || !name) {
      return res.status(400).json({
        success: false,
        message: "status_id and name are required",
      });
    }

    const exists = await SeatStatusMaster.findOne({
      where: { status_id },
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Seat status already exists",
      });
    }

    const seatStatus = await SeatStatusMaster.create({
      status_id,
      name,
    });

    res.status(201).json({
      success: true,
      message: "Seat status created successfully",
      data: seatStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllSeatStatuses = async (req, res) => {
  try {
    const statuses = await SeatStatusMaster.findAll({
      order: [["status_id", "ASC"]],
    });

    res.json({
      success: true,
      data: statuses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
