const service = require("../services/student.service");

function wrap(handler) {
  return async (req, res, next) => {
    try {
      service.assertStudent(req.user);
      await handler(req, res);
    } catch (error) {
      res.status(error.statusCode || 500);
      next(error);
    }
  };
}

const dashboard = wrap(async (req, res) => {
  res.json(await service.dashboard(req.user, req.query));
});

module.exports = {
  dashboard
};
