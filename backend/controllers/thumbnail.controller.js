const thumbnailService = require("../services/thumbnail.service");

async function update(req, res) {
  try {
    const { courseId, thumbnailUrl, thumbnailType } = req.body;
    const result = await thumbnailService.updateCourseThumbnail(courseId, thumbnailUrl, thumbnailType, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = {
  update
};
