const express = require("express");
const controller = require("../controllers/systemAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/", controller.listCourses);
router.post("/", controller.createCourse);
router.patch("/:id", controller.updateCourse);
router.patch("/:id/publish", controller.publishCourse);

module.exports = router;
