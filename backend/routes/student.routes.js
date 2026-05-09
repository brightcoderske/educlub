const express = require("express");
const controller = require("../controllers/student.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate, requireRoles("student"));
router.get("/dashboard", controller.dashboard);

module.exports = router;
