const express = require("express");
const controller = require("../controllers/certification.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();

// Public certificate generation route (accessible by students and school admins)
router.get("/generate/:courseId/:userId", authenticate, controller.generate);

// Certificate management routes (accessible by system admins and school admins)
router.use(authenticate, requireRoles("system_admin", "school_admin"));

router.get("/course/:courseId", controller.getByCourse);
router.get("/uuid/:uuid", controller.getByUUID);
router.post("/", controller.create);
router.patch("/uuid/:uuid", controller.update);
router.delete("/uuid/:uuid", controller.remove);

module.exports = router;
