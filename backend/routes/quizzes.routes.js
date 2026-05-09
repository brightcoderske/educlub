const express = require("express");
const controller = require("../controllers/systemAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");
const { memoryUpload } = require("../middleware/upload.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/global", controller.listGlobalQuizzes);
router.post("/global", controller.createGlobalQuiz);
router.get("/global/:id", controller.getGlobalQuiz);
router.patch("/global/:id", controller.updateGlobalQuiz);
router.delete("/global/:id", controller.deleteGlobalQuiz);
router.post("/global/:id/questions", controller.addQuestionToGlobalQuiz);
router.post("/global/:id/questions/upload", memoryUpload.single("file"), controller.bulkAddQuestionsToGlobalQuiz);
router.get("/global-questions", controller.listGlobalQuestions);
router.post("/global-questions", controller.createGlobalQuestion);
router.post("/global-questions/:id/visibility", controller.assignQuestionToSchools);

module.exports = router;
