const progressService = require("../services/progress.service");
const { addProgressSchema } = require("../scripts/addProgressSchema");

async function getProgress(req, res) {
  try {
    const { courseId, userId } = req.params;
    await addProgressSchema();
    const progress = await progressService.getStudentProgress(courseId, userId, req.user);
    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function submitActivity(req, res) {
  try {
    const { activityBlockId, userId } = req.params;
    const { answer, submission } = req.body;
    await addProgressSchema();
    const result = await progressService.submitActivity(activityBlockId, userId, answer, submission, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function getLeaderboard(req, res) {
  try {
    const { courseId } = req.params;
    const leaderboard = await progressService.getCourseLeaderboard(courseId, req.user);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function getXp(req, res) {
  try {
    const { userId } = req.params;
    const xp = await progressService.getStudentXp(userId, req.user);
    res.json({ success: true, data: xp });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = {
  getProgress,
  submitActivity,
  getLeaderboard,
  getXp
};
