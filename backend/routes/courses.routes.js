const express = require("express");
const controller = require("../controllers/systemAdmin.controller");
const courseBuilder = require("../controllers/courseBuilder.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");
const { memoryUpload } = require("../middleware/upload.middleware");

const router = express.Router();

// Public/course content routes (accessible by students and school admins)
router.get("/:id/view", authenticate, courseBuilder.viewCourse);
router.get("/:id/progress/:userId", authenticate, courseBuilder.getCourseProgress);
router.post("/:id/lessons/:lessonId/complete", authenticate, courseBuilder.markLessonComplete);
router.post("/activity-blocks/:blockId/submit", authenticate, courseBuilder.submitActivityBlock);

// System admin only routes (for editing)
router.use(authenticate, requireRoles("system_admin"));

router.get("/", controller.listCourses);
router.post("/", controller.createCourse);

router.get("/meta/activity-types", courseBuilder.activityTypes);

router.get("/:id/builder", courseBuilder.getBlueprint);
router.patch("/:id/builder", courseBuilder.patchCourse);

router.post("/:courseId/modules", courseBuilder.createModule);
router.patch("/:courseId/modules/reorder", courseBuilder.reorderModules);

router.patch("/modules/:moduleId", courseBuilder.updateModule);
router.delete("/modules/:moduleId", courseBuilder.deleteModule);

router.post("/modules/:moduleId/lessons", courseBuilder.createLesson);
router.patch("/modules/:moduleId/lessons/reorder", courseBuilder.reorderLessons);

router.patch("/lessons/:lessonId", courseBuilder.updateLesson);
router.delete("/lessons/:lessonId", courseBuilder.deleteLesson);

router.post("/lessons/:lessonId/activity-blocks", courseBuilder.createActivityBlock);
router.patch("/lessons/:lessonId/activity-blocks/reorder", courseBuilder.reorderActivityBlocks);

router.patch("/activity-blocks/:blockId", courseBuilder.updateActivityBlock);
router.delete("/activity-blocks/:blockId", courseBuilder.deleteActivityBlock);

router.patch("/:id/publish", controller.publishCourse);
router.patch("/:id", controller.updateCourse);

module.exports = router;
