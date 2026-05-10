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
const quizForTaking = wrap(async (req, res) => {
  res.json(await service.quizForTaking(req.user, req.params.id));
});
const submitQuizAttempt = wrap(async (req, res) => {
  res.status(201).json(await service.submitQuizAttempt(req.user, req.params.id, req.body));
});
const typingTestForTaking = wrap(async (req, res) => {
  res.json(await service.typingTestForTaking(req.user, req.params.id));
});
const submitTypingAttempt = wrap(async (req, res) => {
  res.status(201).json(await service.submitTypingAttempt(req.user, req.params.id, req.body));
});

module.exports = {
  dashboard,
  quizForTaking,
  submitQuizAttempt,
  typingTestForTaking,
  submitTypingAttempt
};
