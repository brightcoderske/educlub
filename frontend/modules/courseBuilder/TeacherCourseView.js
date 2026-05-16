"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, assetUrl } from "../../lib/api";
import { currentUser } from "../../lib/auth";
import { ArrowLeft, PlayCircle, ChevronDown, ChevronRight, ChevronUp, Settings } from "lucide-react";
import EditCourseCertification from "./components/EditCourseCertification";

function flattenLessons(modules) {
  return (modules || []).flatMap((module) => (module.lessons || []).map((lesson) => ({
    ...lesson,
    moduleId: module.id,
    moduleName: module.name || module.title
  })));
}

function TeacherCourseView({ courseId }) {
  const router = useRouter();
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [expandedLessons, setExpandedLessons] = useState(new Set());
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [currentLesson, setCurrentLesson] = useState(null);
  const [showCertConfig, setShowCertConfig] = useState(false);
  const user = currentUser();
  const canConfigureCertificate = user?.role === "system_admin";

  async function loadCourse() {
    setLoading(true);
    try {
      const data = await api.get(`/courses/${courseId}/view`);
      setBlueprint(data);
      if (data.modules && data.modules.length > 0) {
        const firstLesson = data.modules[0].lessons?.[0] || null;
        setExpandedModules(new Set([data.modules[0].id]));
        setExpandedLessons(firstLesson ? new Set([firstLesson.id]) : new Set());
        setCurrentLesson(firstLesson ? { ...firstLesson, moduleId: data.modules[0].id, moduleName: data.modules[0].name || data.modules[0].title } : null);
      }
    } catch (err) {
      setError(err.message || "Failed to load course");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const toggleLesson = (lessonId) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  const toggleTask = (taskId) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectLesson = (lesson) => {
    setCurrentLesson(lesson);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course preview...</p>
        </div>
      </div>
    );
  }

  const course = blueprint?.course;
  const modules = blueprint?.modules || [];
  const lessons = flattenLessons(modules);
  const currentIndex = currentLesson ? lessons.findIndex((lesson) => lesson.id === currentLesson.id) : -1;
  const goToLesson = (lesson) => {
    if (!lesson) return;
    selectLesson(lesson);
    setExpandedModules((prev) => new Set([...prev, lesson.moduleId]));
    setExpandedLessons((prev) => new Set([...prev, lesson.id]));
  };

  const totalLessons = modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
  const totalActivities = modules.reduce((sum, m) => 
    sum + (m.lessons?.reduce((ls, l) => ls + (l.activity_blocks?.length || 0), 0) || 0), 0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Course Preview</h1>
                <p className="text-sm text-gray-500">Teacher view</p>
              </div>
            </div>
            {canConfigureCertificate ? (
              <button
                onClick={() => setShowCertConfig(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Settings size={18} />
                <span className="text-sm font-medium">Configure Certificate</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={loadCourse}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-6">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Course Content</h3>
              <div className="space-y-2">
                {modules.map((module) => (
                  <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedModules.has(module.id) ? (
                          <ChevronDown size={16} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400" />
                        )}
                        <span className="font-medium text-gray-700 text-sm">{module.name}</span>
                      </div>
                    </button>

                    {expandedModules.has(module.id) && (
                      <div className="border-t border-gray-200">
                        {(module.lessons || []).map((lesson) => (
                          <div key={lesson.id} className="border-b border-gray-100 last:border-b-0">
                            <button
                              onClick={() => {
                                selectLesson({ ...lesson, moduleId: module.id, moduleName: module.name });
                                toggleLesson(lesson.id);
                              }}
                              className={`w-full flex items-center justify-between p-3 transition-colors ${
                                currentLesson?.id === lesson.id ? "bg-blue-50" : "hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <PlayCircle size={14} />
                                <span className="text-sm font-medium text-gray-700">{lesson.name}</span>
                              </div>
                              {expandedLessons.has(lesson.id) ? (
                                <ChevronUp size={14} className="text-gray-400" />
                              ) : (
                                <ChevronDown size={14} className="text-gray-400" />
                              )}
                            </button>
                            
                            {expandedLessons.has(lesson.id) && (
                              <div className="px-3 pb-3 pl-7">
                                <p className="text-xs text-gray-500 mb-2">{lesson.description || "No description"}</p>
                                {(lesson.activity_blocks || []).map((block) => (
                                  <div key={block.id} className="mb-2">
                                    <button
                                      onClick={() => toggleTask(block.id)}
                                      className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800"
                                    >
                                      {expandedTasks.has(block.id) ? (
                                        <ChevronUp size={12} className="text-gray-400" />
                                      ) : (
                                        <ChevronDown size={12} className="text-gray-400" />
                                      )}
                                      <span className="capitalize">{block.activity_type.replace('_', ' ')}</span>
                                    </button>
                                    {expandedTasks.has(block.id) && (
                                      <div className="pl-4 mt-1 text-xs text-gray-500">
                                        {block.payload && typeof block.payload === 'object' && (
                                          <div>
                                            {block.payload.richText && (
                                              <div dangerouslySetInnerHTML={{ __html: block.payload.richText }} />
                                            )}
                                            {block.payload.instructions && (
                                              <p className="whitespace-pre-wrap">{block.payload.instructions}</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {currentLesson ? (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{currentLesson.moduleName}</span>
                  <h2 className="text-2xl font-bold text-gray-900 mt-1">{currentLesson.name}</h2>
                  {currentLesson.description && (
                    <p className="text-gray-600 mt-2 whitespace-pre-wrap">{currentLesson.description}</p>
                  )}
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={currentIndex <= 0}
                      onClick={() => goToLesson(lessons[currentIndex - 1])}
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
                    >
                      <ChevronUp size={15} /> Previous lesson
                    </button>
                    <span className="text-sm font-semibold text-gray-500">
                      {currentIndex + 1} of {lessons.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentIndex < 0 || currentIndex >= lessons.length - 1}
                      onClick={() => goToLesson(lessons[currentIndex + 1])}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Next lesson <ChevronDown size={15} />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {(currentLesson.activity_blocks || []).map((block) => (
                      <div key={block.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <PlayCircle size={16} className="text-blue-600" />
                          <span className="font-medium text-gray-800 capitalize">
                            {block.activity_type.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-gray-600">
                          <TeacherBlockPreview block={block} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <PlayCircle size={64} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Select a Lesson</h3>
                <p className="text-gray-600">Choose a lesson from the course content to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCertConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-sm max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Configure Certificate</h2>
              <button
                onClick={() => setShowCertConfig(false)}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
            <div className="p-6">
              <EditCourseCertification courseId={courseId} courseName={course?.name} onClose={() => setShowCertConfig(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherBlockPreview({ block }) {
  const payload = block.payload || {};
  const type = block.activity_type;
  if (type === "rich_text" || type === "learn_content") {
    return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: payload.richText || payload.content || "No text yet." }} />;
  }
  if (type === "image_upload") {
    const src = payload.imageUrl || payload.image_url;
    return src ? <img className="max-h-72 w-full rounded-lg border border-gray-200 object-contain" src={String(src).startsWith("data:") ? src : assetUrl(src)} alt={payload.alt || ""} /> : <p>No image yet.</p>;
  }
  if (type === "code_explanation" || type === "runnable_code" || type === "practice_code" || type === "auto_marked_code") {
    return (
      <div className="space-y-2">
        {payload.instructions || payload.explanation ? <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: payload.instructions || payload.explanation }} /> : null}
        <pre className="overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">{payload.code || payload.starterCode || payload.js || ""}</pre>
      </div>
    );
  }
  if (type === "quiz") {
    return (
      <div className="space-y-2">
        {(payload.questions || []).map((q, idx) => (
          <div key={idx} className="rounded bg-gray-50 p-3">
            <p className="font-medium">{q.question}</p>
            {(q.options || []).map((opt, oid) => <div key={oid} className="text-sm">{oid + 1}. {opt}</div>)}
          </div>
        ))}
      </div>
    );
  }
  if (type === "flashcards") {
    return <div className="grid gap-2">{(payload.cards || []).map((card, index) => <div key={index} className="rounded bg-gray-50 p-3"><strong>{card.front}</strong><p>{card.back}</p></div>)}</div>;
  }
  if (type === "assignment_submission" || type === "submission") {
    return <p className="whitespace-pre-wrap">{payload.instructions || "Assignment submission block."}</p>;
  }
  if (type === "mark_complete") {
    return <p>{payload.title || "Mark lesson complete"} · {payload.xp || 20} XP</p>;
  }
  return <p>{type}</p>;
}

export default TeacherCourseView;
