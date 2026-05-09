const service = require("../services/schoolAdmin.service");
const ExcelJS = require("exceljs");

function wrap(handler) {
  return async (req, res, next) => {
    try {
      service.assertSchoolAdmin(req.user);
      await handler(req, res);
    } catch (error) {
      res.status(error.statusCode || 500);
      next(error);
    }
  };
}

const profile = wrap(async (req, res) => res.json(await service.profile(req.user)));
const activeTerm = wrap(async (req, res) => res.json(await service.activeTerm(req.user)));
const terms = wrap(async (req, res) => res.json(await service.terms(req.user)));
const dashboardSummary = wrap(async (req, res) => res.json(await service.dashboardSummary(req.user, req.query)));
const enrolmentByCourse = wrap(async (req, res) => res.json(await service.enrolmentByCourse(req.user, req.query)));
const classProgress = wrap(async (req, res) => res.json(await service.classProgress(req.user, req.query)));
const listLearners = wrap(async (req, res) => res.json(await service.listLearners(req.user, req.query)));
const addLearner = wrap(async (req, res) => res.status(201).json(await service.addLearner(req.user, req.body)));
const bulkImportLearners = wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: "Excel file is required" } });
  }
  const workbook = new ExcelJS.Workbook();
  const rows = [];

  const extension = req.file.originalname.toLowerCase().split(".").pop();

  if (extension === "csv") {
    const text = req.file.buffer.toString("utf8");
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    if (!headerLine) {
      return res.status(400).json({ error: { message: "The CSV file is empty", details: "Expected headers: child name, grade, stream" } });
    }
    const headers = headerLine.split(",").map((header) => header.trim());
    lines.forEach((line, index) => {
      const values = line.split(",");
      const record = { __rowNumber: index + 2 };
      headers.forEach((header, index) => {
        record[header] = values[index] || "";
      });
      rows.push(record);
    });
  } else if (extension === "xlsx") {
    try {
      await workbook.xlsx.load(req.file.buffer);
    } catch (error) {
      return res.status(400).json({
        error: {
          message: "Could not read the Excel file",
          details: "Please upload a valid .xlsx file with columns: child name, grade, stream"
        }
      });
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: { message: "The Excel file has no worksheet", details: "Expected headers: child name, grade, stream" } });
    }
    const headers = [];
    worksheet.getRow(1).eachCell((cell, columnNumber) => {
      headers[columnNumber] = String(cell.value || "").trim();
    });
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record = { __rowNumber: rowNumber };
      headers.forEach((header, columnNumber) => {
        if (!header) return;
        record[header] = row.getCell(columnNumber).value || "";
      });
      rows.push(record);
    });
  } else {
    return res.status(400).json({
      error: {
        message: "Unsupported learner upload file",
        details: "Upload .xlsx or .csv only. Old .xls files are not supported by this importer."
      }
    });
  }
  const headers = rows.length ? Object.keys(rows[0]).filter((header) => header !== "__rowNumber") : [];
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim());
  if (!normalizedHeaders.includes("child name") || !normalizedHeaders.includes("grade")) {
    return res.status(400).json({
      error: {
        message: "Learner upload columns do not match the required format",
        details: `Found columns: ${headers.join(", ") || "none"}. Required columns: child name, grade, stream.`
      }
    });
  }
  return res.status(201).json(await service.bulkImportLearners(req.user, rows));
});
const learnerDetail = wrap(async (req, res) => res.json(await service.learnerDetail(req.user, req.params.id, req.query)));
const updateLearner = wrap(async (req, res) => res.json(await service.updateLearner(req.user, req.params.id, req.body)));
const promoteLearner = wrap(async (req, res) => res.json(await service.promoteLearner(req.user, req.params.id, req.body)));
const listSubmissions = wrap(async (req, res) => res.json(await service.listSubmissions(req.user, req.query)));
const reviewSubmission = wrap(async (req, res) => res.json(await service.reviewSubmission(req.user, req.params.id, req.body)));
const typingResults = wrap(async (req, res) => res.json(await service.typingResults(req.user, req.query)));
const quizResults = wrap(async (req, res) => res.json(await service.quizResults(req.user, req.query)));
const globalQuizzes = wrap(async (req, res) => res.json(await service.globalQuizzes(req.user)));
const schoolQuizzes = wrap(async (req, res) => res.json(await service.schoolQuizzes(req.user)));
const createSchoolQuiz = wrap(async (req, res) => res.status(201).json(await service.createSchoolQuiz(req.user, req.body)));
const addQuestionToSchoolQuiz = wrap(async (req, res) => res.status(201).json(await service.addQuestionToSchoolQuiz(req.user, req.params.id, req.body)));
const assignQuiz = wrap(async (req, res) => res.json(await service.assignQuiz(req.user, req.params.id, req.body)));
const quizAssignments = wrap(async (req, res) => res.json(await service.quizAssignments(req.user, req.query)));
const quizPerformance = wrap(async (req, res) => res.json(await service.quizPerformance(req.user, req.query)));
const leaderboards = wrap(async (req, res) => res.json(await service.leaderboards(req.user, req.query)));
const preferences = wrap(async (req, res) => res.json(await service.preferences(req.user) || await service.ensurePreferences(req.user)));
const updatePreferences = wrap(async (req, res) => res.json(await service.updatePreferences(req.user, req.body)));
const streams = wrap(async (req, res) => res.json(await service.streams(req.user)));
const addStream = wrap(async (req, res) => res.status(201).json(await service.addStream(req.user, req.body)));
const deleteStream = wrap(async (req, res) => res.json(await service.deleteStream(req.user, req.params.id)));
const availableCourses = wrap(async (req, res) => res.json(await service.availableCourses(req.user)));
const bulkAllocateCourse = wrap(async (req, res) => res.json(await service.bulkAllocateCourse(req.user, req.body)));

module.exports = {
  profile,
  activeTerm,
  terms,
  dashboardSummary,
  enrolmentByCourse,
  classProgress,
  listLearners,
  learnerDetail,
  addLearner,
  bulkImportLearners,
  updateLearner,
  promoteLearner,
  listSubmissions,
  reviewSubmission,
  typingResults,
  quizResults,
  globalQuizzes,
  schoolQuizzes,
  createSchoolQuiz,
  addQuestionToSchoolQuiz,
  assignQuiz,
  quizAssignments,
  quizPerformance,
  leaderboards,
  preferences,
  updatePreferences,
  streams,
  addStream,
  deleteStream,
  availableCourses,
  bulkAllocateCourse
};
