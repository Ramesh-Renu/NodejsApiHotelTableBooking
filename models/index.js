import HotelTable from "./hotelTable.model.js";
import Floor from "./floor.model.js";
import Table from "./table.model.js";
import Seat from "./seat.model.js";
import Reservation from "./reservation.model.js";
import MenuCategory from "./menuCategory.model.js";
import Menu from "./menu.model.js";
import ReservationOrder from "./reservationOrder.model.js";
import ReservationOrderItem from "./reservationOrderItem.model.js";
import OrderStatusMaster from "./orderStatusMaster.model.js";
import PaymentStatusMaster from "./paymentStatusMaster.model.js";

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

HotelTable.hasMany(MenuCategory, {
  foreignKey: "hotel_id",
  as: "menuCategories",
});

MenuCategory.belongsTo(HotelTable, {
  foreignKey: "hotel_id",
  as: "hotel",
});

MenuCategory.hasMany(Menu, {
  foreignKey: "category_id",
  as: "menus",
});

Menu.belongsTo(MenuCategory, {
  foreignKey: "category_id",
  as: "category",
});

Menu.belongsTo(HotelTable, {
  foreignKey: "hotel_id",
  as: "hotel",
});

Reservation.hasMany(ReservationOrder, {
    foreignKey: "reservation_id",
    as: "orders",
});

ReservationOrder.belongsTo(Reservation, {
    foreignKey: "reservation_id",
    as: "reservation",
});

HotelTable.hasMany(ReservationOrder, {
    foreignKey: "hotel_id",
    as: "orders",
});

ReservationOrder.belongsTo(HotelTable, {
    foreignKey: "hotel_id",
    as: "hotel",
});

ReservationOrder.hasMany(ReservationOrderItem, {
  foreignKey: "reservation_order_id",
  as: "items",
});

ReservationOrderItem.belongsTo(ReservationOrder, {
  foreignKey: "reservation_order_id",
  as: "order",
});

Menu.hasMany(ReservationOrderItem, {
  foreignKey: "menu_id",
  as: "orderItems",
});

ReservationOrderItem.belongsTo(Menu, {
  foreignKey: "menu_id",
  as: "menu",
});

export {
  HotelTable,
  Floor,
  Table,
  Seat,
  Reservation,
  MenuCategory,
  Menu,
  ReservationOrder,
  ReservationOrderItem,
  OrderStatusMaster,
  PaymentStatusMaster,
};
