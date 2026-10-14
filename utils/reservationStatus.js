// seatStatus.js
export const RESERVATION_STATUS = Object.freeze({
  PENDING: 5,
  CONFIRMED: 1,
  SEATED: 2,
  COMPLETED: 3,
  CANCELLED: 4,
  CLEANING: 6,
  SERVING: 7,
});

/**
 * Stage history for the booking tracker: the booking's status_history with
 * `status` entered at `at` added (nothing added when it is already the
 * current stage). Assign the result to reservation.status_history.
 */
export const withStageEntry = (reservation, status, at = new Date()) => {
  let history = Array.isArray(reservation?.status_history) ? reservation.status_history : [];
  // Bookings made before the tracker: start from what is known — confirmed
  // when booked, and the current stage since the last update.
  if (!history.length && reservation?.dining_status) {
    const toIso = (value) => (value ? new Date(value).toISOString() : at.toISOString());
    history = [{ status: RESERVATION_STATUS.CONFIRMED, at: toIso(reservation.booking_date) }];
    if (Number(reservation.dining_status) !== RESERVATION_STATUS.CONFIRMED) {
      // The model maps updatedAt to the updated_at column.
      history.push({
        status: Number(reservation.dining_status),
        at: toIso(reservation.updated_at ?? reservation.updatedAt),
      });
    }
  }
  const last = history[history.length - 1];
  if (last && Number(last.status) === Number(status)) return history;
  return [...history, { status: Number(status), at: at.toISOString() }];
};
