const express = require("express");
const reportsController = require("../controllers/reports.controller");
const systemAdminController = require("../controllers/systemAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate);

// Reports routes (school_admin, system_admin)
router.post("/export", requireRoles("school_admin", "system_admin"), reportsController.exportReports);
router.get("/search-learners", requireRoles("school_admin", "system_admin"), reportsController.searchLearners);
router.post("/generate-learner", requireRoles("school_admin", "system_admin"), reportsController.generateLearnerReport);

// Audit logs route (system_admin only)
router.get("/audit-logs", requireRoles("system_admin"), systemAdminController.auditLogs);

module.exports = router;
