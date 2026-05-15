"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import toast from "react-hot-toast";
import { Award, Download, Eye } from "lucide-react";

const CERTIFICATION_PATTERNS = [
  { id: "royal", name: "Royal", description: "Classic royal theme" },
  { id: "tech", name: "Tech", description: "Modern tech theme" },
  { id: "nature", name: "Nature", description: "Nature-inspired theme" },
  { id: "geometric", name: "Geometric", description: "Geometric patterns" },
  { id: "vintage", name: "Vintage", description: "Vintage style" },
  { id: "waves", name: "Waves", description: "Wave patterns" },
  { id: "minimal", name: "Minimal", description: "Minimalist design" },
  { id: "professional", name: "Professional", description: "Professional look" },
  { id: "academic", name: "Academic", description: "Academic style" },
  { id: "modern", name: "Modern", description: "Modern design" }
];

function EditCourseCertification({ courseId, onSave }) {
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    async function loadCertifications() {
      setLoading(true);
      try {
        const data = await api.get(`/certifications/course/${courseId}`);
        setCertifications(data.data || []);
      } catch (err) {
        setError(err.message || "Failed to load certifications");
      } finally {
        setLoading(false);
      }
    }

    if (courseId) {
      loadCertifications();
    }
  }, [courseId]);

  const createCertification = async (pattern, instructorName) => {
    setSaving(true);
    try {
      await api.post("/certifications", {
        courseId,
        config: {
          pattern,
          instructorName,
          enabled: true
        },
        orgId: 1
      });
      const data = await api.get(`/certifications/course/${courseId}`);
      setCertifications(data.data || []);
      toast.success("Certification created");
      onSave?.();
    } catch (err) {
      toast.error("Failed to create certification");
    } finally {
      setSaving(false);
    }
  };

  const updateCertification = async (certificationUuid, config) => {
    setSaving(true);
    try {
      await api.patch(`/certifications/uuid/${certificationUuid}`, { config });
      const data = await api.get(`/certifications/course/${courseId}`);
      setCertifications(data.data || []);
      toast.success("Certification updated");
      onSave?.();
    } catch (err) {
      toast.error("Failed to update certification");
    } finally {
      setSaving(false);
    }
  };

  const deleteCertification = async (certificationUuid) => {
    if (!window.confirm("Delete this certification?")) return;
    setSaving(true);
    try {
      await api.delete(`/certifications/uuid/${certificationUuid}`);
      const data = await api.get(`/certifications/course/${courseId}`);
      setCertifications(data.data || []);
      toast.success("Certification deleted");
      onSave?.();
    } catch (err) {
      toast.error("Failed to delete certification");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading certification settings...</div>;
  }

  const activeCertification = certifications.find(c => c.config?.enabled);

  return (
    <div className="h-full">
      <div className="h-6" />
      <div className="px-10 pb-10">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Award className="text-blue-600" size={24} />
              <h3 className="text-xl font-bold text-gray-800">Course Certification</h3>
            </div>
            {activeCertification && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Eye size={16} />
                {showPreview ? "Hide Preview" : "Preview"}
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">{error}</div>
          )}

          {showPreview && activeCertification && (
            <div className="border-2 border-gray-200 rounded-lg p-8 mb-6 bg-gradient-to-br from-blue-50 to-purple-50">
              <div className="max-w-2xl mx-auto text-center">
                <Award size={64} className="mx-auto mb-4 text-blue-600" />
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Certificate of Completion</h2>
                <p className="text-gray-600 mb-6">This certifies that the student has successfully completed</p>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Course Name</h3>
                <p className="text-gray-600 mb-6">
                  Instructor: {activeCertification.config?.instructorName || "Instructor"}
                </p>
                <div className="flex justify-center gap-4 mt-8">
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Download size={16} />
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeCertification ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pattern</label>
                <select
                  value={activeCertification.config?.pattern || "modern"}
                  onChange={(e) => updateCertification(activeCertification.certification_uuid, {
                    ...activeCertification.config,
                    pattern: e.target.value
                  })}
                  disabled={saving}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {CERTIFICATION_PATTERNS.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.name} - {pattern.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instructor Name</label>
                <input
                  type="text"
                  value={activeCertification.config?.instructorName || ""}
                  onChange={(e) => updateCertification(activeCertification.certification_uuid, {
                    ...activeCertification.config,
                    instructorName: e.target.value
                  })}
                  disabled={saving}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={activeCertification.config?.enabled}
                  onChange={(e) => updateCertification(activeCertification.certification_uuid, {
                    ...activeCertification.config,
                    enabled: e.target.checked
                  })}
                  disabled={saving}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="enabled" className="text-sm text-gray-700">Enable certification for this course</label>
              </div>

              <button
                onClick={() => deleteCertification(activeCertification.certification_uuid)}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Delete Certification
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <Award size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-4">No certification configured for this course</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Pattern</label>
                  <select
                    id="pattern-select"
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {CERTIFICATION_PATTERNS.map((pattern) => (
                      <option key={pattern.id} value={pattern.id}>
                        {pattern.name} - {pattern.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Instructor Name</label>
                  <input
                    id="instructor-input"
                    type="text"
                    placeholder="Enter instructor name"
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => {
                    const pattern = document.getElementById("pattern-select").value;
                    const instructorName = document.getElementById("instructor-input").value;
                    createCertification(pattern, instructorName);
                  }}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Certification
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditCourseCertification;
