import { Op } from "sequelize";
import HotelTable from "../models/hotelTable.model.js";
import Floor from "../models/floor.model.js";
import Table from "../models/table.model.js";
import Location from "../models/location.model.js";
import Area from "../models/area.model.js";

/**
 * Table codes look like SACT0001: a per-hotel prefix plus a 4-digit number
 * that runs continuously across every floor of the hotel.
 */

export const PREFIX_PATTERN = /^[A-Z0-9]{2,8}$/;
const SEQ_DIGITS = 4;

const lettersOf = (value = "") =>
  String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** 2 letters of the hotel + first letter of location + first letter of area. */
export const suggestPrefix = (hotelName, locationName, areaName) => {
  const prefix =
    lettersOf(hotelName).slice(0, 2) +
    lettersOf(locationName).slice(0, 1) +
    lettersOf(areaName).slice(0, 1);
  return prefix.length >= 2 ? prefix : "TB";
};

export const normalizePrefix = (value) => lettersOf(value).slice(0, 8);

export const formatTableCode = (prefix, seq) =>
  `${prefix}${String(seq).padStart(SEQ_DIGITS, "0")}`;

const seqOf = (code, prefix) => {
  if (!code || !code.startsWith(prefix)) return 0;
  const seq = parseInt(code.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : 0;
};

/** Is this prefix already used by a different hotel? */
export const isPrefixTaken = async (prefix, exceptHotelId, transaction) => {
  const where = { table_code_prefix: prefix };
  if (exceptHotelId) where.id = { [Op.ne]: exceptHotelId };
  // paranoid: false — a deleted hotel's tables keep their codes, so its
  // prefix stays reserved.
  return Boolean(await HotelTable.findOne({ where, transaction, paranoid: false }));
};

/** Returns `base`, or base2, base3… until one is free. */
export const makeUniquePrefix = async (base, exceptHotelId, transaction) => {
  let candidate = base;
  for (let n = 2; await isPrefixTaken(candidate, exceptHotelId, transaction); n++) {
    candidate = `${base.slice(0, 7)}${n}`;
  }
  return candidate;
};

/** Suggested prefix for a hotel from its own name, location and area. */
export const suggestPrefixForHotel = async (hotel, transaction) => {
  const [location, area] = await Promise.all([
    hotel.location_id ? Location.findByPk(hotel.location_id, { transaction }) : null,
    hotel.area_id ? Area.findByPk(hotel.area_id, { transaction }) : null,
  ]);
  return suggestPrefix(hotel.hotel_name, location?.name, area?.name);
};

/**
 * Gives every table of the hotel that has no code yet the next free code,
 * in floor → table order.
 */
export const assignMissingTableCodes = async (hotel, transaction) => {
  const prefix = hotel.table_code_prefix;
  if (!prefix) return 0;

  const tables = await Table.findAll({
    where: { hotel_table_id: hotel.id },
    include: [{ model: Floor, as: "floor", attributes: ["floor_number"] }],
    transaction,
  });

  let seq = tables.reduce(
    (max, table) => Math.max(max, seqOf(table.table_code, prefix)),
    0,
  );

  const missing = tables
    .filter((table) => !table.table_code)
    .sort(
      (a, b) =>
        (a.floor?.floor_number ?? 0) - (b.floor?.floor_number ?? 0) ||
        a.table_number - b.table_number ||
        a.id - b.id,
    );

  for (const table of missing) {
    seq += 1;
    await table.update(
      { table_code: formatTableCode(prefix, seq) },
      { transaction },
    );
  }
  return missing.length;
};

/** Swap the prefix on all of a hotel's existing table codes. */
export const renameTableCodes = async (hotelId, oldPrefix, newPrefix, transaction) => {
  if (!oldPrefix || oldPrefix === newPrefix) return;
  const tables = await Table.findAll({
    where: { hotel_table_id: hotelId, table_code: { [Op.ne]: null } },
    transaction,
  });
  for (const table of tables) {
    if (table.table_code.startsWith(oldPrefix)) {
      await table.update(
        { table_code: newPrefix + table.table_code.slice(oldPrefix.length) },
        { transaction },
      );
    }
  }
};

/**
 * Startup backfill: hotels created before table codes existed get a prefix,
 * and any table without a code gets one. Safe to run on every boot.
 */
export const backfillTableCodes = async () => {
  const hotels = await HotelTable.findAll({ order: [["id", "ASC"]] });
  let hotelsUpdated = 0;
  let tablesUpdated = 0;

  for (const hotel of hotels) {
    if (!hotel.table_code_prefix) {
      const base = await suggestPrefixForHotel(hotel);
      await hotel.update({
        table_code_prefix: await makeUniquePrefix(base, hotel.id),
      });
      hotelsUpdated += 1;
    }
    tablesUpdated += await assignMissingTableCodes(hotel);
  }

  if (hotelsUpdated || tablesUpdated) {
    console.log(
      `Table codes: set prefix on ${hotelsUpdated} hotel(s), coded ${tablesUpdated} table(s)`,
    );
  }
};
