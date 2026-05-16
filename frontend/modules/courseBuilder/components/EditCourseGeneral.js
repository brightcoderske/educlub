"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useFormik } from "formik";
import { AlertTriangle, List, ListOrdered } from "lucide-react";
import { api } from "../../../lib/api";
import toast from "react-hot-toast";

const validate = (values) => {
  const errors = {};

  if (!values.name) {
    errors.name = "Course name is required";
  } else if (values.name.length > 100) {
    errors.name = "Course name must be less than 100 characters";
  }

  if (!values.description) {
    errors.description = "Description is required";
  } else if (values.description.length > 1000) {
    errors.description = "Description must be less than 1000 characters";
  }

  if (!values.learnings) {
    errors.learnings = "Learning objectives are required";
  } else {
    try {
      const learningItems = JSON.parse(values.learnings);
      if (!Array.isArray(learningItems)) {
        errors.learnings = "Learning objectives must be an array";
      } else if (learningItems.length === 0) {
        errors.learnings = "At least one learning objective is required";
      } else {
        const hasEmptyText = learningItems.some(item => !item.text || item.text.trim() === '');
        if (hasEmptyText) {
          errors.learnings = "All learning objectives must have text";
        }
      }
    } catch (e) {
      errors.learnings = "Learning objectives must be valid JSON";
    }
  }

  return errors;
};

function FormattedTextarea({ name, value, onChange, disabled, rows = 4, required = false }) {
  const ref = useRef(null);

  const insertList = (ordered = false) => {
    const text = String(value || "");
    const start = ref.current?.selectionStart ?? text.length;
    const end = ref.current?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const selected = text.slice(start, end);
    const after = text.slice(end);
    const formatted = (selected ? selected.split(/\r?\n/) : [""])
      .map((line, index) => {
        const clean = line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
        return `${ordered ? `${index + 1}.` : "-"} ${clean}`;
      })
      .join("\n");
    onChange({ target: { name, value: `${before}${formatted}${after}` } });
    window.requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(start, start + formatted.length);
    });
  };

  return (
    <div>
      <div className="flex gap-1 px-2 py-1 border border-gray-300 border-b-0 rounded-t-lg bg-gray-50">
        <button type="button" onClick={() => insertList(false)} disabled={disabled} title="Bullet list" className="inline-grid h-8 w-8 place-items-center rounded-md text-gray-600 hover:bg-blue-50 hover:text-blue-700">
          <List size={15} />
        </button>
        <button type="button" onClick={() => insertList(true)} disabled={disabled} title="Numbered list" className="inline-grid h-8 w-8 place-items-center rounded-md text-gray-600 hover:bg-blue-50 hover:text-blue-700">
          <ListOrdered size={15} />
        </button>
      </div>
      <textarea
        ref={ref}
        name={name}
        onChange={onChange}
        value={value}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        rows={rows}
        required={required}
      />
    </div>
  );
}

function EditCourseGeneral({ courseId, onSave }) {
  const [error, setError] = useState("");
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const previousValuesRef = useRef(null);

  const initializeLearnings = useCallback((learnings) => {
    if (!learnings) {
      return JSON.stringify([{ id: 'default-1', text: '', emoji: '📝' }]);
    }

    try {
      const parsed = JSON.parse(learnings);
      if (Array.isArray(parsed)) {
        return learnings;
      }
      if (typeof learnings === 'string') {
        return JSON.stringify([{
          id: 'default-1',
          text: learnings,
          emoji: '📝'
        }]);
      }
      return JSON.stringify([{ id: 'default-1', text: '', emoji: '📝' }]);
    } catch (e) {
      if (typeof learnings === 'string') {
        return JSON.stringify([{
          id: 'default-1',
          text: learnings,
          emoji: '📝'
        }]);
      }
      return JSON.stringify([{ id: 'default-1', text: '', emoji: '📝' }]);
    }
  }, []);

  const initialValues = useMemo(() => {
    const thumbnailType = courseData?.thumbnail_type || 'image';
    return {
      name: courseData?.name || '',
      description: courseData?.description || '',
      about: courseData?.about || '',
      learnings: initializeLearnings(courseData?.learnings || ''),
      tags: courseData?.tags || '',
      public: courseData?.public !== false,
      thumbnail_type: thumbnailType,
    };
  }, [courseData, initializeLearnings]);

  const formik = useFormik({
    initialValues,
    validate,
    onSubmit: async (values) => {
      setSaving(true);
      setError("");
      try {
        await api.patch(`/courses/${courseId}/builder`, values);
        toast.success("Course details saved");
        onSave?.();
      } catch (err) {
        setError(err.message || "Failed to save course details");
        toast.error("Failed to save course details");
      } finally {
        setSaving(false);
      }
    },
    enableReinitialize: true,
  });

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

  if (loading) {
    return <div className="p-6 text-center">Loading course details...</div>;
  }

  return (
    <div className="h-full">
      <div className="h-6" />
      <div className="px-10 pb-10">
        <div className="bg-white rounded-xl shadow-sm p-6">
          {error && (
            <div className="flex justify-center bg-red-200 rounded-md text-red-950 space-x-2 items-center p-4 mb-6 transition-all shadow-sm">
              <AlertTriangle size={18} />
              <div className="font-bold text-sm">{error}</div>
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Course Name
              </label>
              <input
                type="text"
                name="name"
                onChange={formik.handleChange}
                value={formik.values.name}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              {formik.errors.name && (
                <div className="text-red-600 text-sm mt-1">{formik.errors.name}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Short Description
              </label>
              <input
                type="text"
                name="description"
                onChange={formik.handleChange}
                value={formik.values.description}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              {formik.errors.description && (
                <div className="text-red-600 text-sm mt-1">{formik.errors.description}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                About
              </label>
              <FormattedTextarea
                name="about"
                onChange={formik.handleChange}
                value={formik.values.about}
                disabled={saving}
                rows={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Objectives (JSON)
              </label>
              <textarea
                name="learnings"
                onChange={formik.handleChange}
                value={formik.values.learnings}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows={4}
                placeholder='[{"id": "1", "text": "Learn Python basics", "emoji": "🐍"}]'
                required
              />
              {formik.errors.learnings && (
                <div className="text-red-600 text-sm mt-1">{formik.errors.learnings}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <input
                type="text"
                name="tags"
                onChange={formik.handleChange}
                value={formik.values.tags}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="python, programming, beginner"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Thumbnail Type
              </label>
              <select
                name="thumbnail_type"
                onChange={formik.handleChange}
                value={formik.values.thumbnail_type}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditCourseGeneral;
