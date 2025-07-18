import express from "express";
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
} from "../services/userService.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const tenantConfig = req.tenantConfig;
    const user = await createUser(tenantConfig, req.body);
    res.status(201).json({
      message: "User registered successfully. Please login using the configured authentication method to get your access token.",
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const tenantConfig = req.tenantConfig;
    const users = await listUsers(tenantConfig);
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const tenantConfig = req.tenantConfig;
    const user = await getUserById(tenantConfig, req.params.id);
    res.status(200).json(user);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const tenantConfig = req.tenantConfig;
    const updated = await updateUser(tenantConfig, req.params.id, req.body);
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
