import { sequelize } from "../config/db.js";

/**
 * "Completed" is no longer an order stage: Served (table orders) and
 * Delivered (no booking) finish an order. Moves old Completed orders to the
 * matching final stage, keeping their finish time. Safe to run on every boot.
 */
export const migrateCompletedOrders = async () => {
  const [, result] = await sequelize.query(`
    UPDATE "reservation_orders"
    SET "order_status" = CASE WHEN "reservation_id" IS NULL THEN 8 ELSE 5 END,
        "served_at" = CASE
          WHEN "reservation_id" IS NOT NULL THEN COALESCE("served_at", "completed_at", "updatedAt")
          ELSE "served_at" END,
        "delivered_at" = CASE
          WHEN "reservation_id" IS NULL THEN COALESCE("delivered_at", "completed_at", "updatedAt")
          ELSE "delivered_at" END
    WHERE "order_status" = 6
  `);
  const count = result?.rowCount || 0;
  if (count) console.log(`Orders: moved ${count} Completed order(s) to Served / Delivered`);
};
