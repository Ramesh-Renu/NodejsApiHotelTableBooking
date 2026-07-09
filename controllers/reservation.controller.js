import Reservation from "../models/reservation.model.js";
import Seat from "../models/seat.model.js";
import HotelTable from "../models/hotelTable.model.js";
import Floor from "../models/floor.model.js";
import { sequelize } from "../config/db.js";
import { SEAT_STATUS } from "../utils/seatStatus.js";
import { RESERVATION_STATUS } from "../utils/reservationStatus.js";
import CancelReservation from "../models/CancelledReservation.js";
import RegisterUsersData from "../models/user.model.js";
import Table from "../models/table.model.js";

import { Op } from "sequelize";

const ISO_DATE = "YYYY-MM-DD";
const formatDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeRange = (startDate, endDate) => {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return start <= end ? [start, end] : [end, start];
};

const getDurationDays = (start, end) =>
  Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

const getAggregationType = (days) => {
  if (days <= 30) return "daily";
  if (days <= 90) return "weekly";
  return "monthly";
};

const buildTrendPeriods = (start, end, aggregation) => {
  const periods = [];
  if (aggregation === "daily") {
    const cursor = new Date(start);
    while (cursor <= end) {
      periods.push({
        label: cursor.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        }),
        start: new Date(cursor),
        end: new Date(cursor.setHours(23, 59, 59, 999)),
      });
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }
    return periods;
  }

  if (aggregation === "weekly") {
    let cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + 6);
      if (bucketEnd > end) bucketEnd.setTime(end.getTime());
      periods.push({
        label: `${bucketStart.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        })} - ${bucketEnd.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        })}`,
        start: bucketStart,
        end: bucketEnd,
      });
      cursor = new Date(bucketEnd);
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }
    return periods;
  }

  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    if (bucketStart < start) bucketStart.setTime(start.getTime());
    if (bucketEnd > end) bucketEnd.setTime(end.getTime());
    periods.push({
      label: bucketStart.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      }),
      start: bucketStart,
      end: bucketEnd,
    });
    cursor.setMonth(cursor.getMonth() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return periods;
};

const aggregateTrend = (reservations, periods) => {
  const trend = periods.map((period) => ({
    label: period.label,
    created: 0,
    cancelled: 0,
    completed: 0,
  }));

  reservations.forEach((reservation) => {
    const diningDate = new Date(reservation.dining_date);
    const index = periods.findIndex(
      (period) => diningDate >= period.start && diningDate <= period.end,
    );
    if (index < 0) return;

    trend[index].created += 1;
    if (reservation.dining_status === RESERVATION_STATUS.CANCELLED) {
      trend[index].cancelled += 1;
    }
    if (reservation.dining_status === RESERVATION_STATUS.COMPLETED) {
      trend[index].completed += 1;
    }
  });

  return trend;
};

const getUniqueBookedTables = (reservations) => {
  const tableIds = new Set();
  reservations.forEach((reservation) => {
    const seatStatus = Array.isArray(reservation.seat_status)
      ? reservation.seat_status
      : typeof reservation.seat_status === "string"
      ? JSON.parse(reservation.seat_status)
      : [];

    seatStatus.forEach((item) => {
      if (item?.table_id) {
        tableIds.add(item.table_id);
      }
    });
  });
  return tableIds.size;
};

/**
 * CREATE RESERVATION
 */
export const createReservation = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    /* ---------------- AUTH USER ---------------- */
    const authUserId = req.user?.id;
    if (!authUserId) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    /* ---------------- REQUEST DATA ---------------- */
    const {
      hotel_id,
      floor_id,
      seat_status,
      customer_name,
      customer_mobile,
      // booking_date,
      dining_date,
      reservation_time,
    } = req.body;

    /* ---------------- BASIC VALIDATION ---------------- */
    if (
      !hotel_id ||
      !floor_id ||
      !Array.isArray(seat_status) ||
      seat_status.length === 0 ||
      // !booking_date ||
      !reservation_time
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid reservation payload",
      });
    }

    /* ---------------- FLATTEN SEAT IDS ---------------- */
    const seatIds = [];
    const tableSeatMap = [];

    for (const t of seat_status) {
      if (Array.isArray(t.seat_ids) && t.seat_ids.length) {
        seatIds.push(...t.seat_ids);
        tableSeatMap.push({
          table_id: t.table_id,
          seat_ids: t.seat_ids,
        });
      }
    }

    if (seatIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No seat IDs provided",
      });
    }

    /* ---------------- LOCK & VALIDATE SEATS ---------------- */
    const availableSeats = await Seat.findAll({
      where: {
        id: seatIds,
        status: SEAT_STATUS.AVAILABLE,
      },
      transaction,
      lock: transaction.LOCK.UPDATE, // 🔐 prevents race condition
    });

    if (availableSeats.length !== seatIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "One or more seats are already booked",
      });
    }

    /* ---------------- CREATE RESERVATION ---------------- */
    const reservation = await Reservation.create(
      {
        user_id: authUserId,
        hotel_id,
        floor_id,
        start_time: reservation_time,
        seat_status,
        customer_name,
        customer_mobile,
        dining_status: RESERVATION_STATUS.CONFIRMED, // <-- default value
        dining_date: dining_date,
      },
      { transaction },
    );

    const reservationId = reservation.id;

    /* ---------------- UPDATE SEATS ---------------- */
    await Seat.update(
      {
        status: SEAT_STATUS.BOOKED,
        reservation_id: reservationId,
        isActive: true,
      },
      {
        where: {
          id: seatIds,
          status: SEAT_STATUS.AVAILABLE, // ✅ critical guard
        },
        transaction,
      },
    );
    /* ---------------- COMMIT ---------------- */
    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Reservation created and seats booked successfully",
      data: {
        reservation_id: reservationId,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Create reservation error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateReservation = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { reservationId } = req.params;
    const { cancel_seats } = req.body;

    if (!Array.isArray(cancel_seats) || cancel_seats.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cancel Seats is required",
      });
    }

    /* ---------------- FETCH RESERVATION ---------------- */
    const reservation = await Reservation.findByPk(reservationId, {
      transaction,
    });

    if (!reservation) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    let seatStatus =
      typeof reservation.seat_status === "string"
        ? JSON.parse(reservation.seat_status)
        : reservation.seat_status;

    if (!Array.isArray(seatStatus)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid seat_status data",
      });
    }

    /* ---------------- PROCESS CANCELLATION ---------------- */
    const cancelledSeatIds = [];

    const updatedSeatStatus = seatStatus
      .map((table) => {
        const cancelForTable = cancel_seats.find(
          (c) => c.table_id === table.table_id,
        );

        if (!cancelForTable) return table;

        const remainingSeatIds = table.seat_ids.filter(
          (id) => !cancelForTable.seat_ids.includes(id),
        );

        const removedSeatIds = table.seat_ids.filter((id) =>
          cancelForTable.seat_ids.includes(id),
        );

        cancelledSeatIds.push(...removedSeatIds);

        return {
          ...table,
          seat_ids: remainingSeatIds,
        };
      })
      .filter((t) => t.seat_ids.length > 0);

    if (cancelledSeatIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No matching seats found to cancel",
      });
    }

    /* ---------------- VALIDATE SEATS BELONG TO THIS RESERVATION ---------------- */
    const seatsToCancel = await Seat.findAll({
      where: {
        id: cancelledSeatIds,
        reservation_id: reservationId, // ✅ critical check
        status: SEAT_STATUS.BOOKED,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (seatsToCancel.length !== cancelledSeatIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Some seats do not belong to this reservation",
      });
    }

    /* ---------------- UPDATE RESERVATION ---------------- */
    await reservation.update(
      {
        seat_status: updatedSeatStatus,
      },
      { transaction },
    );

    /* ---------------- RELEASE SEATS ---------------- */
    await Seat.update(
      {
        status: SEAT_STATUS.AVAILABLE,
        reservation_id: null, // ✅ REQUIRED
        isActive: true,
      },
      {
        where: {
          id: cancelledSeatIds,
          reservation_id: reservationId, // ✅ SAFETY
        },
        transaction,
      },
    );
    // 🧾 Save full cancellation snapshot
    await CancelReservation.create(
      {
        reservation_id: reservationId, // ⭐ FIXED
        seat_status: cancel_seats,
        cancelled_at: new Date(),
      },
      { transaction },
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: "Seats cancelled successfully",
      // cancelled_seat_ids: cancelledSeatIds,
      // updated_seat_status: updatedSeatStatus,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update reservation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getReservationsByHotel = async (req, res) => {
  try {
    const { hotelId } = req.params;

    const reservations = await Reservation.findAll({
      where: { hotel_id: hotelId },
      order: [["dining_date", "DESC"]],
    });

    res.json({
      success: true,
      data: reservations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getDashboardSummary = async (req, res) => {
  try {
    const user = await RegisterUsersData.findByPk(req.user.id, {
      attributes: ["id", "user_type_id"],
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const isAdmin = [0, 1].includes(user.user_type_id);
    const reservationScope = isAdmin ? {} : { user_id: req.user.id };

    const params = req.method === "POST" ? req.body : req.query;
    const { start_date, end_date } = params || {};
    const normalizedRange = normalizeRange(start_date, end_date);
    let periodStart;
    let periodEnd;

    if (normalizedRange) {
      [periodStart, periodEnd] = normalizedRange;
    }

    const now = new Date();
    if (!periodStart || !periodEnd) {
      periodEnd = new Date(now);
      periodEnd.setHours(23, 59, 59, 999);
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 6);
      periodStart.setHours(0, 0, 0, 0);
    }

    const durationDays = getDurationDays(periodStart, periodEnd);
    const aggregation = getAggregationType(durationDays);
    const trendPeriods = buildTrendPeriods(periodStart, periodEnd, aggregation);

    const [hotels, tables, seats, periodReservations, recent] = await Promise.all([
      HotelTable.count(),
      Table.count({ where: { isActive: true } }),
      Seat.findAll({ where: { isActive: true }, attributes: ["status"] }),
      Reservation.findAll({
        where: { ...reservationScope, dining_date: { [Op.between]: [periodStart, periodEnd] } },
        attributes: ["id", "dining_date", "dining_status", "seat_status", "hotel_id"],
      }),
      Reservation.findAll({
        where: { ...reservationScope, dining_date: { [Op.between]: [periodStart, periodEnd] } },
        limit: 6,
        order: [["dining_date", "DESC"], ["start_time", "DESC"]],
        attributes: ["id", "dining_date", "start_time", "dining_status", "seat_status"],
        include: [{ model: HotelTable, as: "hotel", attributes: ["id", "hotel_name"] }],
      }),
    ]);

    const countStatus = (status) =>
      periodReservations.filter((reservation) => reservation.dining_status === status).length;
    const bookedSeats = seats.filter((seat) => [1, 2, 3, 5].includes(seat.status)).length;
    const tablesBooked = getUniqueBookedTables(periodReservations);
    const hotelsWithBookings = new Set(periodReservations.map((reservation) => reservation.hotel_id)).size;
    const trend = aggregateTrend(periodReservations, trendPeriods);

    return res.json({
      success: true,
      data: {
        isAdmin,
        totals: {
          hotels,
          hotelsWithBookings,
          tables,
          tablesBooked,
          seats: seats.length,
          occupiedSeats: bookedSeats,
          occupancyRate: seats.length ? Math.round((bookedSeats / seats.length) * 100) : 0,
          todayBookings: periodReservations.length,
        },
        todayStatus: {
          created: periodReservations.length,
          confirmed: countStatus(RESERVATION_STATUS.CONFIRMED),
          seated: countStatus(RESERVATION_STATUS.SEATED),
          completed: countStatus(RESERVATION_STATUS.COMPLETED),
          cancelled: countStatus(RESERVATION_STATUS.CANCELLED),
          pending: countStatus(RESERVATION_STATUS.PENDING),
        },
        trend: {
          aggregation,
          points: trend,
        },
        recent,
      },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getReservations = async (req, res) => {
  try {
    // 🔐 Assume user ID comes from auth middleware (JWT/session)
    const loggedInUserId = req.user.id;

    // ---------------- GET USER ROLE ----------------
    const user = await RegisterUsersData.findOne({
      where: { id: loggedInUserId },
      attributes: ["id", "user_type_id"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { user_type_id } = user;

    // ---------------- WHERE CONDITION ----------------
    const whereCondition = {
      seat_status: {
        [Op.ne]: [],
      },
    };

    // 👤 Normal users → only their data
    if (![0, 1].includes(user_type_id)) {
      whereCondition.user_id = loggedInUserId;
    }

    // ---------------- FETCH RESERVATIONS ----------------
    const reservations = await Reservation.findAll({
      where: whereCondition,
      order: [["dining_date", "DESC"]],
      include: [
        {
          model: HotelTable,
          as: "hotel",
          attributes: ["id", "hotel_name"],
        },
        {
          model: Floor,
          as: "floor",
          attributes: ["id", "floor_number"],
        },
      ],
    });

    return res.json({
      success: true,
      data: reservations,
    });
  } catch (error) {
    console.error("Get reservations error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const cancelReservationSeats = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const reservation = await Reservation.findByPk(id, { transaction });
    if (!reservation) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    // 🔓 Release all seats
    await Seat.update(
      {
        status: SEAT_STATUS.AVAILABLE,
        reservation_id: null,
        isActive: true,
      },
      {
        where: { reservation_id: id },
        transaction,
      },
    );

    // 🧾 Save full cancellation snapshot
    await CancelReservation.create(
      {
        reservation_id: id,
        seat_status: reservation.seat_status,
        cancelled_at: new Date(),
      },
      { transaction },
    );

    // ❌ Cancel reservation
    await reservation.update(
      { dining_status: RESERVATION_STATUS.CANCELLED },
      { transaction },
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Reservation cancelled successfully",
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * UPDATE reservation dining status + sync seat status
 */
export const updateDiningStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { reservationId } = req.params;
    const { dining_status } = req.body;

    if (!reservationId || !dining_status) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "reservationId and dining_status are required",
      });
    }

    /* ---------------- FETCH RESERVATION ---------------- */
    const reservation = await Reservation.findByPk(reservationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!reservation) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    /* ---------------- MAP SEAT STATUS ---------------- */
    const RESERVATION_TO_SEAT_MAP = {
      [RESERVATION_STATUS.PENDING]: SEAT_STATUS.AVAILABLE, // 1 → 4
      [RESERVATION_STATUS.CONFIRMED]: SEAT_STATUS.BOOKED, // 2 → 1
      [RESERVATION_STATUS.SEATED]: SEAT_STATUS.SEATED, // 3 → 5
      [RESERVATION_STATUS.COMPLETED]: SEAT_STATUS.AVAILABLE, // 4 → 4
      [RESERVATION_STATUS.CANCELLED]: SEAT_STATUS.AVAILABLE, // 5 → 4
      [RESERVATION_STATUS.CLEANING]: SEAT_STATUS.CLEANING, // 6 → 3
    };
    const seatStatusToUpdate = RESERVATION_TO_SEAT_MAP[dining_status];
console.log('seatStatusToUpdate',seatStatusToUpdate);

    if (!seatStatusToUpdate) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid dining status",
      });
    }

    /* ---------------- UPDATE RESERVATION ---------------- */
    await reservation.update({ dining_status }, { transaction });

    /* ---------------- UPDATE SEATS ---------------- */
    const seatUpdatePayload =
      seatStatusToUpdate === SEAT_STATUS.AVAILABLE
        ? {
            status: SEAT_STATUS.AVAILABLE,
            reservation_id: null,
            isActive: true,
          }
        : {
            status: seatStatusToUpdate,
            isActive: true,
          };

    await Seat.update(seatUpdatePayload, {
      where: { reservation_id: reservationId },
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Dining status and seat status updated successfully",
      data: {
        reservationId,
        dining_status,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Dining status update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update dining status",
    });
  }
};
