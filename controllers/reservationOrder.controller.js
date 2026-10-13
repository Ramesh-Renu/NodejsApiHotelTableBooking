import sequelize from "../config/db.js";

import Reservation from "../models/reservation.model.js";
import ReservationOrder from "../models/reservationOrder.model.js";
import ReservationOrderItem from "../models/reservationOrderItem.model.js";
import Menu from "../models/menu.model.js";
import { Op } from "sequelize";

import HotelTable from "../models/hotelTable.model.js";
import Cook from "../models/cook.model.js";
import Server from "../models/server.model.js";
import { findAssignableStaff } from "../utils/staffController.js";
import { ORDER_STATUS, CLOSED_ORDER_STATUSES } from "../utils/orderStatus.js";
import { PAYMENT_STATUS } from "../utils/paymentStatus.js";
import { RESERVATION_STATUS } from "../utils/reservationStatus.js";

const PAYMENT_METHODS = ["cash", "card", "upi"];

// reservation_order_items.item_status (see the model comment).
const ITEM_STATUS = Object.freeze({
  ORDERED: 1,
  PREPARING: 2,
  READY: 3,
  SERVED: 4,
  CANCELLED: 5,
});
const EDITABLE_ITEM_STATUSES = [
  ITEM_STATUS.ORDERED,
  ITEM_STATUS.PREPARING,
  ITEM_STATUS.READY,
];

// Order stages in which the kitchen is still cooking.
const KITCHEN_ORDER_STATUSES = [
  ORDER_STATUS.ORDERED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
];

const CLOSED_RESERVATION_STATUSES = [
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.CANCELLED,
];

/**
 * POST /api/orders/reservation/:reservationId  (order on a table booking)
 * POST /api/orders                             (order without a booking)
 */
export const createOrder = async (req, res) => {
  // The booking may come from the URL or the body; it is optional.
  const reservationId = req.params.reservationId ?? req.body.reservation_id ?? null;

  if (reservationId !== null && reservationId !== "") {
    const reservationIdNumber = Number(reservationId);
    if (!Number.isInteger(reservationIdNumber) || reservationIdNumber <= 0) {
      return res.status(400).json({
        success: false,
        message: "reservation_id must be a valid id.",
      });
    }
  }
  const hasReservation = reservationId !== null && reservationId !== "";

  let transaction;

  try {
    const { hotel_id, notes, items } = req.body;

    if (!hotel_id) {
      return res.status(400).json({
        success: false,
        message: "hotel_id is required.",
      });
    }

    if (!items || !Array.isArray(items) || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Order items are required.",
      });
    }

    for (const item of items) {
      if (!item.menu_id) {
        return res.status(400).json({
          success: false,
          message: "Each order item must include menu_id.",
        });
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Each order item must include a valid quantity.",
        });
      }
    }

    transaction = await sequelize.transaction();

    const hotel = await HotelTable.findByPk(hotel_id, { transaction });
    if (!hotel) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Hotel not found." });
    }

    const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
    let reservation = null;

    if (hasReservation) {
      reservation = await Reservation.findByPk(reservationId, { transaction });

      if (!reservation) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Reservation not found.",
        });
      }

      if (Number(reservation.hotel_id) !== Number(hotel_id)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "This reservation is for a different hotel.",
        });
      }

      // Customers order only on their own, still-open booking.
      if (!isAdmin) {
        if (Number(reservation.user_id) !== Number(req.user?.id)) {
          await transaction.rollback();
          return res.status(403).json({
            success: false,
            message: "You can only order on your own booking.",
          });
        }
        if (CLOSED_RESERVATION_STATUSES.includes(reservation.dining_status)) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: "This booking is closed. Order without a table or book again.",
          });
        }
      }
    }

    const orderNumber = "ORD-" + Date.now();

    const order = await ReservationOrder.create(
      {
        reservation_id: reservation ? reservation.id : null,

        // The booking's guest when an admin orders for a table, else the caller.
        user_id: reservation ? reservation.user_id : req.user?.id ?? null,

        hotel_id,

        order_number: orderNumber,

        notes,
      },
      { transaction },
    );

    let subtotal = 0;

    for (const item of items) {
      const menu = await Menu.findByPk(item.menu_id, { transaction });

      if (!menu) {
        throw new Error(`Menu ${item.menu_id} not found`);
      }

      if (!menu.is_available) {
        throw new Error(`${menu.menu_name} is unavailable`);
      }

      if (Number(menu.hotel_id) !== Number(hotel_id)) {
        throw new Error(`${menu.menu_name} isn't on this hotel's menu`);
      }

      const unitPrice = Number(menu.price);

      const total = unitPrice * Number(item.quantity);

      subtotal += total;

      await ReservationOrderItem.create(
        {
          reservation_order_id: order.id,

          menu_id: menu.id,

          menu_name: menu.menu_name,

          quantity: item.quantity,

          unit_price: unitPrice,

          total_price: total,

          notes: item.notes || null,
        },
        { transaction },
      );
    }

    const tax = subtotal * 0.05;

    const discount = 0;

    const serviceCharge = 0;

    const totalAmount = subtotal + tax + serviceCharge - discount;

    await order.update(
      {
        subtotal,

        tax,

        discount,

        service_charge: serviceCharge,

        total_amount: totalAmount,
      },
      { transaction },
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,

      message: "Order created successfully.",

      data: order,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();

    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

/**
 * PUT /api/orders/:id/items  { items: [{ menu_id, quantity, notes? }] }
 * Sets the order's item list: unchanged items keep their row (and kitchen
 * status), quantities are updated, missing items are removed, new ones are
 * added at the current menu price. Totals are recalculated (5% tax, as in
 * createOrder).
 */
export const updateOrderItems = async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "An order needs at least one item. Cancel the order instead.",
    });
  }

  const wanted = new Map();
  for (const item of items) {
    const menuId = Number(item?.menu_id);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(menuId) || menuId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Each item needs a valid menu_id.",
      });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Each item needs a quantity of at least 1.",
      });
    }
    const existing = wanted.get(menuId);
    wanted.set(menuId, {
      quantity: (existing?.quantity || 0) + quantity,
      notes: item.notes ?? existing?.notes ?? null,
      // undefined = keep / default, null = no cook
      cook_id:
        item.cook_id === undefined
          ? existing?.cook_id
          : item.cook_id === "" || item.cook_id === null
            ? null
            : Number(item.cook_id),
    });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    const order = await ReservationOrder.findByPk(req.params.id, {
      include: [{ model: ReservationOrderItem, as: "items" }],
      transaction,
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (CLOSED_ORDER_STATUSES.includes(order.order_status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Served, delivered or cancelled orders can't be changed.",
      });
    }

    const current = new Map(
      (order.items || []).map((item) => [Number(item.menu_id), item]),
    );

    // Check every cook named on the items once.
    const cookIds = [...new Set(
      [...wanted.values()].map((item) => item.cook_id).filter((id) => id != null),
    )];
    for (const cookId of cookIds) {
      const { error } = await findAssignableStaff(Cook, cookId, order.hotel_id, {
        nameField: "cook_name",
        label: "cook",
      });
      if (error) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: error });
      }
    }

    // Remove items that are no longer on the order.
    for (const [menuId, item] of current) {
      if (!wanted.has(menuId)) await item.destroy({ transaction });
    }

    let subtotal = 0;
    for (const [menuId, { quantity, notes, cook_id: cookId }] of wanted) {
      const existing = current.get(menuId);

      if (existing) {
        const unitPrice = Number(existing.unit_price);
        const total = unitPrice * quantity;
        subtotal += total;
        const nextCook = cookId === undefined ? existing.cook_id : cookId;
        if (
          existing.quantity !== quantity ||
          (notes ?? null) !== existing.notes ||
          (nextCook ?? null) !== (existing.cook_id ?? null)
        ) {
          await existing.update(
            {
              quantity,
              total_price: total,
              notes: notes ?? existing.notes,
              cook_id: nextCook ?? null,
            },
            { transaction },
          );
        }
        continue;
      }

      const menu = await Menu.findByPk(menuId, { transaction });
      if (!menu || Number(menu.hotel_id) !== Number(order.hotel_id)) {
        throw new Error(`Menu item ${menuId} isn't on this hotel's menu.`);
      }
      if (!menu.is_available) {
        throw new Error(`${menu.menu_name} is unavailable.`);
      }

      const unitPrice = Number(menu.price);
      const total = unitPrice * quantity;
      subtotal += total;
      await ReservationOrderItem.create(
        {
          reservation_order_id: order.id,
          menu_id: menu.id,
          menu_name: menu.menu_name,
          quantity,
          unit_price: unitPrice,
          total_price: total,
          notes,
          // New items default to the order's cook.
          cook_id: cookId === undefined ? order.cook_id ?? null : cookId,
        },
        { transaction },
      );
    }

    const tax = subtotal * 0.05;
    const discount = Number(order.discount) || 0;
    const serviceCharge = Number(order.service_charge) || 0;
    await order.update(
      {
        subtotal,
        tax,
        total_amount: subtotal + tax + serviceCharge - discount,
      },
      { transaction },
    );

    await transaction.commit();

    const updated = await ReservationOrder.findByPk(order.id, {
      include: [
        {
          model: ReservationOrderItem,
          as: "items",
          attributes: ["id", "menu_id", "menu_name", "quantity", "unit_price", "total_price", "item_status", "ready_at", "cook_id"],
          include: [
            {
              model: Cook,
              as: "cook",
              attributes: ["id", "cook_name", "speciality", "photo_url"],
              required: false,
            },
          ],
        },
      ],
    });

    return res.json({
      success: true,
      message: "Order items updated.",
      data: updated,
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search,
      hotel_id,
      reservation_id,
      order_status,
      payment_status,
      from_date,
      to_date,
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const where = {};

    if (hotel_id) where.hotel_id = hotel_id;

    if (reservation_id) where.reservation_id = reservation_id;

    if (order_status !== undefined) where.order_status = order_status;

    if (payment_status !== undefined) where.payment_status = payment_status;

    if (from_date && to_date) {
      where.createdAt = {
        [Op.between]: [new Date(from_date), new Date(to_date)],
      };
    }

    if (search) {
      where[Op.or] = [
        {
          order_number: {
            [Op.iLike]: `%${search}%`,
          },
        },
      ];
    }

    const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";

    const reservationInclude = {
      model: Reservation,
      as: "reservation",
      attributes: ["id", "user_id", "dining_status", "server_id"],
      // The table's server: reused when its orders are served.
      include: [
        {
          model: Server,
          as: "server",
          attributes: ["id", "server_name", "section", "photo_url", "is_active"],
          required: false,
        },
      ],
    };

    if (!isAdmin) {
      // Customers see their own orders, with or without a booking.
      where.user_id = req.user.id;
    }
    reservationInclude.required = false;

    const { rows, count } = await ReservationOrder.findAndCountAll({
      where,

      include: [
        reservationInclude,

        {
          model: HotelTable,
          as: "hotel",
          // Keep showing the name of a since-deleted (soft) hotel in history.
          paranoid: false,
          attributes: ["id", "hotel_name"],
        },

        {
          model: Cook,
          as: "cook",
          attributes: ["id", "cook_name", "speciality", "photo_url"],
          required: false,
        },

        {
          model: Server,
          as: "server",
          attributes: ["id", "server_name", "section", "photo_url"],
          required: false,
        },

        {
          model: ReservationOrderItem,
          as: "items",
          attributes: [
            "id",
            "menu_id",
            "menu_name",
            "quantity",
            "unit_price",
            "total_price",
            "item_status",
            "ready_at",
            "cook_id",
          ],
          include: [
            {
              model: Cook,
              as: "cook",
              attributes: ["id", "cook_name", "speciality", "photo_url"],
              required: false,
            },
          ],
        },
      ],

      order: [["createdAt", "DESC"]],

      limit,

      offset: (page - 1) * limit,
    });

    return res.json({
      success: true,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await ReservationOrder.findByPk(req.params.id, {
      include: [
        {
          model: Reservation,
          as: "reservation",
        },

        {
          model: HotelTable,
          as: "hotel",
          paranoid: false, // history still names a since-deleted hotel
        },

        {
          model: ReservationOrderItem,
          as: "items",

          include: [
            {
              model: Menu,
              as: "menu",
              attributes: ["id", "image", "description"],
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getReservationOrders = async (req, res) => {
  try {
    const orders = await ReservationOrder.findAll({
      where: {
        reservation_id: req.params.reservationId,
      },

      include: [
        {
          model: ReservationOrderItem,
          as: "items",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      count: orders.length,
      rows: orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const recalculateOrder = async (orderId, transaction) => {
  const items = await ReservationOrderItem.findAll({
    where: {
      reservation_order_id: orderId,
      item_status: {
        [Op.ne]: 5, // Ignore cancelled items
      },
    },
    transaction,
  });

  let subtotal = 0;

  items.forEach((item) => {
    subtotal += Number(item.total_price);
  });

  const tax = subtotal * 0.05;
  const discount = 0;
  const service_charge = 0;

  const total_amount = subtotal + tax + service_charge - discount;

  await ReservationOrder.update(
    {
      subtotal,
      tax,
      discount,
      service_charge,
      total_amount,
    },
    {
      where: {
        id: orderId,
      },
      transaction,
    },
  );
};

export const updateOrder = async (req, res) => {
  try {
    const order = await ReservationOrder.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    await order.update({
      notes: req.body.notes,
    });

    return res.json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const order = await ReservationOrder.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!Object.values(ORDER_STATUS).includes(Number(req.body.order_status))) {
      return res.status(400).json({
        success: false,
        message: "Invalid order_status",
      });
    }

    // Table orders are served; orders without a booking are delivered.
    const nextStatus = Number(req.body.order_status);
    if (nextStatus === ORDER_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: "Completed is no longer a stage. Served or Delivered completes an order.",
      });
    }
    // A finished order keeps its status (its server can still be changed).
    if (
      CLOSED_ORDER_STATUSES.includes(order.order_status) &&
      nextStatus !== order.order_status
    ) {
      return res.status(400).json({
        success: false,
        message: "This order is already finished and can't move to another stage.",
      });
    }
    // Once cooking has started it is finished (Ready) or dropped (cancel).
    if (
      order.order_status === ORDER_STATUS.PREPARING &&
      ![ORDER_STATUS.PREPARING, ORDER_STATUS.READY].includes(nextStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "An order being prepared can only move to Ready or be cancelled.",
      });
    }
    if (nextStatus === ORDER_STATUS.SERVED && !order.reservation_id) {
      return res.status(400).json({
        success: false,
        message: "This order has no table booking. Move it to Delivered instead of Served.",
      });
    }
    if (nextStatus === ORDER_STATUS.DELIVERED && order.reservation_id) {
      return res.status(400).json({
        success: false,
        message: "This is a table order. Move it to Served instead of Delivered.",
      });
    }

    // Served without naming a server: the table's own server (set on the
    // Reservations page) serves it.
    if (
      nextStatus === ORDER_STATUS.SERVED &&
      req.body.server_id === undefined &&
      !order.server_id &&
      order.reservation_id
    ) {
      const booking = await Reservation.findByPk(order.reservation_id, {
        attributes: ["server_id"],
      });
      if (booking?.server_id) order.server_id = booking.server_id;
    }

    const previousCookId = order.cook_id;

    // Optional staff assignment: cook when accepted, server when served.
    const staffFields = [
      { field: "cook_id", Model: Cook, nameField: "cook_name", label: "cook" },
      { field: "server_id", Model: Server, nameField: "server_name", label: "server" },
    ];
    for (const { field, Model, nameField, label } of staffFields) {
      if (req.body[field] === undefined) continue;
      if (req.body[field] === null || req.body[field] === "") {
        order[field] = null;
        continue;
      }
      const staff = await Model.findByPk(req.body[field]);
      if (!staff || !staff.is_active) {
        return res.status(400).json({
          success: false,
          message: `Select an active ${label}.`,
        });
      }
      if (staff.hotel_id && staff.hotel_id !== order.hotel_id) {
        return res.status(400).json({
          success: false,
          message: `${staff[nameField]} does not work at this hotel.`,
        });
      }
      order[field] = staff.id;
    }

    order.order_status = req.body.order_status;

    // Record when each end stage was reached (first time only).
    const now = new Date();
    // Served / Delivered finish the order, so they also set completed_at.
    // Preparing timer starts the first time the kitchen starts cooking.
    if (nextStatus === ORDER_STATUS.PREPARING && !order.preparing_at) order.preparing_at = now;
    if (nextStatus === ORDER_STATUS.SERVED && !order.served_at) order.served_at = now;
    if (nextStatus === ORDER_STATUS.DELIVERED && !order.delivered_at) order.delivered_at = now;
    if (
      [ORDER_STATUS.SERVED, ORDER_STATUS.DELIVERED].includes(nextStatus) &&
      !order.completed_at
    ) {
      order.completed_at = now;
    }

    await order.save();

    // A Ready order means the kitchen is done: every dish counts as prepared.
    if (nextStatus === ORDER_STATUS.READY) {
      await ReservationOrderItem.update(
        { item_status: ITEM_STATUS.READY, ready_at: new Date() },
        {
          where: {
            reservation_order_id: order.id,
            item_status: { [Op.notIn]: [ITEM_STATUS.READY, ITEM_STATUS.CANCELLED] },
          },
        },
      );
    }

    // The order's cook becomes the cook of every item that had none (or had
    // the previous order cook); items given their own cook keep it.
    if (req.body.cook_id !== undefined && order.cook_id !== previousCookId) {
      await ReservationOrderItem.update(
        { cook_id: order.cook_id },
        {
          where: {
            reservation_order_id: order.id,
            [Op.or]: [{ cook_id: null }, { cook_id: previousCookId ?? null }],
          },
        },
      );
    }

    return res.json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const order = await ReservationOrder.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!Object.values(PAYMENT_STATUS).includes(Number(req.body.payment_status))) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment_status",
      });
    }

    const paymentStatus = Number(req.body.payment_status);
    const method =
      typeof req.body.payment_method === "string"
        ? req.body.payment_method.trim().toLowerCase()
        : null;

    if (paymentStatus === PAYMENT_STATUS.PAID && method && !PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: `payment_method must be one of: ${PAYMENT_METHODS.join(", ")}.`,
      });
    }

    order.payment_status = paymentStatus;
    // A method only makes sense once paid; keep the old one when not sent.
    if (paymentStatus === PAYMENT_STATUS.PENDING) order.payment_method = null;
    else if (method) order.payment_method = method;

    await order.save();

    return res.json({
      success: true,
      message: "Payment status updated successfully",
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PATCH /api/orders/:id/items/:itemId/status   { item_status }
 * Kitchen progress of one dish, e.g. ticking it as prepared (3 = Ready).
 */
export const updateOrderItemStatus = async (req, res) => {
  try {
    const itemStatus = Number(req.body.item_status);
    if (!EDITABLE_ITEM_STATUSES.includes(itemStatus)) {
      return res.status(400).json({
        success: false,
        message: `item_status must be one of: ${EDITABLE_ITEM_STATUSES.join(", ")}.`,
      });
    }

    const order = await ReservationOrder.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (CLOSED_ORDER_STATUSES.includes(order.order_status)) {
      return res.status(400).json({
        success: false,
        message: "This order is already completed or cancelled.",
      });
    }

    // Dishes are ticked only while the kitchen is cooking (or fixing a Ready order).
    if (![ORDER_STATUS.PREPARING, ORDER_STATUS.READY].includes(order.order_status)) {
      return res.status(400).json({
        success: false,
        message: "Move the order to Preparing before ticking dishes.",
      });
    }

    const item = await ReservationOrderItem.findOne({
      where: { id: req.params.itemId, reservation_order_id: order.id },
    });
    if (!item) {
      return res.status(404).json({ success: false, message: "Order item not found" });
    }
    if (item.item_status === ITEM_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "This item is cancelled.",
      });
    }

    await sequelize.transaction(async (transaction) => {
      // ready_at freezes this dish's cooking time; un-ticking clears it.
      await item.update(
        {
          item_status: itemStatus,
          ready_at: itemStatus === ITEM_STATUS.READY ? new Date() : null,
        },
        { transaction },
      );

      // Every dish prepared → the order is Ready; a dish un-ticked on a
      // Ready order → back to Preparing.
      const dishes = await ReservationOrderItem.findAll({
        where: {
          reservation_order_id: order.id,
          item_status: { [Op.ne]: ITEM_STATUS.CANCELLED },
        },
        attributes: ["item_status"],
        transaction,
      });
      const allReady =
        dishes.length > 0 &&
        dishes.every((dish) => dish.item_status === ITEM_STATUS.READY);

      let nextStatus = order.order_status;
      if (allReady && KITCHEN_ORDER_STATUSES.includes(order.order_status)) {
        nextStatus = ORDER_STATUS.READY;
      } else if (!allReady && order.order_status === ORDER_STATUS.READY) {
        nextStatus = ORDER_STATUS.PREPARING;
      }
      if (nextStatus !== order.order_status) {
        await order.update(
          {
            order_status: nextStatus,
            ...(nextStatus === ORDER_STATUS.PREPARING && !order.preparing_at
              ? { preparing_at: new Date() }
              : {}),
          },
          { transaction },
        );
      }
    });

    return res.json({
      success: true,
      message:
        itemStatus === ITEM_STATUS.READY
          ? `${item.menu_name} is prepared`
          : `${item.menu_name} marked as not prepared`,
      data: item,
      order_status: order.order_status,
      preparing_at: order.preparing_at,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const order = await ReservationOrder.findByPk(req.params.id, {
      transaction,
    });

    if (!order) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (CLOSED_ORDER_STATUSES.includes(order.order_status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "This order is already completed or cancelled.",
      });
    }

    // Customers cancel only their own order, before the kitchen accepts it.
    const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
    if (!isAdmin) {
      if (Number(order.user_id) !== Number(req.user?.id)) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: "You can only cancel your own order.",
        });
      }
      if (order.order_status !== ORDER_STATUS.ORDERED) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "The kitchen has already accepted this order, so it can't be cancelled.",
        });
      }
    }

    order.order_status = ORDER_STATUS.CANCELLED;

    await order.save({
      transaction,
    });

    await ReservationOrderItem.update(
      {
        item_status: 5,
      },
      {
        where: {
          reservation_order_id: order.id,
        },
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      success: true,

      message: "Order cancelled successfully",
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
