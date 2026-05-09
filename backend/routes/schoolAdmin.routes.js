const express = require("express");
const controller = require("../controllers/schoolAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");
const { memoryUpload } = require("../middleware/upload.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("school_admin"));

router.get("/profile", controller.profile);
router.get("/active-term", controller.activeTerm);
router.get("/terms", controller.terms);
router.get("/summary", controller.dashboardSummary);
router.get("/enrolment-by-course", controller.enrolmentByCourse);
router.get("/class-progress", controller.classProgress);
router.get("/learners", controller.listLearners);
router.post("/learners", controller.addLearner);
router.post("/learners/bulk-upload", memoryUpload.single("file"), controller.bulkImportLearners);
router.get("/learners/:id/detail", controller.learnerDetail);
router.patch("/learners/:id", controller.updateLearner);
router.post("/learners/:id/promotions", controller.promoteLearner);
router.get("/courses", controller.availableCourses);
router.post("/course-allocations", controller.bulkAllocateCourse);
router.get("/submissions", controller.listSubmissions);
router.patch("/submissions/:id/review", controller.reviewSubmission);
router.get("/typing-results", controller.typingResults);
router.get("/quiz-results", controller.quizResults);
router.get("/leaderboards", controller.leaderboards);
router.get("/preferences", controller.preferences);
router.patch("/preferences", controller.updatePreferences);
router.get("/streams", controller.streams);
router.post("/streams", controller.addStream);
router.delete("/streams/:id", controller.deleteStream);

module.exports = router;
