const express = require("express");
const controller = require("../controllers/student.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate, requireRoles("student"));
router.get("/dashboard", controller.dashboard);
router.get("/quizzes/:id", controller.quizForTaking);
router.post("/quizzes/:id/attempts", controller.submitQuizAttempt);

module.exports = router;
