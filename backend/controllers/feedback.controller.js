const feedbackService = require("../services/feedback.service");

async function addFeedback(req, res) {
  try {
    const { activityBlockId, userId } = req.params;
    const { teacherId, feedback, scoreAdjustment } = req.body;
    const result = await feedbackService.addFeedback(activityBlockId, userId, teacherId, feedback, scoreAdjustment, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function getFeedbackForUser(req, res) {
  try {
    const { activityBlockId, userId } = req.params;
    const feedback = await feedbackService.getFeedbackForUser(activityBlockId, userId, req.user);
    res.json({ success: true, data: feedback });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function getFeedbackByTeacher(req, res) {
  try {
    const { teacherId, courseId } = req.params;
    const feedback = await feedbackService.getFeedbackByTeacher(teacherId, courseId, req.user);
    res.json({ success: true, data: feedback });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function updateFeedback(req, res) {
  try {
    const { feedbackId } = req.params;
    const { feedback, scoreAdjustment } = req.body;
    const result = await feedbackService.updateFeedback(feedbackId, feedback, scoreAdjustment, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function deleteFeedback(req, res) {
  try {
    const { feedbackId } = req.params;
    const result = await feedbackService.deleteFeedback(feedbackId, req.user);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = {
  addFeedback,
  getFeedbackForUser,
  getFeedbackByTeacher,
  updateFeedback,
  deleteFeedback
};
