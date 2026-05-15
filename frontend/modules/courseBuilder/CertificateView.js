"use client";

import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Award, Download, X, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

function CertificateView({ courseId, userId, onClose }) {
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCertificate, setShowCertificate] = useState(false);

  useEffect(() => {
    async function loadCertificate() {
      setLoading(true);
      try {
        const certData = await api.get(`/certifications/generate/${courseId}/${userId}`);
        setCertificate(certData);
        setShowCertificate(true);
      } catch (err) {
        setError(err.message || "Certificate not available. Complete at least 80% of the course to earn a certificate.");
        setShowCertificate(false);
      } finally {
        setLoading(false);
      }
    }

    if (courseId && userId) {
      loadCertificate();
    }
  }, [courseId, userId]);

  function handleDownload() {
    if (!certificate) return;

    // Create a simple HTML certificate for download
    const template = getCertificateTemplate(certificate.pattern || "modern");
    const certificateHTML = `
      <html>
        <head>
          <title>Certificate of Completion</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              font-family: 'Georgia', serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #f5f5f5;
            }
            .certificate {
              width: 800px;
              padding: 60px;
              background: ${template.background};
              border-radius: 20px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
              color: ${template.textColor};
              position: relative;
              overflow: hidden;
            }
            .certificate::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              border: 5px solid ${template.accent};
              border-radius: 20px;
              pointer-events: none;
            }
            .certificate-header {
              margin-bottom: 40px;
            }
            .certificate-title {
              font-size: 48px;
              font-weight: bold;
              letter-spacing: 4px;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .certificate-subtitle {
              font-size: 18px;
              opacity: 0.9;
            }
            .certificate-body {
              margin: 60px 0;
            }
            .student-name {
              font-size: 36px;
              font-weight: bold;
              margin-bottom: 20px;
            }
            .course-name {
              font-size: 28px;
              margin-bottom: 15px;
            }
            .course-description {
              font-size: 16px;
              opacity: 0.8;
              margin-bottom: 30px;
            }
            .certificate-footer {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .signature-section {
              text-align: center;
            }
            .signature-line {
              border-top: 2px solid ${template.accent};
              padding-top: 10px;
              margin-top: 20px;
            }
            .date-section {
              text-align: center;
            }
            .award-icon {
              font-size: 80px;
              margin-bottom: 20px;
              color: ${template.accent};
            }
          </style>
        </head>
        <body>
          <div class="certificate">
            <div class="certificate-header">
              <div class="award-icon">🏆</div>
              <div class="certificate-title">Certificate of Completion</div>
              <div class="certificate-subtitle">This certifies that</div>
            </div>
            <div class="certificate-body">
              <div class="student-name">${certificate.student_name}</div>
              <div class="course-name">${certificate.course_name}</div>
              <div class="course-description">${certificate.course_description || ""}</div>
            </div>
            <div class="certificate-footer">
              <div class="signature-section">
                <div>${certificate.instructor_name || "Instructor"}</div>
                <div class="signature-line">Signature</div>
              </div>
              <div class="date-section">
                <div>${new Date(certificate.completion_date).toLocaleDateString()}</div>
                <div class="signature-line">Date</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([certificateHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${certificate.student_name.replace(/\s+/g, "_")}_Certificate.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Certificate downloaded!");
  }

  function getCertificateTemplate(pattern) {
    const templates = {
      royal: {
        background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
        accent: "#e94560",
        textColor: "#ffffff"
      },
      tech: {
        background: "linear-gradient(135deg, #0d1b2a, #1b263b, #415a77)",
        accent: "#00d4ff",
        textColor: "#ffffff"
      },
      nature: {
        background: "linear-gradient(135deg, #1a3a2a, #2d5a3d, #4a7c59)",
        accent: "#7fb069",
        textColor: "#ffffff"
      },
      geometric: {
        background: "linear-gradient(45deg, #667eea, #764ba2, #f093fb)",
        accent: "#ffffff",
        textColor: "#ffffff"
      },
      vintage: {
        background: "linear-gradient(135deg, #8b4513, #a0522d, #cd853f)",
        accent: "#ffd700",
        textColor: "#ffffff"
      },
      waves: {
        background: "linear-gradient(135deg, #006994, #008bb8, #00a7e6)",
        accent: "#ffffff",
        textColor: "#ffffff"
      },
      minimal: {
        background: "#ffffff",
        accent: "#000000",
        textColor: "#000000"
      },
      professional: {
        background: "linear-gradient(135deg, #2c3e50, #34495e, #5d6d7e)",
        accent: "#3498db",
        textColor: "#ffffff"
      },
      academic: {
        background: "linear-gradient(135deg, #1e3a5f, #2e5a8f, #3e7abf)",
        accent: "#ffd700",
        textColor: "#ffffff"
      },
      modern: {
        background: "linear-gradient(135deg, #667eea, #764ba2)",
        accent: "#ffffff",
        textColor: "#ffffff"
      }
    };
    
    return templates[pattern] || templates.modern;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-center text-gray-600">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !showCertificate) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Certificate</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <div className="text-center py-8">
            <Award size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-4">{error || "Certificate not available"}</p>
            <p className="text-sm text-gray-500">Complete at least 80% of the course to earn a certificate.</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Award size={24} className="text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-800">Your Certificate</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="text-center mb-6">
          <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
          <p className="text-green-600 font-medium">Congratulations! You've earned your certificate.</p>
        </div>

        {certificate && (
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg p-8 text-white mb-6">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold mb-2">Certificate of Completion</h3>
            <p className="text-lg mb-1">This certifies that</p>
            <p className="text-3xl font-bold mb-4">{certificate.student_name}</p>
            <p className="text-lg mb-1">has successfully completed</p>
            <p className="text-2xl font-semibold mb-4">{certificate.course_name}</p>
            <p className="text-sm opacity-80">Completed on {new Date(certificate.completion_date).toLocaleDateString()}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleDownload}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={20} />
            Download Certificate
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default CertificateView;
