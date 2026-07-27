import sequelize from "../config/db.js";

import Reservation from "../models/reservation.model.js";
import ReservationOrder from "../models/reservationOrder.model.js";
import ReservationOrderItem from "../models/reservationOrderItem.model.js";
import Menu from "../models/menu.model.js";
import { Op } from "sequelize";

import HotelTable from "../models/hotelTable.model.js";
import { ORDER_STATUS } from "../utils/orderStatus.js";
import { PAYMENT_STATUS } from "../utils/paymentStatus.js";

export const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { reservationId } = req.params;

    const { hotel_id, notes, items } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Order items are required.",
      });
    }

    const reservation = await Reservation.findByPk(reservationId, {
      transaction,
    });

    if (!reservation) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Reservation not found.",
      });
    }

    const orderNumber = "ORD-" + Date.now();

    const order = await ReservationOrder.create(
      {
        reservation_id: reservationId,

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
    await transaction.rollback();

    return res.status(500).json({
      success: false,

      message: error.message,
    });
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

    const { rows, count } = await ReservationOrder.findAndCountAll({
      where,

      include: [
        {
          model: Reservation,
          as: "reservation",
          attributes: ["id", "user_id", "dining_status"],
        },

        {
          model: HotelTable,
          as: "hotel",
          attributes: ["id", "hotel_name"],
        },

        {
          model: ReservationOrderItem,
          as: "items",
          attributes: [
            "id",
            "menu_name",
            "quantity",
            "unit_price",
            "total_price",
            "item_status",
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

    order.order_status = req.body.order_status;

    if (req.body.order_status == ORDER_STATUS.COMPLETED) {
      order.completed_at = new Date();
    }

    await order.save();

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

    order.payment_status = req.body.payment_status;

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
