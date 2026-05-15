const express = require("express");
const controller = require("../controllers/contributors.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/courses/:courseId/contributors", controller.getByCourse);
router.post("/courses/contributors/add", controller.add);
router.post("/courses/contributors/remove", controller.remove);
router.patch("/courses/contributors/update", controller.update);

module.exports = router;
