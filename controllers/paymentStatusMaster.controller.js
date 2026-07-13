import PaymentStatusMaster from "../models/paymentStatusMaster.model.js";
import { PAYMENT_STATUS } from "../utils/paymentStatus.js";

const buildStatusRows = (statuses) =>
  Object.entries(statuses).map(([name, status_id]) => ({
    status_id,
    name,
  }));

export const createPaymentStatus = async (req, res) => {
  try {
    const { status_id, name, color_code } = req.body;

    if (status_id === undefined || status_id === null || !name) {
      return res.status(400).json({
        success: false,
        message: "status_id and name are required",
      });
    }

    const exists = await PaymentStatusMaster.findOne({ where: { status_id } });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Payment status already exists",
      });
    }

    const paymentStatus = await PaymentStatusMaster.create({
      status_id,
      name,
      color_code,
    });

    return res.status(201).json({
      success: true,
      message: "Payment status created successfully",
      data: paymentStatus,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllPaymentStatuses = async (req, res) => {
  try {
    const statuses = await PaymentStatusMaster.findAll({
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

export const seedPaymentStatuses = async (req, res) => {
  try {
    const rows = buildStatusRows(PAYMENT_STATUS);

    await PaymentStatusMaster.bulkCreate(rows, {
      updateOnDuplicate: ["name"],
    });

    const statuses = await PaymentStatusMaster.findAll({
      order: [["status_id", "ASC"]],
    });

    return res.json({
      success: true,
      message: "Payment statuses seeded successfully",
      data: statuses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
