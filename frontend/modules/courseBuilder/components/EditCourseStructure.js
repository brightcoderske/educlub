"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import toast from "react-hot-toast";
import { GripVertical, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

function EditCourseStructure({ courseId, onSave }) {
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBlueprint() {
      setLoading(true);
      try {
        const data = await api.get(`/courses/${courseId}/builder`);
        setBlueprint(data);
        if (data.modules && data.modules.length > 0) {
          setExpanded(new Set([data.modules[0].id]));
        }
      } catch (err) {
        setError(err.message || "Failed to load course structure");
      } finally {
        setLoading(false);
      }
    }

    if (courseId) {
      loadBlueprint();
    }
  }, [courseId]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addModule = async () => {
    setSaving(true);
    try {
      await api.post(`/courses/${courseId}/modules`, { title: "New module" });
      const data = await api.get(`/courses/${courseId}/builder`);
      setBlueprint(data);
      toast.success("Module added");
      onSave?.();
    } catch (err) {
      toast.error("Failed to add module");
    } finally {
      setSaving(false);
    }
  };

  const addLesson = async (moduleId) => {
    setSaving(true);
    try {
      await api.post(`/courses/modules/${moduleId}/lessons`, { title: "New lesson" });
      const data = await api.get(`/courses/${courseId}/builder`);
      setBlueprint(data);
      setExpanded((prev) => new Set(prev).add(moduleId));
      toast.success("Lesson added");
      onSave?.();
    } catch (err) {
      toast.error("Failed to add lesson");
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async (lessonId, type) => {
    setSaving(true);
    try {
      await api.post(`/courses/lessons/${lessonId}/activity-blocks`, {
        activity_type: type,
        marks_weight: 10,
        payload: {}
      });
      const data = await api.get(`/courses/${courseId}/builder`);
      setBlueprint(data);
      toast.success("Activity added");
      onSave?.();
    } catch (err) {
      toast.error("Failed to add activity");
    } finally {
      setSaving(false);
    }
  };

  const deleteModule = async (moduleId) => {
    if (!window.confirm("Delete this module and all lessons inside it?")) return;
    setSaving(true);
    try {
      await api.delete(`/courses/modules/${moduleId}`);
      const data = await api.get(`/courses/${courseId}/builder`);
      setBlueprint(data);
      toast.success("Module deleted");
      onSave?.();
    } catch (err) {
      toast.error("Failed to delete module");
    } finally {
      setSaving(false);
    }
  };

  const deleteLesson = async (lessonId) => {
    if (!window.confirm("Delete this lesson and its activities?")) return;
    setSaving(true);
    try {
      await api.delete(`/courses/lessons/${lessonId}`);
      const data = await api.get(`/courses/${courseId}/builder`);
      setBlueprint(data);
      toast.success("Lesson deleted");
      onSave?.();
    } catch (err) {
      toast.error("Failed to delete lesson");
    } finally {
      setSaving(false);
    }
  };

  const deleteBlock = async (blockId) => {
    if (!window.confirm("Delete this activity block?")) return;
    setSaving(true);
    try {
      await api.delete(`/courses/activity-blocks/${blockId}`);
      const data = await api.get(`/courses/${courseId}/builder`);
      setBlueprint(data);
      toast.success("Activity deleted");
      onSave?.();
    } catch (err) {
      toast.error("Failed to delete activity");
    } finally {
      setSaving(false);
    }
  };

  const saveBlock = async (block, payload) => {
    setSaving(true);
    try {
      await api.patch(`/courses/activity-blocks/${block.id}`, {
        marks_weight: Number(block.marks_weight),
        payload
      });
      const data = await api.get(`/courses/${courseId}/builder`);
      setBlueprint(data);
      toast.success("Activity saved");
      onSave?.();
    } catch (err) {
      toast.error("Failed to save activity");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading course structure...</div>;
  }

  const modules = blueprint?.modules || [];
  const activityTypes = ["learn_content", "practice", "creative_corner", "teacher_task", "quiz", "submission"];

  return (
    <div className="flex flex-col">
      <div className="h-6" />
      <div className="px-10 pb-10">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">Course Structure</h3>
            <button
              onClick={addModule}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus size={16} />
              Add Module
            </button>
          </div>

          {error && (
            <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">{error}</div>
          )}

          <div className="space-y-4">
            {modules.map((module) => (
              <div key={module.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleExpand(module.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {expanded.has(module.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                  <input
                    type="text"
                    defaultValue={module.name}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value !== module.name) {
                        api.patch(`/courses/modules/${module.id}`, { name: value })
                          .then(() => {
                            const data = api.get(`/courses/${courseId}/builder`);
                            setBlueprint(data);
                            toast.success("Module updated");
                            onSave?.();
                          });
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={saving}
                  />
                  <button
                    onClick={() => deleteModule(module.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete module"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {expanded.has(module.id) && (
                  <div className="mt-4 ml-8 space-y-3">
                    <button
                      onClick={() => addLesson(module.id)}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                      <Plus size={14} />
                      Add Lesson
                    </button>

                    {(module.lessons || []).map((lesson) => (
                      <div key={lesson.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <GripVertical size={16} className="text-gray-400" />
                          <input
                            type="text"
                            defaultValue={lesson.name}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value && value !== lesson.name) {
                                api.patch(`/courses/lessons/${lesson.id}`, { name: value })
                                  .then(() => {
                                    const data = api.get(`/courses/${courseId}/builder`);
                                    setBlueprint(data);
                                    toast.success("Lesson updated");
                                    onSave?.();
                                  });
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            disabled={saving}
                          />
                          <button
                            onClick={() => deleteLesson(lesson.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="space-y-2 ml-6">
                          {(lesson.activity_blocks || []).map((block) => (
                            <div key={block.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium capitalize">{block.activity_type.replace('_', ' ')}</span>
                                <button
                                  onClick={() => deleteBlock(block.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  defaultValue={block.marks_weight}
                                  onBlur={(e) => {
                                    const value = Number(e.target.value);
                                    if (value !== block.marks_weight) {
                                      saveBlock({ ...block, marks_weight: value }, block.payload);
                                    }
                                  }}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  placeholder="Marks"
                                  disabled={saving}
                                />
                                <select
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    saveBlock({ ...block, activity_type: value }, block.payload);
                                  }}
                                  defaultValue={block.activity_type}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  disabled={saving}
                                >
                                  {activityTypes.map((type) => (
                                    <option key={type} value={type}>{type.replace('_', ' ')}</option>
                                  ))}
                                </select>
                              </div>
                              <textarea
                                defaultValue={JSON.stringify(block.payload, null, 2)}
                                onBlur={(e) => {
                                  try {
                                    const payload = JSON.parse(e.target.value);
                                    saveBlock(block, payload);
                                  } catch (err) {
                                    toast.error("Invalid JSON");
                                  }
                                }}
                                className="w-full mt-2 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                rows={3}
                                placeholder="Activity payload (JSON)"
                                disabled={saving}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 ml-6">
                          <select
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value) {
                                addBlock(lesson.id, value);
                                e.target.value = "";
                              }
                            }}
                            defaultValue=""
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            disabled={saving}
                          >
                            <option value="">Add activity...</option>
                            {activityTypes.map((type) => (
                              <option key={type} value={type}>{type.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {modules.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No modules yet. Click "Add Module" to start building your course.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditCourseStructure;
