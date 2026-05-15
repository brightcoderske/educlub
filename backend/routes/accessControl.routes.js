const express = require("express");
const controller = require("../controllers/accessControl.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.patch("/courses/:courseId/access", controller.toggleAccess);
router.post("/courses/link-user-group", controller.linkToUserGroup);
router.post("/courses/unlink-user-group", controller.unlinkFromUserGroup);
router.get("/courses/:courseId/user-groups", controller.getUserGroups);

module.exports = router;
