<<<<<<< C:/educlub/backend/routes/reports.routes.js
const express = require("express");
const controller = require("../controllers/systemAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/audit-logs", controller.auditLogs);

module.exports = router;
=======
const express = require("express");
const controller = require("../controllers/reports.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate);

router.post("/export", requireRoles("school_admin", "system_admin"), controller.exportReports);
router.get("/search-learners", requireRoles("school_admin", "system_admin"), controller.searchLearners);
router.post("/generate-learner", requireRoles("school_admin", "system_admin"), controller.generateLearnerReport);

module.exports = router;
>>>>>>> C:/Users/Admin/.windsurf/worktrees/educlub/educlub-9a7f450b/backend/routes/reports.routes.js
