// server/src/routes/ms.js
const { Router } = require("express");
const { requireApiToken } = require("../ms/requireApiToken");
const { oboAcquire, graphGet, graphPost } = require("../ms/graphOnBehalf");

const router = Router();
router.use(requireApiToken);

// GET /api/ms/me -> proves end-to-end OBO
router.get("/me", async (req, res) => {
  try {
    const scopes = (process.env.MS_GRAPH_DEFAULT_SCOPES || "https://graph.microsoft.com/User.Read").split(" ");
    const userToken = await oboAcquire(scopes, req.spaAccessToken);
    const me = await graphGet("/me", userToken);
    res.json(me);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ms/events -> create an Outlook event in the signed-in user's calendar
router.post("/events", async (req, res) => {
  try {
    const graphToken = await oboAcquire(
      ["https://graph.microsoft.com/Calendars.ReadWrite"],
      req.spaAccessToken
    );
    const created = await graphPost("/me/events", graphToken, req.body);
    res.json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
