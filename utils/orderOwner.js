import { sequelize } from "../config/db.js";

/**
 * Orders store their owner in user_id. Older orders only had it on their
 * reservation; copy it across. Safe to run on every boot.
 */
export const backfillOrderOwners = async () => {
  const [, result] = await sequelize.query(`
    UPDATE "reservation_orders" AS o
    SET "user_id" = r."user_id"
    FROM "reservations" AS r
    WHERE o."reservation_id" = r."id" AND o."user_id" IS NULL
  `);
  const count = result?.rowCount || 0;
  if (count) console.log(`Orders: set owner on ${count} order(s)`);
};
