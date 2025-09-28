const prisma = require("../utils/prisma");

async function buyerAuthMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, role: true, status: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.role !== "buyer") {
      return res.status(403).json({ message: "Forbidden: buyer role required" });
    }

    if (!user.status) {
      return res.status(401).json({ message: "Unauthorized: user logged out" });
    }

    next();
  } catch (error) {
    console.error("buyerAuthMiddleware error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = buyerAuthMiddleware;


