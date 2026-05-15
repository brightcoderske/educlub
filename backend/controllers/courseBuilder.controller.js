const courseBuilder = require("../services/courseBuilder.service");

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

const getBlueprint = wrap(async (req, res) => res.json(await courseBuilder.getBlueprint(req.params.id, req.user)));

const viewCourse = wrap(async (req, res) => res.json(await courseBuilder.viewCourse(req.params.id, req.user)));

const getCourseProgress = wrap(async (req, res) => res.json(await courseBuilder.getCourseProgress(req.params.id, req.params.userId, req.user)));

const markLessonComplete = wrap(async (req, res) => res.json(await courseBuilder.markLessonComplete(req.params.id, req.params.lessonId, req.body.userId, req.user)));

const submitActivityBlock = wrap(async (req, res) => res.json(await courseBuilder.submitActivityBlock(req.params.blockId, req.body, req.user)));

const patchCourse = wrap(async (req, res) => res.json(await courseBuilder.patchCourse(req.params.id, req.body, req.user)));

const createModule = wrap(async (req, res) =>
  res.status(201).json(await courseBuilder.createModule(req.params.courseId, req.body, req.user))
);

const updateModule = wrap(async (req, res) => res.json(await courseBuilder.updateModule(req.params.moduleId, req.body, req.user)));

const deleteModule = wrap(async (req, res) => res.json(await courseBuilder.deleteModule(req.params.moduleId, req.user)));

const reorderModules = wrap(async (req, res) =>
  res.json(await courseBuilder.reorderModules(req.params.courseId, req.body.ordered_ids || [], req.user))
);

const createLesson = wrap(async (req, res) =>
  res.status(201).json(await courseBuilder.createLesson(req.params.moduleId, req.body, req.user))
);

const updateLesson = wrap(async (req, res) => res.json(await courseBuilder.updateLesson(req.params.lessonId, req.body, req.user)));

const deleteLesson = wrap(async (req, res) => res.json(await courseBuilder.deleteLesson(req.params.lessonId, req.user)));

const reorderLessons = wrap(async (req, res) =>
  res.json(await courseBuilder.reorderLessons(req.params.moduleId, req.body.ordered_ids || [], req.user))
);

const createActivityBlock = wrap(async (req, res) =>
  res.status(201).json(await courseBuilder.createActivityBlock(req.params.lessonId, req.body, req.user))
);

const updateActivityBlock = wrap(async (req, res) =>
  res.json(await courseBuilder.updateActivityBlock(req.params.blockId, req.body, req.user))
);

const deleteActivityBlock = wrap(async (req, res) =>
  res.json(await courseBuilder.deleteActivityBlock(req.params.blockId, req.user))
);

const reorderActivityBlocks = wrap(async (req, res) =>
  res.json(await courseBuilder.reorderActivityBlocks(req.params.lessonId, req.body.ordered_ids || [], req.user))
);

const activityTypes = wrap(async (req, res) => res.json({ types: courseBuilder.ACTIVITY_TYPES }));

module.exports = {
  getBlueprint,
  viewCourse,
  getCourseProgress,
  markLessonComplete,
  submitActivityBlock,
  patchCourse,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  createActivityBlock,
  updateActivityBlock,
  deleteActivityBlock,
  reorderActivityBlocks,
  activityTypes
};
