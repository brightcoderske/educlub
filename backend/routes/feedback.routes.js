const express = require("express");
const controller = require("../controllers/feedback.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.post("/activity-blocks/:activityBlockId/feedback/users/:userId", controller.addFeedback);
router.get("/activity-blocks/:activityBlockId/feedback/users/:userId", controller.getFeedbackForUser);
router.get("/teachers/:teacherId/feedback/courses/:courseId", controller.getFeedbackByTeacher);
router.patch("/feedback/:feedbackId", controller.updateFeedback);
router.delete("/feedback/:feedbackId", controller.deleteFeedback);

module.exports = router;
