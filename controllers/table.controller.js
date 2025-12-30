import HotelTable from "../models/hotelTable.model.js";
import Floor from "../models/floor.model.js";
import Table from "../models/table.model.js";
import Seat from "../models/seat.model.js";
import Reservation from "../models/reservation.model.js";

const SEAT_STATUS = {
  BOOKED: 1,
  CANCEL: 2,
  CLEANING: 3,
  AVAILABLE: 4,
};

/**
 * CREATE tables for a hotel (Admin)
 */
export const createTablesForHotel = async (req, res) => {
  try {
    const { hotelTableId, floorId } = req.params;
    const { tableCount } = req.body;

    if (!tableCount || tableCount <= 0) {
      return res.status(400).json({
        success: false,
        message: "tableCount must be greater than 0",
      });
    }

    const hotel = await HotelTable.findByPk(hotelTableId);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    const floor = await Floor.findOne({
      where: { id: floorId, hotel_table_id: hotelTableId },
    });

    if (!floor) {
      return res.status(404).json({
        success: false,
        message: "Floor not found for this hotel",
      });
    }

    // 🔥 last table number per floor
    const lastTable = await Table.findOne({
      where: { floor_id: floorId },
      order: [["table_number", "DESC"]],
    });

    const startNumber = lastTable ? lastTable.table_number + 1 : 1;

    const tables = [];
    for (let i = 0; i < tableCount; i++) {
      tables.push({
        hotel_table_id: hotelTableId,
        floor_id: floorId,
        table_number: startNumber + i,
      });
    }

    await Table.bulkCreate(tables);

    return res.status(201).json({
      success: true,
      message: "Tables created successfully",
    });
  } catch (error) {
    console.error("Create tables error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Table number already exists on this floor",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create tables",
    });
  }
};

/**
 * GET all tables of a hotel (floor → table → seat)
 */
export const getTablesByHotel = async (req, res) => {
  try {
    const { hotelTableId } = req.params;

    /* ---------------- FETCH HOTEL STRUCTURE ---------------- */
    const hotel = await HotelTable.findByPk(hotelTableId, {
      include: [
        {
          model: Floor,
          as: "floors",
          include: [
            {
              model: Table,
              as: "tables",
              include: [
                {
                  model: Seat,
                  as: "seats",
                },
              ],
            },
          ],
        },
      ],
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    /* ---------------- FETCH RESERVATIONS ---------------- */
    const reservations = await Reservation.findAll({
      where: { hotel_id: hotelTableId },
      attributes: ["user_id", "seat_status"],
    });

    /* ---------------- BUILD seat_id → user_id MAP ---------------- */
    const seatUserMap = new Map();

    for (const r of reservations) {
      const seatStatus =
        typeof r.seat_status === "string"
          ? JSON.parse(r.seat_status)
          : r.seat_status;

      if (!Array.isArray(seatStatus)) continue;

      for (const t of seatStatus) {
        if (Array.isArray(t.seat_ids)) {
          for (const seatId of t.seat_ids) {
            seatUserMap.set(Number(seatId), r.user_id); // ✅ FIX
          }
        }
      }
    }

    /* ---------------- BUILD RESPONSE ---------------- */
    const floorsData = hotel.floors.map((floor) => {
      let totalSeats = 0;
      let availableSeats = 0;
      let availableTables = 0;

      const tables = floor.tables.map((table) => {
        let tableHasAvailableSeat = false;

        const seats = table.seats.map((seat) => {
          totalSeats++;

          if (seat.status === SEAT_STATUS.AVAILABLE) {
            availableSeats++;
            tableHasAvailableSeat = true;
          }
          return {
            seat_id: seat.id,
            seat_number: seat.seat_number,
            status: seat.status,
            reservation_id: seat.reservation_id,
            user_id:
              seat.status === SEAT_STATUS.BOOKED
                ? seatUserMap.get(Number(seat.id)) || null
                : null,
          };
        });

        if (tableHasAvailableSeat) {
          availableTables++;
        }

        return {
          table_id: table.id,
          table_number: table.table_number,
          seats,
        };
      });

      return {
        floor_id: floor.id,
        tables,
        number_of_tables: floor.tables.length,
        number_of_seats: totalSeats,
        available_of_tables: availableTables,
        available_of_seats: availableSeats,
      };
    });

    return res.json({
      success: true,
      data: [
        {
          hotel_table_id: hotel.id,
          floors: floorsData,
        },
      ],
    });
  } catch (error) {
    console.error("Get tables error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch hotel tables",
    });
  }
};

/**
 * DELETE table (Admin)
 */
export const deleteTable = async (req, res) => {
  try {
    const { tableId } = req.params;

    const table = await Table.findByPk(tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    // 🚫 Prevent deleting table with BOOKED or CLEANING seats
    const blockedSeats = await Seat.count({
      where: {
        table_id: tableId,
        status: [SEAT_STATUS.BOOKED, SEAT_STATUS.CLEANING],
      },
    });

    if (blockedSeats > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete table with booked or cleaning seats",
      });
    }

    await table.destroy();

    return res.json({
      success: true,
      message: "Table deleted successfully",
    });
  } catch (error) {
    console.error("Delete table error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete table",
    });
  }
};
