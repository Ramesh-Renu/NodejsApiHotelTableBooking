import HotelTable from "../models/hotelTable.model.js";
import Area from "../models/area.model.js";
import Floor from "../models/floor.model.js";
import Table from "../models/table.model.js";
import Seat from "../models/seat.model.js";
import Location from "../models/location.model.js";
import { Op } from "sequelize";
import { sequelize } from "../config/db.js";

/**
 * CREATE hotel with floors, tables and seats
 */
export const createHotelTable = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      floor_per_hotel,
      tables_per_floor,
      chairs_per_table,
      area_id,
      ...hotelPayload
    } = req.body;

    /* ---------------- validation ---------------- */
    if (!area_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "area_id is required",
      });
    }

    if (!floor_per_hotel || floor_per_hotel <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "floor_per_hotel must be greater than 0",
      });
    }

    if (!tables_per_floor || tables_per_floor <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "tables_per_floor must be greater than 0",
      });
    }

    if (!chairs_per_table || chairs_per_table <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "chairs_per_table must be greater than 0",
      });
    }

    const area = await Area.findByPk(area_id);
    if (!area) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "area_id is invalid",
      });
    }

    /* ---------------- create hotel ---------------- */
    const hotel = await HotelTable.create(
      {
        ...hotelPayload,
        area_id,
        floor_per_hotel, // ✅ store count only
        tables_per_floor, // ✅ ADD THIS
        chairs_per_table, // ✅ ADD THIS
      },
      { transaction: t }
    );

    /* ---------------- create floors ---------------- */
    const floorRecords = [];
    for (let f = 1; f <= floor_per_hotel; f++) {
      floorRecords.push({
        hotel_table_id: hotel.id,
        floor_number: f,
      });
    }

    const createdFloors = await Floor.bulkCreate(floorRecords, {
      transaction: t,
      returning: true,
    });

    /* ---------------- create tables ---------------- */
    const tableRecords = [];
    for (const floor of createdFloors) {
      for (let i = 1; i <= tables_per_floor; i++) {
        tableRecords.push({
          hotel_table_id: hotel.id,
          floor_id: floor.id,
          table_number: i + 1,
        });
      }
    }

    const createdTables = await Table.bulkCreate(tableRecords, {
      transaction: t,
    });

    /* ---------------- re-fetch tables safely ---------------- */
    const tablesForSeats = await Table.findAll({
      where: {
        hotel_table_id: hotel.id,
      },
      transaction: t,
    });

    /* ---------------- create seats ---------------- */
    const seatRecords = [];

    for (const table of tablesForSeats) {
      for (let s = 1; s <= chairs_per_table; s++) {
        seatRecords.push({
          table_id: table.id,
          seat_number: s,
        });
      }
    }

    if (seatRecords.length) {
      await Seat.bulkCreate(seatRecords, { transaction: t });
    }

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Hotel created with floors, tables and seats",
      data: {
        hotel_id: hotel.id,
        floor_per_hotel,
        floors_created: createdFloors.length,
        tables_created: createdTables.length,
        seats_created: seatRecords.length,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Create error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create hotel",
    });
  }
};

/**
 * GET all hotel tables
 */
export const getAllHotelTables = async (req, res) => {
  try {
    const { search, hotel_name, q, location, location_id } = req.query;

    const hotelsWhere = {};

    /* ---------------- location_id filter ---------------- */
    if (location_id) {
      const idNum = Number(location_id);
      if (!isNaN(idNum)) {
        hotelsWhere.location_id = idNum;
      }
    }

    /* ---------------- unified search term ---------------- */
    const term = (search || hotel_name || q || location || "").trim();

    if (term) {
      // 1️⃣ find matching locations by PARTIAL match
      const locations = await Location.findAll({
        where: {
          name: {
            // 🔥 use Op.iLike for PostgreSQL, Op.like for MySQL
            [Op.iLike]: `%${term}%`,
          },
        },
        attributes: ["id"],
      });

      const locationIds = locations.map((l) => l.id);

      // 2️⃣ apply OR condition
      hotelsWhere[Op.or] = [
        {
          hotel_name: {
            [Op.iLike]: `%${term}%`,
          },
        },
        ...(locationIds.length
          ? [
              {
                location_id: {
                  [Op.in]: locationIds,
                },
              },
            ]
          : []),
      ];
    }

    /* ---------------- fetch hotels ---------------- */
    const hotels = await HotelTable.findAll({
      where: hotelsWhere,
      order: [["id", "ASC"]],
    });

    /* ---------------- counts ---------------- */
    const result = await Promise.all(
      hotels.map(async (hotel) => {
        const floorCount = await Floor.count({
          where: { hotel_table_id: hotel.id },
        });

        const tables = await Table.findAll({
          where: { hotel_table_id: hotel.id },
          attributes: ["id"],
        });

        const tableIds = tables.map((t) => t.id);

        const seatCount = tableIds.length
          ? await Seat.count({ where: { table_id: tableIds } })
          : 0;

        return {
          id: hotel.id,
          hotel_name: hotel.hotel_name,
          location_id: hotel.location_id,
          address: hotel.address,
          tables_per_floor: hotel.tables_per_floor,
          chairs_per_table: hotel.chairs_per_table,
          area_id: hotel.area_id,
          floorCount,
          tableCount: tables.length,
          seatCount,
        };
      })
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hotel tables",
    });
  }
};
/**
 * GET hotel table by ID
 */
export const getHotelTableById = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await HotelTable.findByPk(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Hotel table not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Fetch by id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hotel table",
    });
  }
};

/**
 * UPDATE hotel + sync floors, tables, seats
 */
export const updateHotelTable = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      hotel_name,
      location_id,
      area_id,
      address,
      floor_per_hotel,
      tables_per_floor,
      chairs_per_table,
    } = req.body;

    /* -----------------------------
       1️⃣ Fetch hotel
    ------------------------------*/
    const hotel = await HotelTable.findByPk(id, { transaction });

    if (!hotel) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    /* -----------------------------
       2️⃣ Update hotel basic fields
    ------------------------------*/
    await hotel.update(
      {
        hotel_name,
        location_id,
        area_id,
        address,
        tables_per_floor,
        chairs_per_table,
      },
      { transaction }
    );

    /* -----------------------------
       3️⃣ SYNC FLOORS
    ------------------------------*/
    if (Number.isInteger(floor_per_hotel)) {
      const floors = await Floor.findAll({
        where: { hotel_table_id: id },
        order: [["floor_number", "ASC"]],
        transaction,
      });

      const currentFloorCount = floors.length;

      // ➕ Add floors
      if (floor_per_hotel > currentFloorCount) {
        const newFloors = [];
        for (let i = currentFloorCount + 1; i <= floor_per_hotel; i++) {
          newFloors.push({
            hotel_table_id: id,
            floor_number: i,
          });
        }
        await Floor.bulkCreate(newFloors, { transaction });
      }

      // ➖ Remove floors (optional safety check)
      if (floor_per_hotel < currentFloorCount) {
        const floorsToRemove = floors.slice(floor_per_hotel);
        const floorIds = floorsToRemove.map((f) => f.id);

        await Floor.destroy({
          where: { id: floorIds },
          transaction,
        });
      }
    }

    /* -----------------------------
       4️⃣ SYNC TABLES PER FLOOR
    ------------------------------*/
    if (Number.isInteger(tables_per_floor)) {
      const floors = await Floor.findAll({
        where: { hotel_table_id: id },
        transaction,
      });

      for (const floor of floors) {
        const tables = await Table.findAll({
          where: { floor_id: floor.id },
          order: [["table_number", "ASC"]],
          transaction,
        });

        const currentTableCount = tables.length;

        // ➕ Add tables
        if (tables_per_floor > currentTableCount) {
          const newTables = [];
          for (let i = currentTableCount + 1; i <= tables_per_floor; i++) {
            newTables.push({
              hotel_table_id: id, // ✅ REQUIRED
              floor_id: floor.id,
              table_number: i,
            });
          }
          await Table.bulkCreate(newTables, { transaction });
        }

        // ➖ Remove tables (safe delete recommended)
        if (tables_per_floor < currentTableCount) {
          const tablesToRemove = tables.slice(tables_per_floor);
          const tableIds = tablesToRemove.map((t) => t.id);

          await Table.destroy({
            where: { id: tableIds },
            transaction,
          });
        }
      }
    }

    /* -----------------------------
   5️⃣ SYNC CHAIRS (SEATS)
------------------------------*/
    if (Number.isInteger(chairs_per_table)) {
      // 🔴 MUST re-fetch tables AFTER table sync
      const tables = await Table.findAll({
        where: { hotel_table_id: id }, // hotel scoped
        include: [{ model: Seat, as: "seats" }],
        transaction,
      });
      for (const table of tables) {
        const seats = table.seats || [];

        // ✅ SAFE next seat number
        const maxSeatNumber = seats.length
          ? Math.max(...seats.map((s) => s.seat_number))
          : 0;

        /* ➕ ADD SEATS */
        if (chairs_per_table > seats.length) {
          const newSeats = [];

          for (
            let seatNo = maxSeatNumber + 1;
            seatNo <= chairs_per_table;
            seatNo++
          ) {
            newSeats.push({
              table_id: table.id, // ✅ guaranteed to exist
              seat_number: seatNo,
              is_booked: false,
            });
          }

          if (newSeats.length) {
            await Seat.bulkCreate(newSeats, { transaction });
          }
        }

        /* ➖ REMOVE SEATS (only unbooked, highest numbers first) */
        if (chairs_per_table < seats.length) {
          const removableSeats = seats
            .filter((s) => !s.is_booked)
            .sort((a, b) => b.seat_number - a.seat_number)
            .slice(0, seats.length - chairs_per_table);

          const seatIds = removableSeats.map((s) => s.id);

          if (seatIds.length) {
            await Seat.destroy({
              where: { id: seatIds },
              transaction,
            });
          }
        }
      }
    }

    await transaction.commit();

    return res.json({
      success: true,
      message: "Hotel, floors, tables, and seats updated successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update hotel",
    });
  }
};

/**
 * DELETE hotel table
 */
export const deleteHotelTable = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await HotelTable.findByPk(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Hotel table not found",
      });
    }

    await data.destroy();

    res.json({
      success: true,
      message: "Hotel table deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete hotel table",
    });
  }
};
