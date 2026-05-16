"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Award, Eye, Save, Trash2, X } from "lucide-react";
import { api, assetUrl } from "../../../lib/api";

const CERTIFICATION_PATTERNS = [
  { id: "royal", name: "Royal", description: "Formal border, deep blue and gold" },
  { id: "tech", name: "Tech", description: "Clean digital certificate for coding courses" },
  { id: "nature", name: "Nature", description: "Green, calm, growth focused" },
  { id: "geometric", name: "Geometric", description: "Structured angles and bold accents" },
  { id: "vintage", name: "Vintage", description: "Warm parchment certificate" },
  { id: "waves", name: "Waves", description: "Soft movement and ocean accents" },
  { id: "minimal", name: "Minimal", description: "Quiet, simple, modern" },
  { id: "professional", name: "Professional", description: "Corporate and restrained" },
  { id: "academic", name: "Academic", description: "Traditional school certificate" },
  { id: "modern", name: "Modern", description: "Bright contemporary certificate" }
];

export const DEFAULT_SYSTEM_LOGO_URL = "/uploads/educlub-logo/educlub%20logo.png";

export const DEFAULT_CERTIFICATE_CONFIG = {
  enabled: true,
  pattern: "modern",
  certificateTitle: "Certificate of Completion",
  issuerName: "EduClub",
  instructorName: "",
  signatureLabel: "Instructor",
  completionText: "has successfully completed",
  systemLogoUrl: DEFAULT_SYSTEM_LOGO_URL,
  schoolLogoUrl: "",
  includeStudentName: true,
  includeCourseName: true,
  includeCompletionDate: true,
  includeInstructor: true,
  includeCertificateId: true,
  includeLogos: true
};

function certStyle(pattern) {
  const styles = {
    royal: { border: "#b8860b", bg: "linear-gradient(135deg, #f8fafc, #eff6ff)", accent: "#1e3a8a", sub: "#b8860b", frame: "double" },
    tech: { border: "#22d3ee", bg: "linear-gradient(135deg, #07111f, #0f172a)", accent: "#67e8f9", sub: "#a7f3d0", dark: true, frame: "solid" },
    nature: { border: "#16a34a", bg: "linear-gradient(135deg, #f0fdf4, #ecfeff)", accent: "#166534", sub: "#0f766e", frame: "solid" },
    geometric: { border: "#7c3aed", bg: "linear-gradient(135deg, #faf5ff, #eef2ff)", accent: "#5b21b6", sub: "#db2777", frame: "solid" },
    vintage: { border: "#92400e", bg: "linear-gradient(135deg, #fffbeb, #fef3c7)", accent: "#78350f", sub: "#b45309", frame: "double" },
    waves: { border: "#0284c7", bg: "linear-gradient(135deg, #f0f9ff, #ecfeff)", accent: "#075985", sub: "#0891b2", frame: "solid" },
    minimal: { border: "#cbd5e1", bg: "#ffffff", accent: "#0f172a", sub: "#64748b", frame: "solid" },
    professional: { border: "#334155", bg: "linear-gradient(135deg, #f8fafc, #f1f5f9)", accent: "#111827", sub: "#475569", frame: "solid" },
    academic: { border: "#7f1d1d", bg: "linear-gradient(135deg, #fff7ed, #ffffff)", accent: "#7f1d1d", sub: "#92400e", frame: "double" },
    modern: { border: "#2563eb", bg: "linear-gradient(135deg, #eff6ff, #fdf2f8)", accent: "#1d4ed8", sub: "#be185d", frame: "solid" }
  };
  return styles[pattern] || styles.modern;
}

function logoSrc(value) {
  if (!value) return "";
  return String(value).startsWith("data:") || String(value).startsWith("http") ? value : assetUrl(value);
}

export function CertificatePreview({ config, courseName }) {
  const style = certStyle(config.pattern);
  const text = style.dark ? "#e5e7eb" : "#0f172a";
  const muted = style.dark ? "#94a3b8" : "#64748b";

  return (
    <div
      className="certificate-preview"
      style={{
        background: style.bg,
        border: `8px ${style.frame} ${style.border}`,
        color: text
      }}
    >
      <div className={`certificate-preview-mark ${config.pattern}`} />
      {config.includeLogos ? (
        <div className="certificate-preview-logos">
          {config.systemLogoUrl || config.primaryLogoUrl ? <img src={logoSrc(config.systemLogoUrl || config.primaryLogoUrl)} alt="System logo" /> : <span>{config.issuerName?.slice(0, 2) || "EC"}</span>}
          {config.schoolLogoUrl || config.secondaryLogoUrl ? <img src={logoSrc(config.schoolLogoUrl || config.secondaryLogoUrl)} alt="School logo" /> : <span>School</span>}
        </div>
      ) : null}
      <p className="certificate-preview-issuer" style={{ color: style.sub }}>{config.issuerName || "EduClub"}</p>
      <h2 style={{ color: style.accent }}>{config.certificateTitle || "Certificate of Completion"}</h2>
      <p style={{ color: muted }}>This certifies that</p>
      {config.includeStudentName ? <strong className="certificate-preview-student">Learner Name</strong> : null}
      <p style={{ color: muted }}>{config.completionText || "has successfully completed"}</p>
      {config.includeCourseName ? <h3>{courseName || "Course Name"}</h3> : null}
      <div className="certificate-preview-footer">
        {config.includeInstructor ? (
          <div>
            <strong>{config.instructorName || "Instructor Name"}</strong>
            <span>{config.signatureLabel || "Instructor"}</span>
          </div>
        ) : null}
        {config.includeCompletionDate ? (
          <div>
            <strong>{new Date().toLocaleDateString()}</strong>
            <span>Date</span>
          </div>
        ) : null}
        {config.includeCertificateId ? (
          <div>
            <strong>EC-2026-0001</strong>
            <span>Certificate ID</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function EditCourseCertification({ courseId, courseName, onSave, onClose }) {
  const [certifications, setCertifications] = useState([]);
  const [draft, setDraft] = useState(DEFAULT_CERTIFICATE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeCertification = useMemo(() => certifications.find((item) => item.config?.enabled) || certifications[0] || null, [certifications]);

  async function loadCertifications() {
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/certifications/course/${courseId}`);
      const rows = data.data || [];
      setCertifications(rows);
      const loaded = { ...DEFAULT_CERTIFICATE_CONFIG, ...(rows.find((item) => item.config?.enabled)?.config || rows[0]?.config || {}) };
      setDraft({ ...loaded, systemLogoUrl: loaded.systemLogoUrl || loaded.primaryLogoUrl || DEFAULT_SYSTEM_LOGO_URL });
    } catch (err) {
      setError(err.message || "Failed to load certifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (courseId) loadCertifications();
  }, [courseId]);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveCertification() {
    setSaving(true);
    try {
      const normalized = { ...draft, systemLogoUrl: draft.systemLogoUrl || DEFAULT_SYSTEM_LOGO_URL, instructor_name: draft.instructorName };
      if (activeCertification?.certification_uuid) {
        await api.patch(`/certifications/uuid/${activeCertification.certification_uuid}`, { config: normalized });
      } else {
        await api.post("/certifications", { courseId, orgId: 1, config: normalized });
      }
      toast.success("Certificate settings saved");
      await loadCertifications();
      onSave?.();
    } catch (err) {
      toast.error(err.message || "Failed to save certificate settings");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCertification() {
    if (!activeCertification?.certification_uuid || !window.confirm("Delete this certification?")) return;
    setSaving(true);
    try {
      await api.delete(`/certifications/uuid/${activeCertification.certification_uuid}`);
      toast.success("Certification deleted");
      setDraft(DEFAULT_CERTIFICATE_CONFIG);
      await loadCertifications();
      onSave?.();
    } catch (err) {
      toast.error(err.message || "Failed to delete certification");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-center">Loading certification settings...</div>;

  return (
    <div className="cert-config">
      <div className="cert-config-head">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-blue-700">System admin</p>
          <h3>Certificate Configuration</h3>
        </div>
        <button type="button" onClick={onClose} className="cert-close"><X size={18} />Close</button>
      </div>

      {error ? <div className="bg-red-100 text-red-800 p-4 rounded-lg">{error}</div> : null}

      <div className="cert-config-grid">
        <div className="cert-form">
          <label>Theme
            <select value={draft.pattern} onChange={(event) => update("pattern", event.target.value)}>
              {CERTIFICATION_PATTERNS.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name} - {pattern.description}</option>)}
            </select>
          </label>
          <label>Certificate title<input value={draft.certificateTitle} onChange={(event) => update("certificateTitle", event.target.value)} /></label>
          <label>Issuer / platform name<input value={draft.issuerName} onChange={(event) => update("issuerName", event.target.value)} /></label>
          <label>Completion wording<input value={draft.completionText} onChange={(event) => update("completionText", event.target.value)} /></label>
          <label>Instructor name<input value={draft.instructorName} onChange={(event) => update("instructorName", event.target.value)} /></label>
          <label>Signature label<input value={draft.signatureLabel} onChange={(event) => update("signatureLabel", event.target.value)} /></label>
          <label>System logo URL/path<input value={draft.systemLogoUrl || draft.primaryLogoUrl || ""} onChange={(event) => update("systemLogoUrl", event.target.value)} placeholder="/uploads/system-logo.png or https://..." /></label>
          <label>School logo URL/path<input value={draft.schoolLogoUrl || draft.secondaryLogoUrl || ""} onChange={(event) => update("schoolLogoUrl", event.target.value)} placeholder="/uploads/school-logo.png or https://..." /></label>

          <div className="cert-checks">
            {[
              ["enabled", "Enable certificate"],
              ["includeLogos", "Show both logos"],
              ["includeStudentName", "Learner name"],
              ["includeCourseName", "Course name"],
              ["includeCompletionDate", "Completion date"],
              ["includeInstructor", "Instructor/signature"],
              ["includeCertificateId", "Certificate ID"]
            ].map(([key, label]) => (
              <label className="cert-check" key={key}><input type="checkbox" checked={draft[key] !== false} onChange={(event) => update(key, event.target.checked)} />{label}</label>
            ))}
          </div>

          <div className="cert-actions">
            <button type="button" onClick={saveCertification} disabled={saving}><Save size={16} />{saving ? "Saving..." : "Save certificate"}</button>
            {activeCertification ? <button type="button" className="danger" onClick={deleteCertification} disabled={saving}><Trash2 size={16} />Delete</button> : null}
          </div>
        </div>

        <div className="cert-preview-wrap">
          <div className="cert-preview-title"><Eye size={16} />Live preview</div>
          <CertificatePreview config={draft} courseName={courseName} />
        </div>
      </div>
      <style jsx global>{`
        .cert-config {
          display: grid;
          gap: 20px;
          padding: 24px;
          color: #0f172a;
        }
        .cert-config-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 16px;
        }
        .cert-config-head h3 {
          margin: 0;
          font-size: 1.35rem;
          font-weight: 900;
        }
        .cert-close,
        .cert-actions button {
          border: 0;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .cert-close {
          background: #f1f5f9;
          color: #334155;
        }
        .cert-config-grid {
          display: grid;
          grid-template-columns: minmax(300px, 0.9fr) minmax(420px, 1.1fr);
          gap: 22px;
          align-items: start;
        }
        .cert-form {
          display: grid;
          gap: 12px;
        }
        .cert-form label {
          display: grid;
          gap: 6px;
          color: #475569;
          font-size: 0.86rem;
          font-weight: 800;
        }
        .cert-form input,
        .cert-form select {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px 12px;
          font: inherit;
          color: #0f172a;
        }
        .cert-checks {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 8px;
          padding: 12px;
          border-radius: 8px;
          background: #f8fafc;
        }
        .cert-check {
          display: flex !important;
          grid-template-columns: none !important;
          align-items: center;
          gap: 8px !important;
        }
        .cert-check input {
          width: auto;
        }
        .cert-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .cert-actions button {
          background: #2563eb;
          color: #fff;
        }
        .cert-actions .danger {
          background: #fee2e2;
          color: #b91c1c;
        }
        .cert-preview-wrap {
          display: grid;
          gap: 10px;
        }
        .cert-preview-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          font-weight: 800;
        }
        .certificate-preview {
          position: relative;
          min-height: 560px;
          overflow: hidden;
          border-radius: 10px;
          padding: 42px;
          display: grid;
          align-content: center;
          justify-items: center;
          gap: 14px;
          text-align: center;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14);
        }
        .certificate-preview-mark {
          position: absolute;
          inset: 22px;
          border: 1px solid rgba(100, 116, 139, 0.28);
          pointer-events: none;
        }
        .certificate-preview-mark.geometric {
          clip-path: polygon(0 0, 100% 0, 92% 100%, 8% 100%);
        }
        .certificate-preview-mark.waves {
          border-radius: 38% 62% 45% 55%;
        }
        .certificate-preview-logos {
          position: absolute;
          top: 32px;
          left: 36px;
          right: 36px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }
        .certificate-preview-logos img,
        .certificate-preview-logos span {
          width: 74px;
          height: 74px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.45);
          background: rgba(255, 255, 255, 0.75);
          object-fit: contain;
          padding: 8px;
          color: #334155;
          font-size: 0.8rem;
          font-weight: 900;
        }
        .certificate-preview-issuer {
          margin: 60px 0 0;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 900;
        }
        .certificate-preview h2 {
          margin: 0;
          font-size: 2.4rem;
          font-weight: 950;
        }
        .certificate-preview h3 {
          margin: 0;
          font-size: 1.8rem;
          font-weight: 900;
        }
        .certificate-preview p {
          margin: 0;
        }
        .certificate-preview-student {
          font-size: 2.2rem;
          font-family: Georgia, serif;
        }
        .certificate-preview-footer {
          width: 100%;
          margin-top: 32px;
          display: flex;
          justify-content: center;
          gap: 28px;
          flex-wrap: wrap;
        }
        .certificate-preview-footer div {
          min-width: 140px;
          display: grid;
          gap: 4px;
          border-top: 1px solid currentColor;
          padding-top: 8px;
        }
        .certificate-preview-footer span {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        @media (max-width: 980px) {
          .cert-config-grid {
            grid-template-columns: 1fr;
          }
          .certificate-preview {
            min-height: 460px;
            padding: 28px;
          }
        }
      `}</style>
    </div>
  );
}
