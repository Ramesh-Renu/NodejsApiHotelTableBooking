import Reservation from "../models/reservation.model.js";
import Seat from "../models/seat.model.js";
import HotelTable from "../models/hotelTable.model.js";
import Floor from "../models/floor.model.js";
import { sequelize } from "../config/db.js";
import { SEAT_STATUS } from "../utils/seatStatus.js";
import { RESERVATION_STATUS } from "../utils/reservationStatus.js";
import CancelReservation from "../models/CancelledReservation.js";
import { Op } from "sequelize";
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
      { transaction }
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
      }
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
          (c) => c.table_id === table.table_id
        );

        if (!cancelForTable) return table;

        const remainingSeatIds = table.seat_ids.filter(
          (id) => !cancelForTable.seat_ids.includes(id)
        );

        const removedSeatIds = table.seat_ids.filter((id) =>
          cancelForTable.seat_ids.includes(id)
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
      { transaction }
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
      }
    );
    // 🧾 Save full cancellation snapshot
    await CancelReservation.create(
      {
        reservation_id: reservationId, // ⭐ FIXED
        seat_status: cancel_seats,
        cancelled_at: new Date(),
      },
      { transaction }
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

export const getReservationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }
    const reservations = await Reservation.findAll({
      where: {
        user_id: userId,
        seat_status: {
          [Op.ne]: [], // means seat_status NOT empty array
        },
      },
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

    res.json({
      success: true,
      data: [...reservations],
    });
  } catch (error) {
    console.error("Get reservation by user error:", error);
    res.status(500).json({
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
      }
    );

    // 🧾 Save full cancellation snapshot
    await CancelReservation.create(
      {
        reservation_id: id,
        seat_status: reservation.seat_status,
        cancelled_at: new Date(),
      },
      { transaction }
    );

    // ❌ Cancel reservation
    await reservation.update(
      { dining_status: RESERVATION_STATUS.CANCELLED },
      { transaction }
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
 * UPDATE reservation dining status
 */
export const updateDiningStatus = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { dining_status } = req.body;

    // basic validation
    if (!reservationId || !dining_status) {
      return res.status(400).json({
        success: false,
        message: "reservationId and dining_status are required",
      });
    }

    const reservation = await Reservation.findByPk(reservationId);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    await Reservation.update(
      { dining_status },
      { where: { id: reservationId } }
    );

    return res.status(200).json({
      success: true,
      message: "Dining status updated successfully",
      data: { reservationId, dining_status },
    });
  } catch (error) {
    console.error("Dining status update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update dining status",
    });
  }
};
