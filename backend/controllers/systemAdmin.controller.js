const service = require("../services/systemAdmin.service");

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
const createSchool = wrap(async (req, res) => res.status(201).json(await service.createSchool(req.body)));
const updateSchool = wrap(async (req, res) => res.json(await service.updateSchool(req.params.id, req.body)));
const suspendSchool = wrap(async (req, res) => res.json(await service.suspendSchool(req.params.id, req.body.suspended !== false)));
const deleteSchool = wrap(async (req, res) => res.json(await service.softDeleteSchool(req.params.id)));

const listTerms = wrap(async (req, res) => res.json(await service.listTerms(req.query)));
const createAcademicYear = wrap(async (req, res) => res.status(201).json(await service.createAcademicYear(req.body)));
const createTerm = wrap(async (req, res) => res.status(201).json(await service.createTerm(req.body)));
const setGlobalActiveTerm = wrap(async (req, res) => res.json(await service.setGlobalActiveTerm(req.params.id)));

const listUsers = wrap(async (req, res) => res.json(await service.listUsers(req.query)));
const updateUser = wrap(async (req, res) => res.json(await service.updateUser(req.params.id, req.body)));
const deactivateUser = wrap(async (req, res) => res.json(await service.deactivateUser(req.params.id)));
const deleteUser = wrap(async (req, res) => res.json(await service.softDeleteUser(req.params.id)));

const listCourses = wrap(async (req, res) => res.json(await service.listCourses(req.query)));
const createCourse = wrap(async (req, res) => res.status(201).json(await service.createCourse(req.body)));
const updateCourse = wrap(async (req, res) => res.json(await service.updateCourse(req.params.id, req.body)));
const publishCourse = wrap(async (req, res) => res.json(await service.publishCourse(req.params.id, req.body.is_published)));

const listGlobalQuestions = wrap(async (req, res) => res.json(await service.listGlobalQuestions(req.query)));
const createGlobalQuestion = wrap(async (req, res) => res.status(201).json(await service.createGlobalQuestion(req.body)));
const assignQuestionToSchools = wrap(async (req, res) => res.json(await service.assignQuestionToSchools(req.params.id, req.body.school_ids || [])));

const dashboardSummary = wrap(async (req, res) => res.json(await service.dashboardSummary(req.query)));
const schoolPerformanceGrid = wrap(async (req, res) => res.json(await service.schoolPerformanceGrid(req.query)));
const auditLogs = wrap(async (req, res) => res.json(await service.auditLogs(req.query)));

module.exports = {
  listSchools,
  createSchool,
  updateSchool,
  suspendSchool,
  deleteSchool,
  listTerms,
  createAcademicYear,
  createTerm,
  setGlobalActiveTerm,
  listUsers,
  updateUser,
  deactivateUser,
  deleteUser,
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  listGlobalQuestions,
  createGlobalQuestion,
  assignQuestionToSchools,
  dashboardSummary,
  schoolPerformanceGrid,
  auditLogs
};
