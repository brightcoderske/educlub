const certificateService = require("../services/certificateGeneration.service");

async function generateCertificate(req, res) {
  try {
    const { courseId, userId } = req.params;
    const certificateData = await certificateService.generateCertificateForUser(courseId, userId, req.user);
    const template = certificateService.getCertificateTemplate(certificateData.pattern);
    
    res.json({ 
      success: true, 
      data: {
        ...certificateData,
        template
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = {
  generateCertificate
};
