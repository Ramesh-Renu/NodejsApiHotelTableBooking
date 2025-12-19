import express from "express";
import { createUser, getUsers, login } from "../controllers/user.controller.js";

const router = express.Router();

router.post("/users", createUser);
router.get("/users", getUsers);
router.post("/login", login);

export default router;
