import Seat from "../models/seat.model.js";
import Table from "../models/table.model.js";

export const addSeatsToTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { seatCount } = req.body;

    if (!seatCount || seatCount <= 0) {
      return res.status(400).json({
        success: false,
        message: "seatCount must be greater than 0",
      });
    }

    const table = await Table.findByPk(tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    // 🔍 find last seat number
    const lastSeat = await Seat.findOne({
      where: { table_id: tableId },
      order: [["seat_number", "DESC"]],
    });

    const startNumber = lastSeat ? lastSeat.seat_number + 1 : 1;

    const seats = [];
    for (let i = 0; i < seatCount; i++) {
      seats.push({
        table_id: tableId,
        seat_number: startNumber + i,
        is_booked: false,
      });
    }

    const createdSeats = await Seat.bulkCreate(seats);

    res.status(201).json({
      success: true,
      message: "Seats added successfully",
      data: createdSeats,
    });
  } catch (error) {
    console.error("Add seats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add seats",
    });
  }
};

export const removeSeatsFromTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { seatIds } = req.body;

    // ✅ Validate seatIds
    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "seatIds must be a non-empty array",
      });
    }

    // 🔍 Fetch seats belonging to this table
    const seats = await Seat.findAll({
      where: {
        id: seatIds,
        table_id: tableId,
      },
    });

    // ❌ Invalid seat IDs or wrong table
    if (seats.length !== seatIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more seatIds are invalid or not linked to this table",
      });
    }

    // ❌ Prevent removing booked seats
    const bookedSeats = seats.filter((seat) => seat.is_booked);
    if (bookedSeats.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot remove booked seats",
        bookedSeatIds: bookedSeats.map((s) => s.id),
      });
    }

    // 🗑 Remove seats
    await Seat.destroy({
      where: {
        id: seatIds,
        table_id: tableId,
      },
    });

    return res.json({
      success: true,
      message: "Seats removed successfully",
      removedSeatIds: seatIds,
    });
  } catch (error) {
    console.error("Remove seats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove seats",
    });
  }
};

export const createSeatsForTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { seatCount } = req.body;

    if (!seatCount || seatCount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "seatCount must be greater than 0" });
    }

    const table = await Table.findByPk(tableId);
    if (!table) {
      return res
        .status(404)
        .json({ success: false, message: "Table not found" });
    }

    const seats = [];
    for (let i = 1; i <= seatCount; i++) {
      seats.push({ table_id: tableId, seat_number: i });
    }

    const created = await Seat.bulkCreate(seats);

    res
      .status(201)
      .json({
        success: true,
        message: "Seats created successfully",
        data: created,
      });
  } catch (error) {
    console.error("Create seats error:", error);
    res.status(500).json({ success: false, message: "Failed to create seats" });
  }
};

export const getSeatsByTable = async (req, res) => {
  try {
    const { tableId } = req.params;

    const seats = await Seat.findAll({
      where: { table_id: tableId },
      order: [["seat_number", "ASC"]],
    });

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
    if (!seat)
      return res
        .status(404)
        .json({ success: false, message: "Seat not found" });

    if (typeof is_booked === "boolean") seat.is_booked = is_booked;
    await seat.save();

    res.json({
      success: true,
      message: "Seat updated successfully",
      data: seat,
    });
  } catch (error) {
    console.error("Update seat error:", error);
    res.status(500).json({ success: false, message: "Failed to update seat" });
  }
};

export default {
  createSeatsForTable,
  addSeatsToTable,
  removeSeatsFromTable,
  getSeatsByTable,
  updateSeatStatus,
};
