// Served (table orders) and Delivered (no booking) are the final stages;
// COMPLETED is kept only so old rows still have a name. See CLOSED below.
export const ORDER_STATUS = Object.freeze({
  NOT_ORDERED: 0,
  ORDERED: 1,
  ACCEPTED: 2,
  PREPARING: 3,
  READY: 4,
  SERVED: 5,
  COMPLETED: 6,
  CANCELLED: 7,
  // Orders without a table booking are delivered instead of served.
  DELIVERED: 8,
});

// Orders in these statuses are finished and can't be changed.
export const CLOSED_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.SERVED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
]);

