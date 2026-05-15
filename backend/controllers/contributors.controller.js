const contributorsService = require("../services/contributors.service");

async function getByCourse(req, res) {
  try {
    const { courseId } = req.params;
    const contributors = await contributorsService.getContributorsByCourse(courseId, req.user);
    res.json({ success: true, data: contributors });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function add(req, res) {
  try {
    const { courseId, userId, role, canEdit } = req.body;
    const contributor = await contributorsService.addContributor(courseId, userId, role, canEdit, req.user);
    res.status(201).json({ success: true, data: contributor });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function remove(req, res) {
  try {
    const { courseId, userId } = req.body;
    const contributor = await contributorsService.removeContributor(courseId, userId, req.user);
    res.json({ success: true, data: contributor });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function update(req, res) {
  try {
    const { courseId, userId, role, canEdit } = req.body;
    const contributor = await contributorsService.updateContributor(courseId, userId, role, canEdit, req.user);
    res.json({ success: true, data: contributor });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = {
  getByCourse,
  add,
  remove,
  update
};
