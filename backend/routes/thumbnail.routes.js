const express = require("express");
const controller = require("../controllers/thumbnail.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.patch("/courses/thumbnail", controller.update);

module.exports = router;
