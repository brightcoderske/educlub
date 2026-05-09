const express = require("express");
const controller = require("../controllers/systemAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/global-questions", controller.listGlobalQuestions);
router.post("/global-questions", controller.createGlobalQuestion);
router.post("/global-questions/:id/visibility", controller.assignQuestionToSchools);

module.exports = router;
