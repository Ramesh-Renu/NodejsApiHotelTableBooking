import HotelTable from "./hotelTable.model.js";
import Floor from "./floor.model.js";
import Table from "./table.model.js";
import Seat from "./seat.model.js";

/* Hotel → Floor */
HotelTable.hasMany(Floor, {
  foreignKey: "hotel_table_id",
  as: "floors",
});
Floor.belongsTo(HotelTable, {
  foreignKey: "hotel_table_id",
  as: "hotel",
});

/* Floor → Table */
Floor.hasMany(Table, {
  foreignKey: "floor_id",
  as: "tables",
});
Table.belongsTo(Floor, {
  foreignKey: "floor_id",
  as: "floor",
});

/* Table → Seat */
Table.hasMany(Seat, {
  foreignKey: "table_id",
  onDelete: "CASCADE",
  as: "seats",
});
Seat.belongsTo(Table, {
  foreignKey: "table_id",
  as: "table",
});
