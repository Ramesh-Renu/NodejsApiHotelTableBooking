import Table from "../models/table.model.js";

/**
 * Reservations store seat_status as [{ table_id, seat_ids }]. Adds each
 * table's table_code / table_number so clients can show "SACT0001" instead
 * of the internal id. Returns plain objects.
 */
export const attachTableCodes = async (reservations) => {
  const rows = reservations.map((row) => (row?.toJSON ? row.toJSON() : row));
  const parse = (value) => (typeof value === "string" ? JSON.parse(value) : value);

  const tableIds = new Set();
  for (const row of rows) {
    for (const table of parse(row.seat_status) || []) {
      if (table?.table_id) tableIds.add(Number(table.table_id));
    }
  }
  if (tableIds.size === 0) return rows;

  const tables = await Table.findAll({
    where: { id: [...tableIds] },
    attributes: ["id", "table_code", "table_number"],
  });
  const byId = new Map(tables.map((table) => [table.id, table]));

  return rows.map((row) => ({
    ...row,
    seat_status: (parse(row.seat_status) || []).map((entry) => {
      const table = byId.get(Number(entry?.table_id));
      return table
        ? { ...entry, table_code: table.table_code, table_number: table.table_number }
        : entry;
    }),
  }));
};
