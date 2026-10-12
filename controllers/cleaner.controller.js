import Cleaner from "../models/cleaner.model.js";
import Reservation from "../models/reservation.model.js";
import { createStaffController } from "../utils/staffController.js";

const cleaners = createStaffController({
  Model: Cleaner,
  nameField: "cleaner_name",
  detailField: "shift",
  label: "Cleaner",
  usage: [{ Model: Reservation, field: "cleaner_id", noun: "reservation" }],
});

export const getCleaners = cleaners.list;
export const getCleanerById = cleaners.get;
export const createCleaner = cleaners.create;
export const updateCleaner = cleaners.update;
export const deleteCleaner = cleaners.remove;
