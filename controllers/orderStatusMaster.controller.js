import OrderStatusMaster from "../models/orderStatusMaster.model.js";
import { ORDER_STATUS } from "../utils/orderStatus.js";

const buildStatusRows = (statuses) =>
  Object.entries(statuses).map(([name, status_id]) => ({
    status_id,
    name,
  }));

export const createOrderStatus = async (req, res) => {
  try {
    const { status_id, name, color_code } = req.body;

    if (status_id === undefined || status_id === null || !name) {
      return res.status(400).json({
        success: false,
        message: "status_id and name are required",
      });
    }

    const exists = await OrderStatusMaster.findOne({ where: { status_id } });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Order status already exists",
      });
    }

    const orderStatus = await OrderStatusMaster.create({
      status_id,
      name,
      color_code,
    });

    return res.status(201).json({
      success: true,
      message: "Order status created successfully",
      data: orderStatus,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllOrderStatuses = async (req, res) => {
  try {
    const statuses = await OrderStatusMaster.findAll({
      order: [["status_id", "ASC"]],
    });

    return res.json({
      success: true,
      data: statuses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const seedOrderStatuses = async (req, res) => {
  try {
    const rows = buildStatusRows(ORDER_STATUS);

    await OrderStatusMaster.bulkCreate(rows, {
      updateOnDuplicate: ["name"],
    });

    const statuses = await OrderStatusMaster.findAll({
      order: [["status_id", "ASC"]],
    });

    return res.json({
      success: true,
      message: "Order statuses seeded successfully",
      data: statuses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
