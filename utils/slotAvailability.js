import { Op } from "sequelize";
import Reservation from "../models/reservation.model.js";
import { RESERVATION_STATUS } from "./reservationStatus.js";

/**
 * Time-slot availability. A booking holds its seats for SLOT_MINUTES from its
 * dining time; two bookings conflict when those windows overlap.
 */
export const SLOT_MINUTES = 60;
const SLOT_MS = SLOT_MINUTES * 60 * 1000;

// Dining times are local restaurant times (same offset as config/db.js).
const TZ_OFFSET = process.env.APP_TZ_OFFSET || "+05:30";

const CLOSED_STATUSES = [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.CANCELLED];

/** "2026-10-13" + "20:00" → Date, or null when either part is invalid. */
export const parseSlot = (date, time) => {
  const day = String(date || "").slice(0, 10);
  const hm = String(time || "").slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(hm)) return null;
  const start = new Date(`${day}T${hm}:00${TZ_OFFSET}`);
  return Number.isNaN(start.getTime()) ? null : start;
};

export const slotEnd = (start) => new Date(start.getTime() + SLOT_MS);

/** Date → "6:15 PM" in restaurant time (TZ_OFFSET), whatever the server's zone. */
export const formatLocalTime = (date) => {
  const [, sign, hh, mm] = /^([+-])(\d{2}):(\d{2})$/.exec(TZ_OFFSET) || [null, "+", "05", "30"];
  const offsetMin = (sign === "-" ? -1 : 1) * (Number(hh) * 60 + Number(mm));
  const local = new Date(new Date(date).getTime() + offsetMin * 60000);
  const hours = local.getUTCHours();
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
};

/** "20:30" → "21:30" (end of the slot, wraps past midnight). */
export const slotEndTime = (hm) => {
  const [h, m] = String(hm).slice(0, 5).split(":").map(Number);
  const total = (h * 60 + m + SLOT_MINUTES) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** True when the slot is happening now or starts within the next hour. */
export const slotIsLive = (start, now = new Date()) =>
  start.getTime() < now.getTime() + SLOT_MS && slotEnd(start) > now;

/**
 * Seats held by other open bookings whose window overlaps [start, start+60).
 * Returns Map(seatId → { reservation_id, user_id, ends_at }) — ends_at is
 * when that booking's 60-minute hold ends (the seat is expected free).
 */
export const getHeldSeats = async (hotelId, start, { excludeReservationId, transaction } = {}) => {
  const end = slotEnd(start);
  const where = {
    hotel_id: hotelId,
    dining_status: { [Op.notIn]: CLOSED_STATUSES },
    // Overlap: other.start < end AND other.start + 60min > start
    dining_date: {
      [Op.lt]: end,
      [Op.gt]: new Date(start.getTime() - SLOT_MS),
    },
  };
  if (excludeReservationId) where.id = { [Op.ne]: excludeReservationId };

  const reservations = await Reservation.findAll({
    where,
    attributes: ["id", "user_id", "seat_status", "dining_date"],
    transaction,
  });

  const held = new Map();
  for (const reservation of reservations) {
    const tables =
      typeof reservation.seat_status === "string"
        ? JSON.parse(reservation.seat_status)
        : reservation.seat_status;
    for (const table of Array.isArray(tables) ? tables : []) {
      for (const seatId of table.seat_ids || []) {
        held.set(Number(seatId), {
          reservation_id: reservation.id,
          user_id: reservation.user_id,
          ends_at: reservation.dining_date ? slotEnd(new Date(reservation.dining_date)) : null,
        });
      }
    }
  }
  return held;
};
