const express = require("express");
const controller = require("../controllers/systemAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/", controller.listUsers);
router.post("/school-admins", controller.createSchoolAdmin);
router.patch("/:id", controller.updateUser);
router.patch("/:id/deactivate", controller.deactivateUser);
router.delete("/:id", controller.deleteUser);

module.exports = router;
