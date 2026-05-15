"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import toast from "react-hot-toast";
import { Search, Globe } from "lucide-react";

function EditCourseSEO({ courseId, onSave }) {
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCourse() {
      setLoading(true);
      try {
        const data = await api.get(`/courses/${courseId}/builder`);
        setCourseData(data.course);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.patch(`/courses/${courseId}/builder`, {
        meta_title: courseData.meta_title,
        meta_description: courseData.meta_description,
        meta_keywords: courseData.meta_keywords
      });
      toast.success("SEO settings saved");
      onSave?.();
    } catch (err) {
      setError(err.message || "Failed to save SEO settings");
      toast.error("Failed to save SEO settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading SEO settings...</div>;
  }

  return (
    <div className="h-full">
      <div className="h-6" />
      <div className="px-10 pb-10">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <Search className="text-blue-600" size={24} />
            <h3 className="text-xl font-bold text-gray-800">SEO Settings</h3>
          </div>

          {error && (
            <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                value={courseData?.meta_title || ""}
                onChange={(e) => setCourseData({ ...courseData, meta_title: e.target.value })}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Course title for search engines"
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">Max 200 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Description
              </label>
              <textarea
                value={courseData?.meta_description || ""}
                onChange={(e) => setCourseData({ ...courseData, meta_description: e.target.value })}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Brief description for search engines"
                maxLength={300}
              />
              <p className="text-xs text-gray-500 mt-1">Max 300 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Keywords
              </label>
              <input
                type="text"
                value={courseData?.meta_keywords || ""}
                onChange={(e) => setCourseData({ ...courseData, meta_keywords: e.target.value })}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="python, programming, course"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated keywords</p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save SEO Settings"}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="text-blue-600" size={20} />
                <h4 className="font-semibold text-blue-900">SEO Tips</h4>
              </div>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Keep meta titles under 60 characters for optimal display</li>
                <li>• Write unique, descriptive meta descriptions around 150-160 characters</li>
                <li>• Use relevant keywords that match your course content</li>
                <li>• Focus on keywords students might use to find your course</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditCourseSEO;
