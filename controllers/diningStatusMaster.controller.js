import DiningStatusMaster from "../models/diningStatusMaster.model.js";

export const createDiningStatus = async (req, res) => {
  try {
    const { status_id, name } = req.body;

    if (!status_id || !name) {
      return res.status(400).json({
        success: false,
        message: "status_id and name are required",
      });
    }

    const exists = await DiningStatusMaster.findOne({
      where: { status_id },
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Seat status already exists",
      });
    }

    const seatStatus = await DiningStatusMaster.create({
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

export const getAllDiningStatuses = async (req, res) => {
 try {
    const dining = await DiningStatusMaster.findAll({ order: [["name", "ASC"]] });
    res.json({ success: true, data: dining });
  } catch (error) {
    console.error("Fetch dining error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch dining" });
  }
};
