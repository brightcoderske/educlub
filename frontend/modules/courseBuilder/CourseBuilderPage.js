"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import EditCourseGeneral from "./components/EditCourseGeneral";
import EditCourseStructure from "./components/EditCourseStructure";
import EditCourseAccess from "./components/EditCourseAccess";
import EditCourseCertification from "./components/EditCourseCertification";
import EditCourseSEO from "./components/EditCourseSEO";
import EditCourseContributors from "./components/EditCourseContributors";
import toast from "react-hot-toast";
import { ArrowLeft, Settings, Layers, Lock, Award, Search, Users } from "lucide-react";

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "structure", label: "Structure", icon: Layers },
  { id: "access", label: "Access", icon: Lock },
  { id: "certification", label: "Certification", icon: Award },
  { id: "seo", label: "SEO", icon: Search },
  { id: "contributors", label: "Contributors", icon: Users }
];

function CourseBuilderPage({ courseId }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("general");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");

  const handleSave = () => {
    setAutoSaveEnabled(true);
    setSaveStatus("All changes saved");
    toast.success("Changes saved");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const renderTabContent = () => {
    const commonProps = { courseId, onSave: handleSave };

    switch (activeTab) {
      case "general":
        return <EditCourseGeneral {...commonProps} />;
      case "structure":
        return <EditCourseStructure {...commonProps} />;
      case "access":
        return <EditCourseAccess {...commonProps} />;
      case "certification":
        return <EditCourseCertification {...commonProps} />;
      case "seo":
        return <EditCourseSEO {...commonProps} />;
      case "contributors":
        return <EditCourseContributors {...commonProps} />;
      default:
        return <EditCourseGeneral {...commonProps} />;
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
                <h1 className="text-xl font-bold text-gray-900">Course Builder</h1>
                <p className="text-sm text-gray-500">Edit and manage your course</p>
              </div>
            </div>
            {saveStatus && (
              <div className="text-sm text-green-600 font-medium">{saveStatus}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-0" aria-label="Tabs">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-600 bg-blue-50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="min-h-[600px]">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CourseBuilderPage;
