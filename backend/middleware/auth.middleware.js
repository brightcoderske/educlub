const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: { message: "Authentication required" } });
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch (error) {
    return res.status(401).json({ error: { message: "Invalid or expired session" } });
  }
}

module.exports = { authenticate };
