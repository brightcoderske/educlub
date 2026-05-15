const express = require("express");
const controller = require("../controllers/certificateGeneration.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.post("/courses/:courseId/certificates/:userId/generate", controller.generateCertificate);

module.exports = router;
