"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import toast from "react-hot-toast";
import { Lock, Unlock, Users, X } from "lucide-react";

function EditCourseAccess({ courseId, onSave }) {
  const [courseData, setCourseData] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [courseData, groups] = await Promise.all([
          api.get(`/courses/${courseId}/builder`),
          api.get(`/access-control/courses/${courseId}/user-groups?orgId=1`)
        ]);
        setCourseData(courseData.course);
        setUserGroups(groups.data || []);
      } catch (err) {
        setError(err.message || "Failed to load access settings");
      } finally {
        setLoading(false);
      }
    }

    if (courseId) {
      loadData();
    }
  }, [courseId]);

  const togglePublicAccess = async () => {
    setSaving(true);
    try {
      const newPublicStatus = !courseData.public;
      await api.patch(`/access-control/courses/${courseId}/access`, {
        isPublic: newPublicStatus
      });
      setCourseData({ ...courseData, public: newPublicStatus });
      toast.success("Access settings updated");
      onSave?.();
    } catch (err) {
      toast.error("Failed to update access settings");
    } finally {
      setSaving(false);
    }
  };

  const linkUserGroup = async (userGroupId) => {
    setSaving(true);
    try {
      await api.post(`/access-control/courses/link-user-group`, {
        courseId,
        userGroupId
      });
      const groups = await api.get(`/access-control/courses/${courseId}/user-groups?orgId=1`);
      setUserGroups(groups.data || []);
      toast.success("User group linked");
      onSave?.();
    } catch (err) {
      toast.error("Failed to link user group");
    } finally {
      setSaving(false);
    }
  };

  const unlinkUserGroup = async (userGroupId) => {
    if (!window.confirm("Remove access for this user group?")) return;
    setSaving(true);
    try {
      await api.post(`/access-control/courses/unlink-user-group`, {
        courseId,
        userGroupId
      });
      const groups = await api.get(`/access-control/courses/${courseId}/user-groups?orgId=1`);
      setUserGroups(groups.data || []);
      toast.success("User group unlinked");
      onSave?.();
    } catch (err) {
      toast.error("Failed to unlink user group");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading access settings...</div>;
  }

  return (
    <div className="h-full">
      <div className="h-6" />
      <div className="px-10 pb-10">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Course Access Control</h3>

          {error && (
            <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">{error}</div>
          )}

          <div className="space-y-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {courseData?.public ? (
                    <Unlock className="text-green-600" size={24} />
                  ) : (
                    <Lock className="text-gray-600" size={24} />
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-800">
                      {courseData?.public ? "Public Access" : "Private Access"}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {courseData?.public
                        ? "Anyone can access this course"
                        : "Only authorized users can access this course"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={togglePublicAccess}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : courseData?.public ? "Make Private" : "Make Public"}
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="text-blue-600" size={20} />
                <h4 className="font-semibold text-gray-800">User Groups with Access</h4>
              </div>

              <div className="space-y-2">
                {userGroups.length === 0 ? (
                  <p className="text-gray-500 text-sm">No user groups linked yet</p>
                ) : (
                  userGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                    >
                      <div>
                        <span className="font-medium text-gray-800">{group.name}</span>
                        {group.description && (
                          <span className="text-sm text-gray-600 ml-2">{group.description}</span>
                        )}
                      </div>
                      <button
                        onClick={() => unlinkUserGroup(group.id)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    const groupId = window.prompt("Enter user group ID to link:");
                    if (groupId) {
                      linkUserGroup(Number(groupId));
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Link User Group
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditCourseAccess;
