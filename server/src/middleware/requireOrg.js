// server/src/middleware/requireOrg.js
export function requireOrg(req, res, next) {
  if (!req.activeOrgId) {
    return res.status(400).json({ message: "Select an organization first" });
  }
  next();
}
