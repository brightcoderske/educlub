const service = require("../services/systemAdmin.service");
const ExcelJS = require("exceljs");

function wrap(handler) {
  return async (req, res, next) => {
    try {
      service.assertSystemAdmin(req.user);
      await handler(req, res);
    } catch (error) {
      res.status(error.statusCode || 500);
      next(error);
    }
  };
}

const listSchools = wrap(async (req, res) => res.json(await service.listSchools(req.query)));
const createSchool = wrap(async (req, res) => res.status(201).json(await service.createSchool(req.body, req.user)));
const getSchoolDetail = wrap(async (req, res) => res.json(await service.getSchoolDetail(req.params.id)));
const updateSchool = wrap(async (req, res) => res.json(await service.updateSchool(req.params.id, req.body, req.user)));
const uploadSchoolLogo = wrap(async (req, res) => res.json(await service.uploadSchoolLogo(req.params.id, req.file, req.user)));
const suspendSchool = wrap(async (req, res) => res.json(await service.suspendSchool(req.params.id, req.body.suspended !== false, req.user)));
const deleteSchool = wrap(async (req, res) => res.json(await service.suspendSchool(req.params.id, true, req.user)));

const listAcademicYears = wrap(async (req, res) => res.json(await service.listAcademicYears(req.query)));
const listTerms = wrap(async (req, res) => res.json(await service.listTerms(req.query)));
const createAcademicYear = wrap(async (req, res) => res.status(201).json(await service.createAcademicYear(req.body, req.user)));
const createTerm = wrap(async (req, res) => res.status(201).json(await service.createTerm(req.body, req.user)));
const updateTerm = wrap(async (req, res) => res.json(await service.updateTerm(req.params.id, req.body, req.user)));
const setGlobalActiveTerm = wrap(async (req, res) => res.json(await service.setGlobalActiveTerm(req.params.id, req.user)));

const listUsers = wrap(async (req, res) => res.json(await service.listUsers(req.query)));
const createSchoolAdmin = wrap(async (req, res) => res.status(201).json(await service.createSchoolAdmin(req.body, req.user)));
const resetSchoolAdminPassword = wrap(async (req, res) => res.json(await service.resetSchoolAdminPassword(req.params.schoolId, req.params.adminId, req.body.password, req.user)));
const resetUserPassword = wrap(async (req, res) => res.json(await service.resetUserPassword(req.params.id, req.body.password, req.user)));
const updateUser = wrap(async (req, res) => res.json(await service.updateUser(req.params.id, req.body, req.user)));
const deactivateUser = wrap(async (req, res) => res.json(await service.deactivateUser(req.params.id, req.user)));
const reactivateUser = wrap(async (req, res) => res.json(await service.reactivateUser(req.params.id, req.user)));
const deleteUser = wrap(async (req, res) => res.json(await service.softDeleteUser(req.params.id, req.user)));

const listCourses = wrap(async (req, res) => res.json(await service.listCourses(req.query)));
const createCourse = wrap(async (req, res) => res.status(201).json(await service.createCourse(req.body, req.user)));
const updateCourse = wrap(async (req, res) => res.json(await service.updateCourse(req.params.id, req.body, req.user)));
const publishCourse = wrap(async (req, res) => res.json(await service.publishCourse(req.params.id, req.body.is_published, req.user)));

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

const listGlobalQuizzes = wrap(async (req, res) => res.json(await service.listGlobalQuizzes(req.query)));
const getGlobalQuiz = wrap(async (req, res) => res.json(await service.getGlobalQuiz(req.params.id)));
const createGlobalQuiz = wrap(async (req, res) => res.status(201).json(await service.createGlobalQuiz(req.body, req.user)));
const updateGlobalQuiz = wrap(async (req, res) => res.json(await service.updateGlobalQuiz(req.params.id, req.body, req.user)));
const deleteGlobalQuiz = wrap(async (req, res) => res.json(await service.deleteGlobalQuiz(req.params.id, req.user)));
const addQuestionToGlobalQuiz = wrap(async (req, res) => res.status(201).json(await service.addQuestionToGlobalQuiz(req.params.id, req.body, req.user)));
const bulkAddQuestionsToGlobalQuiz = wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: "Question CSV/XLSX file is required" } });
  }
  const rows = await parseQuestionUpload(req.file);
  return res.status(201).json(await service.bulkAddQuestionsToGlobalQuiz(req.params.id, rows, req.user));
});

const listGlobalQuestions = wrap(async (req, res) => res.json(await service.listGlobalQuestions(req.query)));
const createGlobalQuestion = wrap(async (req, res) => res.status(201).json(await service.createGlobalQuestion(req.body)));
const assignQuestionToSchools = wrap(async (req, res) => res.json(await service.assignQuestionToSchools(req.params.id, req.body.school_ids || [])));
const listGlobalTypingTests = wrap(async (req, res) => res.json(await service.listGlobalTypingTests(req.query)));
const createGlobalTypingTest = wrap(async (req, res) => res.status(201).json(await service.createGlobalTypingTest(req.body, req.user)));
const updateGlobalTypingTest = wrap(async (req, res) => res.json(await service.updateGlobalTypingTest(req.params.id, req.body, req.user)));
const deleteGlobalTypingTest = wrap(async (req, res) => res.json(await service.deleteGlobalTypingTest(req.params.id, req.user)));

const dashboardSummary = wrap(async (req, res) => res.json(await service.dashboardSummary(req.query)));
const schoolPerformanceGrid = wrap(async (req, res) => res.json(await service.schoolPerformanceGrid(req.query)));
const auditLogs = wrap(async (req, res) => res.json(await service.auditLogs(req.query)));

module.exports = {
  listSchools,
  createSchool,
  getSchoolDetail,
  updateSchool,
  uploadSchoolLogo,
  suspendSchool,
  deleteSchool,
  listAcademicYears,
  listTerms,
  createAcademicYear,
  createTerm,
  updateTerm,
  setGlobalActiveTerm,
  listUsers,
  createSchoolAdmin,
  resetSchoolAdminPassword,
  resetUserPassword,
  updateUser,
  deactivateUser,
  reactivateUser,
  deleteUser,
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  listGlobalQuizzes,
  getGlobalQuiz,
  createGlobalQuiz,
  updateGlobalQuiz,
  deleteGlobalQuiz,
  addQuestionToGlobalQuiz,
  bulkAddQuestionsToGlobalQuiz,
  listGlobalQuestions,
  createGlobalQuestion,
  assignQuestionToSchools,
  listGlobalTypingTests,
  createGlobalTypingTest,
  updateGlobalTypingTest,
  deleteGlobalTypingTest,
  dashboardSummary,
  schoolPerformanceGrid,
  auditLogs
};
