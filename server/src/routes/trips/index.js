// server/src/routes/trips/index.js
const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/trips  -> list trips (what Dashboard needs)
router.get("/", async (req, res, next) => {
  try {
    const trips = await prisma.trip.findMany({
      orderBy: [{ createdAt: "desc" }],
    });
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
