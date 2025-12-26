import HotelTable from "../models/hotelTable.model.js";
import Floor from "../models/floor.model.js";
import Table from "../models/table.model.js";
import Seat from "../models/seat.model.js";

/**
 * CREATE tables for a hotel
 * Admin creates actual tables based on count
 */
export const createTablesForHotel = async (req, res) => {
  try {
    const { hotelTableId } = req.params;
    const { tableCount } = req.body;

    if (!tableCount || tableCount <= 0) {
      return res.status(400).json({
        success: false,
        message: "tableCount must be greater than 0",
      });
    }

    // 🔎 Check hotel exists
    const hotel = await HotelTable.findByPk(hotelTableId);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    // 🔥 Find last table number for this hotel
    const lastTable = await Table.findOne({
      where: { hotel_table_id: hotelTableId },
      order: [["table_number", "DESC"]],
    });

    const startNumber = lastTable ? lastTable.table_number + 1 : 1;

    // 🔢 Prepare new tables
    const tables = [];
    for (let i = 0; i < tableCount; i++) {
      tables.push({
        hotel_table_id: hotelTableId,
        table_number: startNumber + i,
      });
    }

    const createdTables = await Table.bulkCreate(tables);

    return res.status(201).json({
      success: true,
      message: "Tables created successfully",
      data: createdTables,
    });
  } catch (error) {
    console.error("Create tables error:", error);

    // Handle unique constraint explicitly (safety)
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Table number already exists for this hotel",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create tables",
    });
  }
};

/**
 * GET all tables of a hotel (floor → table → seat)
 */
export const getTablesByHotel = async (req, res) => {
  try {
    const { hotelTableId } = req.params;

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

    const floorsData = hotel.floors.map((floor) => {
      let totalSeats = 0;
      let availableSeats = 0;
      let availableTables = 0;

      const tables = floor.tables.map((table) => {
        let tableHasFreeSeat = false;

        const seats = table.seats.map((seat) => {
          totalSeats++;
          if (!seat.is_booked) {
            availableSeats++;
            tableHasFreeSeat = true;
          }

          return {
            seat_id: seat.id,
            seat_number: seat.seat_number,
            is_booked: seat.is_booked,
          };
        });

        if (tableHasFreeSeat) {
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
        floor_number: floor.floor_number,
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
