const express = require("express");
const controller = require("../controllers/systemAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/", controller.listSchools);
router.post("/", controller.createSchool);
router.get("/:id", controller.getSchoolDetail);
router.patch("/:id", controller.updateSchool);
router.patch("/:id/suspension", controller.suspendSchool);
router.patch("/:schoolId/admins/:adminId/password", controller.resetSchoolAdminPassword);
router.delete("/:id", controller.deleteSchool);

module.exports = router;
