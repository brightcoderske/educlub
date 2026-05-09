const express = require("express");
const controller = require("../controllers/systemAdmin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/", controller.listTerms);
router.post("/academic-years", controller.createAcademicYear);
router.post("/", controller.createTerm);
router.patch("/:id/global-active", controller.setGlobalActiveTerm);

module.exports = router;
