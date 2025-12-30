import Seat from "../models/seat.model.js";
import Table from "../models/table.model.js";

const SEAT_STATUS = {
  BOOKED: 1,
  CANCEL: 2,
  CLEANING: 3,
  AVAILABLE: 4,
};

/**
 * ADD seats to an existing table
 */
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
        status: SEAT_STATUS.AVAILABLE, // ✅ 4
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

/**
 * REMOVE seats from table (only AVAILABLE seats)
 */
export const removeSeatsFromTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { seatIds } = req.body;

    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "seatIds must be a non-empty array",
      });
    }

    const seats = await Seat.findAll({
      where: {
        id: seatIds,
        table_id: tableId,
      },
    });

    if (seats.length !== seatIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more seatIds are invalid or not linked to this table",
      });
    }

    // ❌ Prevent removing non-AVAILABLE seats
    const blockedSeats = seats.filter(
      (seat) => seat.status !== SEAT_STATUS.AVAILABLE
    );

    if (blockedSeats.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Only AVAILABLE seats can be removed",
        blockedSeatIds: blockedSeats.map((s) => s.id),
      });
    }

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

/**
 * CREATE seats for a table (fresh)
 */
export const createSeatsForTable = async (req, res) => {
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

    const seats = [];
    for (let i = 1; i <= seatCount; i++) {
      seats.push({
        table_id: tableId,
        seat_number: i,
        status: SEAT_STATUS.AVAILABLE, // ✅ 4
      });
    }

    const created = await Seat.bulkCreate(seats);

    res.status(201).json({
      success: true,
      message: "Seats created successfully",
      data: created,
    });
  } catch (error) {
    console.error("Create seats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create seats",
    });
  }
};

/**
 * GET seats by table
 */
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch seats",
    });
  }
};

/**
 * UPDATE seat status
 */
export const updateSeatStatus = async (req, res) => {
  try {
    const { seatId } = req.params;
    const { status } = req.body;

    if (!Object.values(SEAT_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid seat status",
      });
    }

    const seat = await Seat.findByPk(seatId);
    if (!seat) {
      return res.status(404).json({
        success: false,
        message: "Seat not found",
      });
    }

    seat.status = status;
    await seat.save();

    res.json({
      success: true,
      message: "Seat status updated successfully",
      data: seat,
    });
  } catch (error) {
    console.error("Update seat error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update seat",
    });
  }
};

export default {
  createSeatsForTable,
  addSeatsToTable,
  removeSeatsFromTable,
  getSeatsByTable,
  updateSeatStatus,
};
