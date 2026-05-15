"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { ArrowLeft, PlayCircle, CheckCircle, ChevronDown, ChevronRight, Trophy, Star, ChevronLeft, ChevronUp, Award } from "lucide-react";
import toast from "react-hot-toast";
import CertificateView from "./CertificateView";

function StudentCourseView({ courseId, userId }) {
  const router = useRouter();
  const [blueprint, setBlueprint] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [expandedLessons, setExpandedLessons] = useState(new Set());
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [currentLesson, setCurrentLesson] = useState(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(-1);
  const [allLessons, setAllLessons] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [submissionText, setSubmissionText] = useState("");
  const [showCertificate, setShowCertificate] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [courseData, progressData] = await Promise.all([
          api.get(`/courses/${courseId}/view`),
          api.get(`/courses/${courseId}/progress/${userId}`)
        ]);
        setBlueprint(courseData);
        setProgress(progressData);
        
        if (courseData.modules && courseData.modules.length > 0) {
          setExpandedModules(new Set([courseData.modules[0].id]));
          
          const lessons = [];
          courseData.modules.forEach(module => {
            (module.lessons || []).forEach(lesson => {
              lessons.push({ ...lesson, moduleId: module.id, moduleName: module.name });
            });
          });
          setAllLessons(lessons);
          
          if (lessons.length > 0) {
            setCurrentLesson(lessons[0]);
            setCurrentLessonIndex(0);
            setExpandedLessons(new Set([lessons[0].id]));
          }
        }
      } catch (err) {
        setError(err.message || "Failed to load course");
      } finally {
        setLoading(false);
      }
    }

    if (courseId && userId) {
      loadData();
    }
  }, [courseId, userId]);

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
    const index = allLessons.findIndex(l => l.id === lesson.id);
    setCurrentLessonIndex(index);
    setExpandedLessons(new Set([lesson.id]));
  };

  const goToPreviousLesson = () => {
    if (currentLessonIndex > 0) {
      selectLesson(allLessons[currentLessonIndex - 1]);
    }
  };

  const goToNextLesson = () => {
    if (currentLessonIndex < allLessons.length - 1) {
      selectLesson(allLessons[currentLessonIndex + 1]);
    }
  };

  const markLessonComplete = async () => {
    try {
      await api.post(`/courses/lessons/${currentLesson.id}/complete`, { userId });
      toast.success("Lesson marked as complete");
      const progressData = await api.get(`/courses/${courseId}/progress/${userId}`);
      setProgress(progressData);
    } catch (err) {
      toast.error("Failed to mark lesson complete");
    }
  };

  const submitQuizAnswer = async (blockId, answer) => {
    try {
      await api.post(`/courses/activity-blocks/${blockId}/submit`, {
        userId,
        answer
      });
      toast.success("Answer submitted");
      const progressData = await api.get(`/courses/${courseId}/progress/${userId}`);
      setProgress(progressData);
    } catch (err) {
      toast.error("Failed to submit answer");
    }
  };

  const submitPractice = async (blockId) => {
    try {
      await api.post(`/courses/activity-blocks/${blockId}/submit`, {
        userId,
        submission: submissionText
      });
      toast.success("Practice submitted");
      setSubmissionText("");
      const progressData = await api.get(`/courses/${courseId}/progress/${userId}`);
      setProgress(progressData);
    } catch (err) {
      toast.error("Failed to submit practice");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  const course = blueprint?.course;
  const modules = blueprint?.modules || [];
  const completedLessons = progress?.completed_lessons || [];
  const completedActivities = progress?.completed_activities || [];
  const totalScore = progress?.total_score || 0;

  const calculateProgress = () => {
    const totalLessons = modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
    if (totalLessons === 0) return 0;
    return Math.round((completedLessons.length / totalLessons) * 100);
  };

  const renderActivityBlock = (block) => {
    const isExpanded = expandedTasks.has(block.id);
    
    switch (block.activity_type) {
      case "learn_content":
        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleTask(block.id)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <PlayCircle size={16} className="text-blue-600" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-800">Learning Content</h4>
                  <p className="text-sm text-gray-500">Read and learn</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </button>
            
            {isExpanded && (
              <div className="p-4 bg-white">
                <div className="text-gray-600 mb-4">
                  {block.payload?.content || "No content available"}
                </div>
                <button
                  onClick={() => {
                    completedActivities.includes(block.id) || submitQuizAnswer(block.id, { completed: true });
                  }}
                  disabled={completedActivities.includes(block.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completedActivities.includes(block.id) ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle size={16} />
                      Completed
                    </span>
                  ) : "Mark as Complete"}
                </button>
              </div>
            )}
          </div>
        );

      case "quiz":
        const quizData = block.payload?.quiz || {};
        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleTask(block.id)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Star size={16} className="text-purple-600" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-800">Quiz</h4>
                  <p className="text-sm text-gray-500">{quizData.question || "Answer the question"}</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </button>
            
            {isExpanded && (
              <div className="p-4 bg-white">
                <p className="text-gray-600 mb-4">{quizData.question || "No question available"}</p>
                {quizData.options && (
                  <div className="space-y-2 mb-4">
                    {quizData.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setQuizAnswers({ ...quizAnswers, [block.id]: option });
                          submitQuizAnswer(block.id, { answer: option });
                        }}
                        className={`w-full text-left p-3 rounded-lg border ${
                          quizAnswers[block.id] === option
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
                {completedActivities.includes(block.id) && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle size={16} />
                    <span>Completed</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case "practice":
        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleTask(block.id)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <PlayCircle size={16} className="text-green-600" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-800">Practice Task</h4>
                  <p className="text-sm text-gray-500">Complete the exercise</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </button>
            
            {isExpanded && (
              <div className="p-4 bg-white">
                <p className="text-gray-600 mb-4">{block.payload?.prompt || "No prompt available"}</p>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Enter your solution here..."
                  className="w-full p-3 border border-gray-300 rounded-lg mb-4"
                  rows={4}
                />
                <button
                  onClick={() => submitPractice(block.id)}
                  disabled={completedActivities.includes(block.id) || !submissionText}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completedActivities.includes(block.id) ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle size={16} />
                      Submitted
                    </span>
                  ) : "Submit Solution"}
                </button>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleTask(block.id)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <PlayCircle size={16} className="text-gray-600" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-800 capitalize">{block.activity_type.replace('_', ' ')}</h4>
                  <p className="text-sm text-gray-500">Activity</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </button>
            
            {isExpanded && (
              <div className="p-4 bg-white">
                <p className="text-gray-600 mb-4">Activity content goes here</p>
                <button
                  onClick={() => {
                    completedActivities.includes(block.id) || submitQuizAnswer(block.id, { completed: true });
                  }}
                  disabled={completedActivities.includes(block.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completedActivities.includes(block.id) ? "Completed" : "Mark as Complete"}
                </button>
              </div>
            )}
          </div>
        );
    }
  };

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
                <h1 className="text-xl font-bold text-gray-900">{course?.name || "Course"}</h1>
                <p className="text-sm text-gray-500">Student Learning View</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="text-yellow-500" size={20} />
                <span className="font-semibold text-gray-900">{totalScore} XP</span>
              </div>
              <div className="w-32">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${calculateProgress()}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500">{calculateProgress()}% complete</span>
              </div>
              {calculateProgress() >= 80 && (
                <button
                  onClick={() => setShowCertificate(true)}
                  className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <Award size={18} />
                  <span className="text-sm font-medium">Get Certificate</span>
                </button>
              )}
            </div>
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
                      <span className="text-xs text-gray-500">
                        {module.lessons?.filter(l => completedLessons.includes(l.id)).length || 0}/{module.lessons?.length || 0}
                      </span>
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
                                currentLesson?.id === lesson.id
                                  ? "bg-blue-50"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {completedLessons.includes(lesson.id) ? (
                                  <CheckCircle size={14} className="text-green-600" />
                                ) : (
                                  <PlayCircle size={14} />
                                )}
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
                                <div className="text-xs text-gray-400">
                                  {(lesson.activity_blocks || []).length} activities
                                </div>
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
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">{currentLesson.moduleName}</span>
                      <h2 className="text-2xl font-bold text-gray-900">{currentLesson.name}</h2>
                      <p className="text-gray-600 mt-1">{currentLesson.description}</p>
                    </div>
                    {completedLessons.includes(currentLesson.id) && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle size={20} />
                        <span className="font-medium">Completed</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={goToPreviousLesson}
                      disabled={currentLessonIndex === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    
                    {!completedLessons.includes(currentLesson.id) && (
                      <button
                        onClick={markLessonComplete}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Mark as Complete
                      </button>
                    )}
                    
                    <button
                      onClick={goToNextLesson}
                      disabled={currentLessonIndex === allLessons.length - 1}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Tasks</h3>
                  <div className="space-y-3">
                    {(currentLesson.activity_blocks || []).map((block) => (
                      <div key={block.id}>
                        {renderActivityBlock(block)}
                      </div>
                    ))}
                  </div>

                  {currentLesson.activity_blocks?.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <PlayCircle size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>No activities in this lesson yet</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <PlayCircle size={64} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Select a Lesson</h3>
                <p className="text-gray-600">Choose a lesson from the course content to start learning</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCertificate && (
        <CertificateView
          courseId={courseId}
          userId={userId}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
}

export default StudentCourseView;
