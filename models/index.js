import HotelTable from "./hotelTable.model.js";
import Floor from "./floor.model.js";
import Table from "./table.model.js";
import Seat from "./seat.model.js";
import Reservation from "./reservation.model.js";
import MenuCategory from "./menuCategory.model.js";
import Menu from "./menu.model.js";
import ReservationOrder from "./reservationOrder.model.js";
import Cook from "./cook.model.js";
import Server from "./server.model.js";
import Cleaner from "./cleaner.model.js";
import ReservationOrderItem from "./reservationOrderItem.model.js";
import OrderStatusMaster from "./orderStatusMaster.model.js";
import PaymentStatusMaster from "./paymentStatusMaster.model.js";
import SpiceLevelMaster from "./spiceLevelMaster.model.js";
import MenuSideDish from "./menuSideDish.model.js";
import MenuSideDishMapping from "./menuSideDishMapping.model.js";
import SideDish from "./sideDish.model.js";

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

SpiceLevelMaster.hasMany(Menu, {
  foreignKey: "spice_level",
  as: "menus",
  constraints: false,
});

Menu.belongsTo(SpiceLevelMaster, {
  foreignKey: "spice_level",
  as: "spiceLevel",
  constraints: false,
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

/* ==========================================================
   ORDER ↔ COOK (assigned on accept), COOK ↔ HOTEL (optional)
   No DB constraints: cook_id / hotel_id are nullable and checked in code.
   ========================================================== */
ReservationOrder.belongsTo(Cook, {
    foreignKey: "cook_id",
    as: "cook",
    constraints: false,
});
Cook.hasMany(ReservationOrder, {
    foreignKey: "cook_id",
    as: "orders",
    constraints: false,
});
Cook.belongsTo(HotelTable, {
    foreignKey: "hotel_id",
    as: "hotel",
    constraints: false,
});

/* RESERVATION ↔ SERVER (chosen when confirmed); ORDER ITEM ↔ COOK */
Reservation.belongsTo(Server, {
    foreignKey: "server_id",
    as: "server",
    constraints: false,
});
Reservation.belongsTo(Cleaner, {
    foreignKey: "cleaner_id",
    as: "cleaner",
    constraints: false,
});
Cleaner.belongsTo(HotelTable, {
    foreignKey: "hotel_id",
    as: "hotel",
    constraints: false,
});
ReservationOrderItem.belongsTo(Cook, {
    foreignKey: "cook_id",
    as: "cook",
    constraints: false,
});

/* ORDER ↔ SERVER (assigned when served), SERVER ↔ HOTEL (optional) */
ReservationOrder.belongsTo(Server, {
    foreignKey: "server_id",
    as: "server",
    constraints: false,
});
Server.hasMany(ReservationOrder, {
    foreignKey: "server_id",
    as: "orders",
    constraints: false,
});
Server.belongsTo(HotelTable, {
    foreignKey: "hotel_id",
    as: "hotel",
    constraints: false,
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

// Menu → Mapping
Menu.hasMany(MenuSideDishMapping, {
  foreignKey: "menu_id",
  as: "sideDishes",
});

// SideDish → Mapping
MenuSideDish.hasMany(MenuSideDishMapping, {
  foreignKey: "side_dish_id",
  as: "menuMappings",
});
MenuSideDishMapping.belongsTo(MenuSideDish, {
  foreignKey: "side_dish_id",
  as: "sideDish",
});

MenuSideDishMapping.belongsTo(Menu, {
  foreignKey: "menu_id",
  as: "menu",
});

MenuCategory.hasMany(SideDish, {
  foreignKey: "category_id",
  as: "sideDishes",
});

SideDish.belongsTo(MenuCategory, {
  foreignKey: "category_id",
  as: "category",
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
  SpiceLevelMaster,
  MenuSideDish,
  MenuSideDishMapping,
  SideDish
};
