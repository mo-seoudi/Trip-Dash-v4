import admin from "firebase-admin";

// 🔐 Main authentication middleware
export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);

    // Add all useful user info to req.user
    req.user = {
      id: decoded.uid,
      email: decoded.email,
      role: decoded.role, // You must ensure role is added to token when issuing
      organizationId: decoded.organizationId,
      schoolId: decoded.schoolId,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
}

// 🎯 Role-based access control middleware
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}
