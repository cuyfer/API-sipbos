const { verifyToken } = require("../utils/jwt");

function authMiddlewareGetProductsLikes(req, res, next) {
    const authHeader = req.headers.authorization;
  
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = verifyToken(token);
        req.user = decoded; //user info
      } catch (err) {
        console.log("Invalid User Token, lanjut tanpa user...");
      }
    }
  
    // next 
    next();
  }
  
module.exports = authMiddlewareGetProductsLikes;
