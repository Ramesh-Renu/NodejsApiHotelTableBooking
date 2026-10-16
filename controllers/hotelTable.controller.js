import HotelTable from "../models/hotelTable.model.js";
import Area from "../models/area.model.js";
import Floor from "../models/floor.model.js";
import Table from "../models/table.model.js";
import Seat from "../models/seat.model.js";
import Reservation from "../models/reservation.model.js";
import Location from "../models/location.model.js";
import ReservationOrder from "../models/reservationOrder.model.js";
import { RESERVATION_STATUS } from "../utils/reservationStatus.js";
import { CLOSED_ORDER_STATUSES } from "../utils/orderStatus.js";
import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import {
  PREFIX_PATTERN,
  normalizePrefix,
  isPrefixTaken,
  makeUniquePrefix,
  suggestPrefixForHotel,
  assignMissingTableCodes,
  renameTableCodes,
} from "../utils/tableCode.js";
import RegisterUsersData from "../models/user.model.js";
import { allowedHotelIds, canAccessHotel } from "../utils/permissions.js";

const NO_HOTEL_ACCESS = {
  success: false,
  message: "You don't have access to this hotel",
};

/**
 * Validates an admin-entered table code prefix. Returns an error message, or
 * null when the prefix is usable.
 */
const checkPrefix = async (prefix, exceptHotelId, transaction) => {
  if (!PREFIX_PATTERN.test(prefix)) {
    return "Table code prefix must be 2-8 letters or digits";
  }
  if (await isPrefixTaken(prefix, exceptHotelId, transaction)) {
    return `Table code prefix "${prefix}" is already used by another hotel`;
  }
  return null;
};

const SEAT_STATUS = {
  BOOKED: 1,
  CANCEL: 2,
  CLEANING: 3,
  AVAILABLE: 4,
};

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
      table_code_prefix,
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

    /* ---------------- table code prefix ---------------- */
    // Admin-entered prefix must be valid and unused; otherwise suggest one
    // from the hotel, location and area names.
    let prefix = normalizePrefix(table_code_prefix);
    if (prefix) {
      const prefixError = await checkPrefix(prefix, null, t);
      if (prefixError) {
        await t.rollback();
        return res.status(409).json({ success: false, message: prefixError });
      }
    } else {
      const suggested = await suggestPrefixForHotel(
        { ...hotelPayload, area_id },
        t
      );
      prefix = await makeUniquePrefix(suggested, null, t);
    }

    /* ---------------- create hotel ---------------- */
    const hotel = await HotelTable.create(
      {
        ...hotelPayload,
        area_id,
        floor_per_hotel, // ✅ store count only
        tables_per_floor, // ✅ ADD THIS
        chairs_per_table, // ✅ ADD THIS
        table_code_prefix: prefix,
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
          table_number: i,
        });
      }
    }

    const createdTables = await Table.bulkCreate(tableRecords, {
      transaction: t,
    });

    // SACT0001, SACT0002 … continuous across floors.
    await assignMissingTableCodes(hotel, t);

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
          status: SEAT_STATUS.AVAILABLE, // ✅ 4
        });
      }
    }

    if (seatRecords.length) {
      await Seat.bulkCreate(seatRecords, { transaction: t });
    }

    await t.commit();

    // An Admin limited to some hotels gets the hotel they just created.
    const scopeIds = await allowedHotelIds(req);
    if (scopeIds) {
      await RegisterUsersData.update(
        { hotel_ids: [...scopeIds, hotel.id] },
        { where: { id: req.user.id } },
      );
    }

    return res.status(201).json({
      success: true,
      message: "Hotel created with floors, tables and seats",
      data: {
        hotel_id: hotel.id,
        table_code_prefix: prefix,
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

    /* ---------------- admin's assigned hotels ---------------- */
    const scopeIds = await allowedHotelIds(req);
    if (scopeIds) {
      hotelsWhere.id = { [Op.in]: scopeIds };
    }

    /* ---------------- fetch hotels ---------------- */
    const hotels = await HotelTable.findAll({
      where: hotelsWhere,
      order: [["id", "DESC"]], // newest hotel first
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
          table_code_prefix: hotel.table_code_prefix,
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

    if (!(await canAccessHotel(req, id))) {
      return res.status(403).json(NO_HOTEL_ACCESS);
    }

    const hotel = await HotelTable.findByPk(id);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel table not found",
        data: [],
      });
    }

    // ---- floor count ----
    const floorCount = await Floor.count({
      where: { hotel_table_id: hotel.id },
    });

    // ---- tables and seats ----
    const tables = await Table.findAll({
      where: { hotel_table_id: hotel.id },
      attributes: ["id"],
    });

    const tableIds = tables.map((t) => t.id);

    const seatCount = tableIds.length
      ? await Seat.count({ where: { table_id: tableIds } })
      : 0;

    // ---- build response ----
    const formatted = {
      id: hotel.id,
      hotel_name: hotel.hotel_name,
      location_id: hotel.location_id,
      address: hotel.address,
      tables_per_floor: hotel.tables_per_floor,
      chairs_per_table: hotel.chairs_per_table,
      area_id: hotel.area_id,
      table_code_prefix: hotel.table_code_prefix,
      floorCount,
      tableCount: tables.length,
      seatCount,
    };

    return res.json({
      success: true,
      data: formatted, // return array
    });
  } catch (error) {
    console.error("Fetch by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hotel table",
      data: [],
    });
  }
};

/**
 * UPDATE hotel + sync floors, tables, seats
 */
export const updateHotelTable = async (req, res) => {
  if (!(await canAccessHotel(req, req.params.id))) {
    return res.status(403).json(NO_HOTEL_ACCESS);
  }
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
      table_code_prefix,
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
    const oldPrefix = hotel.table_code_prefix;
    const newPrefix = normalizePrefix(table_code_prefix) || oldPrefix;
    if (newPrefix && newPrefix !== oldPrefix) {
      const prefixError = await checkPrefix(newPrefix, hotel.id, transaction);
      if (prefixError) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: prefixError });
      }
    }

    await hotel.update(
      {
        hotel_name,
        location_id,
        area_id,
        address,
        tables_per_floor,
        chairs_per_table,
        table_code_prefix: newPrefix,
      },
      { transaction }
    );

    // Existing codes follow the new prefix (SACT0003 -> SNCT0003).
    await renameTableCodes(hotel.id, oldPrefix, newPrefix, transaction);

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
      const tables = await Table.findAll({
        where: { hotel_table_id: id },
        include: [{ model: Seat, as: "seats" }],
        transaction,
      });

      for (const table of tables) {
        const seats = table.seats || [];

        const maxSeatNumber = seats.length
          ? Math.max(...seats.map((s) => s.seat_number))
          : 0;

        /* ➕ ADD SEATS (AVAILABLE = 4) */
        if (chairs_per_table > seats.length) {
          const newSeats = [];

          for (
            let seatNo = maxSeatNumber + 1;
            seatNo <= chairs_per_table;
            seatNo++
          ) {
            newSeats.push({
              table_id: table.id,
              seat_number: seatNo,
              status: SEAT_STATUS.AVAILABLE, // ✅ 4
            });
          }

          if (newSeats.length) {
            await Seat.bulkCreate(newSeats, { transaction });
          }
        }

        /* ➖ REMOVE SEATS (ONLY AVAILABLE = 4) */
        if (chairs_per_table < seats.length) {
          const removableSeats = seats
            .filter((s) => s.status === SEAT_STATUS.AVAILABLE) // ✅ 4
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

    // Tables added above continue the hotel's code sequence.
    await assignMissingTableCodes(hotel, transaction);

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

    if (!(await canAccessHotel(req, id))) {
      return res.status(403).json(NO_HOTEL_ACCESS);
    }

    const data = await HotelTable.findByPk(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Hotel table not found",
      });
    }

    // Don't pull a hotel out from under guests who are booked / dining or
    // food still in the kitchen.
    const activeBookings = await Reservation.count({
      where: {
        hotel_id: data.id,
        dining_status: {
          [Op.in]: [
            RESERVATION_STATUS.PENDING,
            RESERVATION_STATUS.CONFIRMED,
            RESERVATION_STATUS.SEATED,
            RESERVATION_STATUS.SERVING,
            RESERVATION_STATUS.CLEANING,
          ],
        },
      },
    });
    const openOrders = await ReservationOrder.count({
      where: {
        hotel_id: data.id,
        order_status: { [Op.notIn]: CLOSED_ORDER_STATUSES },
      },
    });
    if (activeBookings || openOrders) {
      const parts = [
        activeBookings && `${activeBookings} active booking(s)`,
        openOrders && `${openOrders} open order(s)`,
      ].filter(Boolean);
      return res.status(409).json({
        success: false,
        message: `${data.hotel_name} has ${parts.join(" and ")}. Complete or cancel them before deleting the hotel.`,
      });
    }

    // Soft delete (paranoid model): the hotel is hidden everywhere, but its
    // floors, tables, menus, bookings and orders stay for history.
    await data.destroy();

    res.json({
      success: true,
      message: "Hotel deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete hotel table",
    });
  }
};
