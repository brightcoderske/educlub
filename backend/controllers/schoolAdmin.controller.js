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
const termWeeks = wrap(async (req, res) => res.json(await service.termWeeks(req.user, req.params.id || req.query.term_id || null)));
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
const setLearnerActive = wrap(async (req, res) => res.json(await service.setLearnerActive(req.user, req.params.id, req.body.is_active !== false)));
const promoteLearner = wrap(async (req, res) => res.json(await service.promoteLearner(req.user, req.params.id, req.body)));
const listSubmissions = wrap(async (req, res) => res.json(await service.listSubmissions(req.user, req.query)));
const reviewSubmission = wrap(async (req, res) => res.json(await service.reviewSubmission(req.user, req.params.id, req.body)));
const typingResults = wrap(async (req, res) => res.json(await service.typingResults(req.user, req.query)));
const globalTypingTests = wrap(async (req, res) => res.json(await service.globalTypingTests(req.user)));
const schoolTypingTests = wrap(async (req, res) => res.json(await service.schoolTypingTests(req.user)));
const createSchoolTypingTest = wrap(async (req, res) => res.status(201).json(await service.createSchoolTypingTest(req.user, req.body)));
const updateSchoolTypingTest = wrap(async (req, res) => res.json(await service.updateSchoolTypingTest(req.user, req.params.id, req.body)));
const assignTypingTest = wrap(async (req, res) => res.json(await service.assignTypingTest(req.user, req.params.id, req.body)));
const typingAssignments = wrap(async (req, res) => res.json(await service.typingAssignments(req.user, req.query)));
const typingPerformance = wrap(async (req, res) => res.json(await service.typingPerformance(req.user, req.query)));
const quizResults = wrap(async (req, res) => res.json(await service.quizResults(req.user, req.query)));
const globalQuizzes = wrap(async (req, res) => res.json(await service.globalQuizzes(req.user)));
const schoolQuizzes = wrap(async (req, res) => res.json(await service.schoolQuizzes(req.user)));
const createSchoolQuiz = wrap(async (req, res) => res.status(201).json(await service.createSchoolQuiz(req.user, req.body)));
const addQuestionToSchoolQuiz = wrap(async (req, res) => res.status(201).json(await service.addQuestionToSchoolQuiz(req.user, req.params.id, req.body)));
function parseCsv(text) {
  const rows = [];
  let current = "";
  let record = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      record.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      record.push(current);
      if (record.some((value) => value.trim())) rows.push(record);
      record = [];
      current = "";
    } else {
      current += char;
    }
  }
  record.push(current);
  if (record.some((value) => value.trim())) rows.push(record);
  return rows;
}

async function parseQuestionUpload(file) {
  const extension = file.originalname.toLowerCase().split(".").pop();
  let records = [];
  if (extension === "csv") {
    const rows = parseCsv(file.buffer.toString("utf8"));
    const headers = (rows.shift() || []).map((header) => String(header || "").trim().toLowerCase().replace(/\s+/g, "_"));
    records = rows.map((row, index) => {
      const record = { __rowNumber: index + 2 };
      headers.forEach((header, columnIndex) => {
        record[header] = row[columnIndex] || "";
      });
      return record;
    });
  } else if (extension === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const worksheet = workbook.worksheets[0];
    const headers = [];
    worksheet.getRow(1).eachCell((cell, columnNumber) => {
      headers[columnNumber] = String(cell.value || "").trim().toLowerCase().replace(/\s+/g, "_");
    });
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record = { __rowNumber: rowNumber };
      headers.forEach((header, columnNumber) => {
        if (!header) return;
        record[header] = row.getCell(columnNumber).value || "";
      });
      records.push(record);
    });
  } else {
    const error = new Error("Upload .csv or .xlsx only");
    error.statusCode = 400;
    throw error;
  }
  return records.map((record) => ({
    __rowNumber: record.__rowNumber,
    question: record.question,
    option_a: record.option_a || record.a,
    option_b: record.option_b || record.b,
    option_c: record.option_c || record.c,
    option_d: record.option_d || record.d,
    correct_option: record.correct_option || record.answer
  }));
}
const bulkAddQuestionsToSchoolQuiz = wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: "Question CSV/XLSX file is required" } });
  }
  const rows = await parseQuestionUpload(req.file);
  return res.status(201).json(await service.bulkAddQuestionsToSchoolQuiz(req.user, req.params.id, rows));
});
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
const courseCertificateLearners = wrap(async (req, res) => res.json(await service.courseCertificateLearners(req.user, req.params.courseId, req.query)));
const bulkAllocateCourse = wrap(async (req, res) => res.json(await service.bulkAllocateCourse(req.user, req.body)));
const deallocateCourse = wrap(async (req, res) => res.json(await service.deallocateCourse(req.user, req.params.courseId, req.body)));

module.exports = {
  profile,
  activeTerm,
  terms,
  termWeeks,
  dashboardSummary,
  enrolmentByCourse,
  classProgress,
  listLearners,
  learnerDetail,
  addLearner,
  bulkImportLearners,
  updateLearner,
  setLearnerActive,
  promoteLearner,
  listSubmissions,
  reviewSubmission,
  typingResults,
  globalTypingTests,
  schoolTypingTests,
  createSchoolTypingTest,
  updateSchoolTypingTest,
  assignTypingTest,
  typingAssignments,
  typingPerformance,
  quizResults,
  globalQuizzes,
  schoolQuizzes,
  createSchoolQuiz,
  addQuestionToSchoolQuiz,
  bulkAddQuestionsToSchoolQuiz,
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
  courseCertificateLearners,
  bulkAllocateCourse,
  deallocateCourse
};
