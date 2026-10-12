import Server from "../models/server.model.js";
import Reservation from "../models/reservation.model.js";
import ReservationOrder from "../models/reservationOrder.model.js";
import { createStaffController } from "../utils/staffController.js";

const servers = createStaffController({
  Model: Server,
  nameField: "server_name",
  detailField: "section",
  label: "Server",
  usage: [
    { Model: ReservationOrder, field: "server_id", noun: "order" },
    { Model: Reservation, field: "server_id", noun: "reservation" },
  ],
});

export const getServers = servers.list;
export const getServerById = servers.get;
export const createServer = servers.create;
export const updateServer = servers.update;
export const deleteServer = servers.remove;
