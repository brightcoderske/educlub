const service = require("../services/reports.service");

function wrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(error.statusCode || 500);
      next(error);
    }
  };
}

const exportReports = wrap(async (req, res) => {
  const { schoolId, grade, stream } = req.body || {};
  const reports = await service.exportBulkReports({ schoolId, grade, stream });
  res.json({ reports, count: reports.length });
});

const searchLearners = wrap(async (req, res) => {
  const { schoolId, search } = req.query;
  if (!schoolId || !search) {
    return res.status(400).json({ error: "schoolId and search query are required" });
  }
  const learners = await service.searchLearners(schoolId, search);
  res.json(learners);
});

const generateLearnerReport = wrap(async (req, res) => {
  const { schoolId, learnerId, termId } = req.body || {};
  if (!schoolId || !learnerId) {
    return res.status(400).json({ error: "schoolId and learnerId are required" });
  }
  const report = await service.fetchLearnerReport(schoolId, learnerId, termId || null);
  if (!report) {
    return res.status(404).json({ error: "Learner not found" });
  }
  res.json(report);
});

module.exports = { exportReports, searchLearners, generateLearnerReport };