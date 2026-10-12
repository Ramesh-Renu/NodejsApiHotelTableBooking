import Cook from "../models/cook.model.js";
import ReservationOrder from "../models/reservationOrder.model.js";
import ReservationOrderItem from "../models/reservationOrderItem.model.js";
import { createStaffController } from "../utils/staffController.js";

const cooks = createStaffController({
  Model: Cook,
  nameField: "cook_name",
  detailField: "speciality",
  label: "Cook",
  usage: [
    { Model: ReservationOrder, field: "cook_id", noun: "order" },
    { Model: ReservationOrderItem, field: "cook_id", noun: "order item" },
  ],
});

export const getCooks = cooks.list;
export const getCookById = cooks.get;
export const createCook = cooks.create;
export const updateCook = cooks.update;
export const deleteCook = cooks.remove;
