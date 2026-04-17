require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET. Add it to Server/.env before starting the server.");
}

// Verify token middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Enforce active bans for participant requests (temporary and permanent)
    if (decoded.role === "participant") {
      const user = await User.findById(decoded.id).select("isBanned bannedUntil banReason");
      const now = new Date();

      if (user?.isBanned && !user?.bannedUntil) {
        return res.status(403).json({
          error: "You are permanently banned by admin",
          permanent: true,
          banReason: user.banReason || ""
        });
      }

      if (user?.isBanned && user?.bannedUntil && new Date(user.bannedUntil) > now) {
        return res.status(403).json({
          error: "You are temporarily banned by admin",
          bannedUntil: user.bannedUntil,
          banReason: user.banReason || ""
        });
      }

      // Auto-clear expired temporary ban state
      if (user?.isBanned && user?.bannedUntil && new Date(user.bannedUntil) <= now) {
        user.isBanned = false;
        user.bannedUntil = null;
        user.banReason = "";
        await user.save();
      }
    }

    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

module.exports = { verifyToken, requireAdmin };
