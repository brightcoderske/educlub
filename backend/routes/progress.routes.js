const express = require("express");
const controller = require("../controllers/progress.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/courses/:courseId/progress/:userId", controller.getProgress);
router.post("/activity-blocks/:activityBlockId/submit", controller.submitActivity);
router.get("/courses/:courseId/leaderboard", controller.getLeaderboard);
router.get("/users/:userId/xp", controller.getXp);

module.exports = router;
