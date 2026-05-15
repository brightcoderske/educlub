const accessControlService = require("../services/accessControl.service");

async function toggleAccess(req, res) {
  try {
    const { courseId } = req.params;
    const { isPublic } = req.body;
    const result = await accessControlService.toggleCourseAccess(courseId, isPublic, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function linkToUserGroup(req, res) {
  try {
    const { courseId, userGroupId } = req.body;
    const result = await accessControlService.linkCourseToUserGroup(courseId, userGroupId, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function unlinkFromUserGroup(req, res) {
  try {
    const { courseId, userGroupId } = req.body;
    const result = await accessControlService.unlinkCourseFromUserGroup(courseId, userGroupId, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function getUserGroups(req, res) {
  try {
    const { courseId } = req.params;
    const { orgId } = req.query;
    const userGroups = await accessControlService.getUserGroupsForCourse(courseId, orgId, req.user);
    res.json({ success: true, data: userGroups });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = {
  toggleAccess,
  linkToUserGroup,
  unlinkFromUserGroup,
  getUserGroups
};
