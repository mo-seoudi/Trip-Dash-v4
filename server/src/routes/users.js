import express from "express";
const router = express.Router();

import {
  getAllUsers,
  getUserById,
  updateUserRoleStatus
} from "../controllers/userController.js";

router.get("/", getAllUsers);
router.get("/:id", getUserById); // ⬅️ Add this
router.put("/:id", updateUserRoleStatus);

export default router;
