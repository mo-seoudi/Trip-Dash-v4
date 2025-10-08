// server/src/routes/index.js
const router = require("express").Router();

router.use("/trips", require("./trips")); // => /api/trips

module.exports = router;
