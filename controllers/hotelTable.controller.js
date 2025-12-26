import HotelTable from "../models/hotelTable.model.js";
import Area from "../models/area.model.js";
import Floor from "../models/floor.model.js";
import Table from "../models/table.model.js";
import Seat from "../models/seat.model.js";
import Location from "../models/location.model.js";
import { Op } from "sequelize";
import { sequelize } from "../config/db.js";

/**
 * CREATE hotel table
 */
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
          floor_number: floor.floor_number,
          table_number:
            (floor.floor_number - 1) * tables_per_floor + i,
        });
      }
    }

    const createdTables = await Table.bulkCreate(tableRecords, {
      transaction: t,
      returning: true,
    });

    /* ---------------- create seats ---------------- */
    const seatRecords = [];
    for (const table of createdTables) {
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
 * UPDATE hotel table
 */
export const updateHotelTable = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await HotelTable.findByPk(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Hotel table not found",
      });
    }
    await data.update(req.body);

    res.json({
      success: true,
      message: "Hotel table updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update hotel table",
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
