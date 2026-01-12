import HotelTable from "./hotelTable.model.js";
import Floor from "./floor.model.js";
import Table from "./table.model.js";
import Seat from "./seat.model.js";
import Reservation from "./reservation.model.js";

/* ==========================================================
   HOTEL ↔ FLOORS
   ========================================================== */
HotelTable.hasMany(Floor, {
  foreignKey: "hotel_table_id",
  as: "floors",
});
Floor.belongsTo(HotelTable, {
  foreignKey: "hotel_table_id",
  as: "hotel",
});

/* ==========================================================
   FLOOR ↔ TABLES
   ========================================================== */
Floor.hasMany(Table, {
  foreignKey: "floor_id",
  as: "tables",
});
Table.belongsTo(Floor, {
  foreignKey: "floor_id",
  as: "floor",
});

/* ==========================================================
   TABLE ↔ SEATS
   ========================================================== */
Table.hasMany(Seat, {
  foreignKey: "table_id",
  onDelete: "CASCADE",
  as: "seats",
});
Seat.belongsTo(Table, {
  foreignKey: "table_id",
  as: "table",
});

/* ==========================================================
   RESERVATION ↔ HOTEL
   ========================================================== */
Reservation.belongsTo(HotelTable, {
  foreignKey: "hotel_id",
  as: "hotel",
});
HotelTable.hasMany(Reservation, {
  foreignKey: "hotel_id",
  as: "reservations",
});

/* ==========================================================
   RESERVATION ↔ FLOOR
   ========================================================== */
Reservation.belongsTo(Floor, {
  foreignKey: "floor_id",
  as: "floor",
});
Floor.hasMany(Reservation, {
  foreignKey: "floor_id",
  as: "reservations",
});

export { HotelTable, Floor, Table, Seat, Reservation };
