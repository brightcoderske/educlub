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
