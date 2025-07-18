import express from "express";
import { loginUser } from "../services/authService.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password, tenantId } = req.body;

  try {
    const { token, user } = await loginUser(email, password, tenantId);
    res.json({ token, user });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
});

export default router;
