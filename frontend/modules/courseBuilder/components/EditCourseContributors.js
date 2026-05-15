"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import toast from "react-hot-toast";
import { Users, UserPlus, X, Shield } from "lucide-react";

function EditCourseContributors({ courseId, onSave }) {
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadContributors() {
      setLoading(true);
      try {
        const data = await api.get(`/contributors/courses/${courseId}/contributors`);
        setContributors(data.data || []);
      } catch (err) {
        setError(err.message || "Failed to load contributors");
      } finally {
        setLoading(false);
      }
    }

    if (courseId) {
      loadContributors();
    }
  }, [courseId]);

  const addContributor = async (userId, role, canEdit) => {
    setSaving(true);
    try {
      await api.post("/contributors/courses/contributors/add", {
        courseId,
        userId: Number(userId),
        role: role || "contributor",
        canEdit: canEdit !== false
      });
      const data = await api.get(`/contributors/courses/${courseId}/contributors`);
      setContributors(data.data || []);
      toast.success("Contributor added");
      onSave?.();
    } catch (err) {
      toast.error("Failed to add contributor");
    } finally {
      setSaving(false);
    }
  };

  const removeContributor = async (userId) => {
    if (!window.confirm("Remove this contributor?")) return;
    setSaving(true);
    try {
      await api.post("/contributors/courses/contributors/remove", {
        courseId,
        userId: Number(userId)
      });
      const data = await api.get(`/contributors/courses/${courseId}/contributors`);
      setContributors(data.data || []);
      toast.success("Contributor removed");
      onSave?.();
    } catch (err) {
      toast.error("Failed to remove contributor");
    } finally {
      setSaving(false);
    }
  };

  const updateContributor = async (userId, role, canEdit) => {
    setSaving(true);
    try {
      await api.patch("/contributors/courses/contributors/update", {
        courseId,
        userId: Number(userId),
        role,
        canEdit
      });
      const data = await api.get(`/contributors/courses/${courseId}/contributors`);
      setContributors(data.data || []);
      toast.success("Contributor updated");
      onSave?.();
    } catch (err) {
      toast.error("Failed to update contributor");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading contributors...</div>;
  }

  return (
    <div className="h-full">
      <div className="h-6" />
      <div className="px-10 pb-10">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-blue-600" size={24} />
            <h3 className="text-xl font-bold text-gray-800">Course Contributors</h3>
          </div>

          {error && (
            <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">{error}</div>
          )}

          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-gray-800 mb-4">Add Contributor</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
                  <input
                    type="number"
                    id="new-user-id"
                    placeholder="Enter user ID"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    id="new-user-role"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="contributor">Contributor</option>
                    <option value="co-author">Co-author</option>
                    <option value="editor">Editor</option>
                    <option value="reviewer">Reviewer</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      const userId = document.getElementById("new-user-id").value;
                      const role = document.getElementById("new-user-role").value;
                      if (userId) {
                        addContributor(userId, role, true);
                      }
                    }}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <UserPlus size={16} />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-4">Current Contributors</h4>
              {contributors.length === 0 ? (
                <p className="text-gray-500 text-sm">No contributors added yet</p>
              ) : (
                <div className="space-y-3">
                  {contributors.map((contributor) => (
                    <div
                      key={contributor.user_id}
                      className="flex items-center justify-between border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="text-blue-600" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {contributor.first_name} {contributor.last_name}
                          </p>
                          <p className="text-sm text-gray-600">{contributor.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <select
                          value={contributor.role}
                          onChange={(e) => updateContributor(contributor.user_id, e.target.value, contributor.can_edit)}
                          disabled={saving}
                          className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="contributor">Contributor</option>
                          <option value="co-author">Co-author</option>
                          <option value="editor">Editor</option>
                          <option value="reviewer">Reviewer</option>
                        </select>
                        <div className="flex items-center gap-2">
                          <Shield className={contributor.can_edit ? "text-green-600" : "text-gray-400"} size={16} />
                          <span className="text-sm text-gray-600">{contributor.can_edit ? "Can edit" : "Read only"}</span>
                        </div>
                        <button
                          onClick={() => removeContributor(contributor.user_id)}
                          disabled={saving}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditCourseContributors;
