import Seat from "../models/seat.model.js";
import Table from "../models/table.model.js";

export const createSeatsForTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { seatCount } = req.body;

    if (!seatCount || seatCount <= 0) {
      return res.status(400).json({ success: false, message: "seatCount must be greater than 0" });
    }

    const table = await Table.findByPk(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: "Table not found" });
    }

    const seats = [];
    for (let i = 1; i <= seatCount; i++) {
      seats.push({ table_id: tableId, seat_number: i });
    }

    const created = await Seat.bulkCreate(seats);

    res.status(201).json({ success: true, message: "Seats created successfully", data: created });
  } catch (error) {
    console.error("Create seats error:", error);
    res.status(500).json({ success: false, message: "Failed to create seats" });
  }
};

export const getSeatsByTable = async (req, res) => {
  try {
    const { tableId } = req.params;

    const seats = await Seat.findAll({ where: { table_id: tableId }, order: [["seat_number", "ASC"]] });

    res.json({ success: true, data: seats });
  } catch (error) {
    console.error("Get seats error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch seats" });
  }
};

export const updateSeatStatus = async (req, res) => {
  try {
    const { seatId } = req.params;
    const { is_booked } = req.body;

    const seat = await Seat.findByPk(seatId);
    if (!seat) return res.status(404).json({ success: false, message: "Seat not found" });

    if (typeof is_booked === "boolean") seat.is_booked = is_booked;
    await seat.save();

    res.json({ success: true, message: "Seat updated successfully", data: seat });
  } catch (error) {
    console.error("Update seat error:", error);
    res.status(500).json({ success: false, message: "Failed to update seat" });
  }
};

export default {
  createSeatsForTable,
  getSeatsByTable,
  updateSeatStatus,
};
