"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { ArrowLeft, PlayCircle, BookOpen, Users, Award, Clock, CheckCircle, ChevronDown, ChevronRight, Edit, ChevronUp, Settings } from "lucide-react";
import EditCourseCertification from "./components/EditCourseCertification";

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

  useEffect(() => {
    async function loadCourse() {
      setLoading(true);
      try {
        const data = await api.get(`/courses/${courseId}/view`);
        setBlueprint(data);
        if (data.modules && data.modules.length > 0) {
          setExpandedModules(new Set([data.modules[0].id]));
        }
      } catch (err) {
        setError(err.message || "Failed to load course");
      } finally {
        setLoading(false);
      }
    }

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
            <button
              onClick={() => setShowCertConfig(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Settings size={18} />
              <span className="text-sm font-medium">Configure Certificate</span>
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
                                              <p>{block.payload.instructions}</p>
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
                    <p className="text-gray-600 mt-2">{currentLesson.description}</p>
                  )}
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
                        {block.payload && typeof block.payload === 'object' && (
                          <div className="text-gray-600">
                            {block.payload.richText && (
                              <div dangerouslySetInnerHTML={{ __html: block.payload.richText }} />
                            )}
                            {block.payload.instructions && (
                              <p>{block.payload.instructions}</p>
                            )}
                            {block.payload.questions && (
                              <div className="space-y-2">
                                {block.payload.questions.map((q, idx) => (
                                  <div key={idx} className="bg-gray-50 p-3 rounded">
                                    <p className="font-medium">{q.question}</p>
                                    <div className="mt-2 space-y-1">
                                      {q.options?.map((opt, oid) => (
                                        <div key={oid} className="text-sm">{oid + 1}. {opt}</div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronUp size={20} />
              </button>
            </div>
            <div className="p-6">
              <EditCourseCertification courseId={courseId} onClose={() => setShowCertConfig(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherCourseView;
