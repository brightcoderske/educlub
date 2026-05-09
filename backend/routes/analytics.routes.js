const express = require("express");
const controller = require("../controllers/systemAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/system-admin/summary", controller.dashboardSummary);
router.get("/system-admin/school-performance", controller.schoolPerformanceGrid);
router.get("/audit-logs", controller.auditLogs);

module.exports = router;
