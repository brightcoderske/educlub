const authService = require("../services/auth.service");

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500);
    next(error);
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, me };
