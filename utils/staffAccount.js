import RegisterUsersData from "../models/user.model.js";
import Cook from "../models/cook.model.js";
import Server from "../models/server.model.js";
import Cleaner from "../models/cleaner.model.js";
import HotelTable from "../models/hotelTable.model.js";
import Location from "../models/location.model.js";
import Area from "../models/area.model.js";
import { sequelize } from "../config/db.js";
import { Op } from "sequelize";
import {
  ROLES,
  USER_TYPE,
  intersectHotelIds,
  intersectPermissions,
  isStaffMember,
  loadAccess,
  roleOf,
  sanitizeHotelIds,
  sanitizePermissions,
} from "./permissions.js";

/**
 * Cooks, servers and cleaners get a Staff user (Settings → Staff users) so
 * they can sign in with OTP: category Member, their hotel, and the board
 * their job needs. Linked by <staff table>.user_id; the login is the
 * staff record's phone, when it is a 10-digit mobile number.
 */

// Pages each kind of worker starts with (never more than the person adding them has).
const JOB_PERMISSIONS = {
  Cook: { orders: ["view", "edit"] },
  Server: { reservations: ["view", "edit"], orders: ["view", "edit"] },
  Cleaner: { reservations: ["view", "edit"] },
};

/** "+91 98765 43210" / "098765 43210" / "9876543210" → "9876543210"; else null. */
export const normalizeMobile = (phone) => {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
};

/** Hotels for the account: the record's hotel (null = all), within the creator's hotels. */
const hotelIdsFor = (row, creator) =>
  intersectHotelIds(row.hotel_id ? [Number(row.hotel_id)] : null, creator?.hotelIds ?? null);

/** A Staff user created from a cook/server/cleaner record (safe to sync / remove). */
const isLinkedAccount = (user) => user && isStaffMember(user.role) && Boolean(user.staff_type);

/**
 * Creates (or links) the Staff user for a just-saved record. Returns a short
 * note for the API response.
 */
export const linkStaffAccount = async (row, { label, nameField }, req) => {
  const mobile = normalizeMobile(row.phone);
  if (!mobile) {
    return "Add a 10-digit mobile number to give them a staff login.";
  }

  const existing = await RegisterUsersData.findOne({ where: { mobilenumber: mobile } });
  if (existing && roleOf(existing.role) !== ROLES.USER) {
    // Already staff / admin: link only, their access stays as it is.
    await row.update({ user_id: existing.id });
    return `Linked to the existing account for ${mobile}.`;
  }

  // No request = the start-up backfill: job defaults, no creator.
  const creator = req ? await loadAccess(req) : null;
  const jobPermissions = JOB_PERMISSIONS[label] || {};
  const values = {
    name: row[nameField],
    ...(row.email && { email: row.email }),
    role: ROLES.STAFF,
    user_type_id: USER_TYPE.STAFF,
    staff_category: "Member",
    staff_type: label,
    permissions: creator
      ? intersectPermissions(jobPermissions, sanitizePermissions(creator.permissions, { forStaff: true }))
      : jobPermissions,
    hotel_ids: hotelIdsFor(row, creator),
    is_active: row.is_active !== false,
    created_by: req?.user?.id ?? null,
    ...NOT_REMOVED,
  };

  // A guest with this number becomes staff (they keep their bookings).
  const user = existing
    ? await existing.update(values)
    : await RegisterUsersData.create({ ...values, mobilenumber: mobile });
  await row.update({ user_id: user.id });
  return `Staff login created (Member, sign-in mobile ${mobile}).`;
};

/**
 * After a record is edited: keeps its Staff user's name, active flag and
 * hotel in step, or links a new one when the mobile number changed.
 * `before` holds the record's phone and hotel_id before the edit.
 */
export const syncStaffAccount = async (row, options, req, before) => {
  const user = row.user_id ? await RegisterUsersData.findByPk(row.user_id) : null;
  const mobile = normalizeMobile(row.phone);

  // No login yet (e.g. added before this, or the number was added now).
  if (!user) return mobile ? linkStaffAccount(row, options, req) : null;
  // Mobile number changed: the new number gets the login.
  if (mobile && mobile !== user.mobilenumber && normalizeMobile(before.phone) !== mobile) {
    if (isLinkedAccount(user)) await releaseStaffAccount(row, req?.user?.id ?? null);
    return linkStaffAccount(row, options, req);
  }
  if (!isLinkedAccount(user)) return null;

  const updates = { name: row[options.nameField], is_active: row.is_active !== false };
  if (Number(before.hotel_id || 0) !== Number(row.hotel_id || 0)) {
    updates.hotel_ids = hotelIdsFor(row, await loadAccess(req));
  }
  await user.update(updates);
  return null;
};

/** Before a record is deleted: its Staff user goes back to being a guest. */
export const releaseStaffAccount = async (row, removedBy = null) => {
  const user = row.user_id ? await RegisterUsersData.findByPk(row.user_id) : null;
  if (!isLinkedAccount(user)) return;
  // The record is being deleted / re-linked, so leave it as it is.
  await removeAccess(user, removedBy, { deactivateRecords: false });
};

/** Clears the "removed" marks (on retrieve, or when the number is staff again). */
export const NOT_REMOVED = { removed_at: null, removed_by: null, previous_access: null };

/**
 * Removes a Staff / Admin user's access: the account becomes a guest (they
 * keep their bookings and orders) and is listed in Inactive users, with the
 * access they had saved so it can be retrieved.
 */
export const removeAccess = async (user, removedBy = null, { deactivateRecords = true } = {}) => {
  // Their Cook / Server / Cleaner record goes Inactive too (no assignments).
  if (deactivateRecords) await setRecordsActive(user, false);
  await user.update({
    previous_access: {
      role: user.role,
      user_type_id: user.user_type_id,
      staff_category: user.staff_category,
      staff_type: user.staff_type,
      permissions: user.permissions,
      hotel_ids: user.hotel_ids,
      created_by: user.created_by,
    },
    removed_at: new Date(),
    removed_by: removedBy,
    role: ROLES.USER,
    user_type_id: USER_TYPE.USER,
    staff_category: null,
    staff_type: null,
    permissions: null,
    hotel_ids: null,
    created_by: null,
  });
};

/**
 * On start-up: cooks / servers / cleaners added before Staff users existed
 * (no user_id yet) get their Staff user, when their phone is a 10-digit
 * mobile. Created with no creator, so every Admin whose hotels cover them
 * can manage them (controllers/staffUser.controller.js).
 */
export const backfillStaffAccounts = async () => {
  await deactivateRemovedRecords();
  const kinds = [
    { Model: Cook, label: "Cook", nameField: "cook_name" },
    { Model: Server, label: "Server", nameField: "server_name" },
    { Model: Cleaner, label: "Cleaner", nameField: "cleaner_name" },
  ];
  let linked = 0;
  let noMobile = 0;
  for (const { Model, label, nameField } of kinds) {
    const rows = await Model.findAll({ where: { user_id: null } });
    for (const row of rows) {
      if (!normalizeMobile(row.phone)) {
        noMobile += 1;
        continue;
      }
      try {
        await linkStaffAccount(row, { label, nameField }, null);
        linked += 1;
      } catch (error) {
        console.warn(`Staff login for ${label} ${row.id} failed: ${error.message}`);
      }
    }
  }
  if (linked || noMobile) {
    console.log(
      `Staff users: ${linked} cook/server/cleaner login(s) added; ${noMobile} skipped (no 10-digit mobile in Phone)`,
    );
  }
};

const RECORDS = {
  Cook: { Model: Cook, nameField: "cook_name" },
  Server: { Model: Server, nameField: "server_name" },
  Cleaner: { Model: Cleaner, nameField: "cleaner_name" },
};

/** Sets the Cook / Server / Cleaner record(s) linked to this user active / inactive. */
export const setRecordsActive = async (user, active) => {
  const record = RECORDS[user.staff_type];
  if (!record) return;
  await record.Model.update({ is_active: active }, { where: { user_id: user.id } });
};

/** SQL for a staff record's access_removed flag (its login is in Inactive users). */
const removedUsersSql = `SELECT "id" FROM "registerUsersData" WHERE "removed_at" IS NOT NULL`;

/** Attribute for findAll: [literal, "access_removed"] on a cook / server / cleaner list. */
export const accessRemovedAttribute = (Model) => [
  sequelize.literal(`("${Model.name}"."user_id" IN (${removedUsersSql}))`),
  "access_removed",
];

/** True when this record's login was removed (retrieve it before activating). */
export const isAccessRemoved = async (row) => {
  if (!row.user_id) return false;
  const user = await RegisterUsersData.findByPk(row.user_id, { attributes: ["removed_at"] });
  return Boolean(user?.removed_at);
};

/**
 * On start-up: records whose login was removed before records were
 * switched off with it are set Inactive now.
 */
export const deactivateRemovedRecords = async () => {
  for (const { Model } of Object.values(RECORDS)) {
    const [count] = await Model.update(
      { is_active: false },
      { where: { is_active: true, user_id: { [Op.in]: sequelize.literal(`(${removedUsersSql})`) } } },
    );
    if (count) console.log(`${count} ${Model.name.toLowerCase()}(s) set inactive: access removed`);
  }
};

/**
 * Sub-query of active Staff users who may work at `hotelId` (their hotels
 * include it, or all hotels), for the cook/server/cleaner pick lists.
 * Null when hotelId isn't a valid id.
 */
export const linkedUsersForHotel = (hotelId) => {
  const id = Number(hotelId);
  if (!Number.isInteger(id) || id < 1) return null;
  return sequelize.literal(`(
    SELECT "id" FROM "registerUsersData"
    WHERE "role" ILIKE 'staff' AND "is_active" = TRUE
      AND ("hotel_ids" IS NULL OR "hotel_ids" @> '[${id}]'::jsonb)
  )`);
};

/**
 * Hotels from a cook/server/cleaner's active Staff user: an id list, null
 * for all hotels, or undefined when there is no such login.
 */
export const linkedAccountHotelIds = async (row) => {
  if (!row.user_id) return undefined;
  const user = await RegisterUsersData.findByPk(row.user_id, {
    attributes: ["role", "hotel_ids", "is_active"],
  });
  if (!user || !isStaffMember(user.role) || user.is_active === false) return undefined;
  return sanitizeHotelIds(user.hotel_ids);
};

/**
 * After a Staff user added from Cooks / Servers / Cleaners is edited in
 * Settings → Staff users: copy name and active flag to the record, and the
 * hotel when exactly one is picked (several / all hotels are covered by
 * linkedUsersForHotel instead).
 */
export const syncRecordFromAccount = async (user) => {
  const record = RECORDS[user.staff_type];
  if (!record || !isStaffMember(user.role)) return;
  const rows = await record.Model.findAll({ where: { user_id: user.id } });
  if (!rows.length) return;

  const ids = sanitizeHotelIds(user.hotel_ids);
  const hotel =
    ids?.length === 1
      ? await HotelTable.findByPk(ids[0], { attributes: ["id", "location_id", "area_id"] })
      : null;

  for (const row of rows) {
    const updates = { [record.nameField]: user.name, is_active: user.is_active !== false };
    if (hotel && Number(row.hotel_id) !== hotel.id) {
      // The old hotel's floor doesn't apply to the new hotel.
      Object.assign(updates, {
        hotel_id: hotel.id,
        location_id: hotel.location_id ?? null,
        area_id: hotel.area_id ?? null,
        floor_id: null,
      });
    }
    await row.update(updates);
  }
};

// Staff categories that supervise: never picked to cook / serve / clean.
export const NOT_ASSIGNABLE_CATEGORIES = ["Manager"];

/** Sub-query of Staff users who can't be assigned work (Managers). */
export const unassignableUsers = () =>
  sequelize.literal(`(
    SELECT "id" FROM "registerUsersData"
    WHERE "role" ILIKE 'staff'
      AND "staff_category" IN (${NOT_ASSIGNABLE_CATEGORIES.map((c) => `'${c}'`).join(", ")})
  )`);

/** True when a cook/server/cleaner's Staff user is a Manager. */
export const isUnassignable = async (row) => {
  if (!row.user_id) return false;
  const user = await RegisterUsersData.findByPk(row.user_id, {
    attributes: ["role", "staff_category"],
  });
  return Boolean(
    user && isStaffMember(user.role) && NOT_ASSIGNABLE_CATEGORIES.includes(user.staff_category),
  );
};

/**
 * For the Staff users / Admin users tables: adds photo_url, location_name and
 * area_name to each user. They come from the person's cook / server /
 * cleaner record when there is one, else from their hotel when they have
 * exactly one.
 */
export const withProfileDetails = async (users) => {
  const rows = users.map((user) => (user.toJSON ? user.toJSON() : user));
  const ids = rows.map((user) => user.id);
  if (!ids.length) return rows;

  const records = (
    await Promise.all(
      [Cook, Server, Cleaner].map((Model) =>
        Model.findAll({
          where: { user_id: ids },
          attributes: ["user_id", "photo_url", "location_id", "area_id"],
        }),
      ),
    )
  ).flat();
  const recordOf = new Map(records.map((record) => [Number(record.user_id), record]));

  const singleHotel = (user) => {
    const hotelIds = sanitizeHotelIds(user.hotel_ids);
    return hotelIds?.length === 1 ? hotelIds[0] : null;
  };
  const hotelIds = [...new Set(rows.map(singleHotel).filter(Boolean))];
  const hotels = hotelIds.length
    ? await HotelTable.findAll({ where: { id: hotelIds }, attributes: ["id", "location_id", "area_id"] })
    : [];
  const hotelOf = new Map(hotels.map((hotel) => [hotel.id, hotel]));

  const placeOf = (user) => {
    const record = recordOf.get(Number(user.id));
    const hotel = hotelOf.get(singleHotel(user));
    return {
      record,
      location_id: record?.location_id ?? hotel?.location_id ?? null,
      area_id: record?.area_id ?? hotel?.area_id ?? null,
    };
  };
  const places = rows.map(placeOf);

  const locationIds = [...new Set(places.map((p) => p.location_id).filter(Boolean))];
  const areaIds = [...new Set(places.map((p) => p.area_id).filter(Boolean))];
  const [locations, areas] = await Promise.all([
    locationIds.length ? Location.findAll({ where: { id: locationIds }, attributes: ["id", "name"] }) : [],
    areaIds.length ? Area.findAll({ where: { id: areaIds }, attributes: ["id", "name"] }) : [],
  ]);
  const nameIn = (list, id) => list.find((row) => row.id === Number(id))?.name ?? null;

  return rows.map((user, index) => ({
    ...user,
    photo_url: places[index].record?.photo_url ?? null,
    location_name: nameIn(locations, places[index].location_id),
    area_name: nameIn(areas, places[index].area_id),
  }));
};
