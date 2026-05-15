const certificationService = require("../services/certification.service");
const certificateGenerationService = require("../services/certificateGeneration.service");

function wrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(error.statusCode || 500);
      next(error);
    }
  };
}

const getByCourse = wrap(async (req, res) => {
  const certifications = await certificationService.getCertificationsByCourse(req.params.courseId, req.user);
  res.json({ success: true, data: certifications });
});

const getByUUID = wrap(async (req, res) => {
  const certification = await certificationService.getCertificationByUUID(req.params.uuid, req.user);
  res.json({ success: true, data: certification });
});

const create = wrap(async (req, res) => {
  const { courseId, config, orgId } = req.body;
  const certification = await certificationService.createCertification(courseId, config, orgId, req.user);
  res.status(201).json({ success: true, data: certification });
});

const update = wrap(async (req, res) => {
  const { config } = req.body;
  const certification = await certificationService.updateCertification(req.params.uuid, config, req.user);
  res.json({ success: true, data: certification });
});

const remove = wrap(async (req, res) => {
  const certification = await certificationService.deleteCertification(req.params.uuid, req.user);
  res.json({ success: true, data: certification });
});

const generate = wrap(async (req, res) => {
  const certificateData = await certificateGenerationService.generateCertificateForUser(
    req.params.courseId,
    req.params.userId,
    req.user
  );
  res.json({ success: true, data: certificateData });
});

module.exports = {
  getByCourse,
  getByUUID,
  create,
  update,
  remove,
  generate
};
