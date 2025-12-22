import Reservation from "../models/reservation.model.js";

export const createReservation = async (req, res) => {
  try {
    const {
      hotel_id,
      table_id,
      seat_id,
      customer_name,
      customer_mobile,
      reservation_date,
      reservation_time,
      guest_count,
    } = req.body;

    // 🔒 Check table availability
    if (table_id) {
      const exists = await Reservation.findOne({
        where: {
          table_id,
          reservation_date,
          reservation_time,
          status: "BOOKED",
        },
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Table already reserved for this time",
        });
      }
    }

    const reservation = await Reservation.create({
      hotel_id,
      table_id,
      seat_id,
      customer_name,
      customer_mobile,
      reservation_date,
      reservation_time,
      guest_count,
    });

    res.status(201).json({
      success: true,
      message: "Reservation created successfully",
      data: reservation,
    });
  } catch (error) {
    res.status(500).json({
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
      order: [["reservation_date", "ASC"]],
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

export const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    reservation.status = "CANCELLED";
    await reservation.save();

    res.json({
      success: true,
      message: "Reservation cancelled successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
