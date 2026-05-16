"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  Bold,
  CheckCircle2,
  ChevronRight,
  Code,
  Copy,
  FileUp,
  GripVertical,
  Image as ImageIcon,
  Italic,
  Layers,
  List,
  ListChecks,
  ListOrdered,
  MonitorPlay,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Underline,
  Upload
} from "lucide-react";
import { api, assetUrl } from "../../lib/api";
import "./course-builder.css";

const TECH_OPTIONS = [
  { value: "", label: "Technology / track" },
  { value: "python", label: "Python" },
  { value: "web", label: "HTML / CSS / JavaScript" },
  { value: "android", label: "Android (Java/Kotlin basics)" },
  { value: "arduino", label: "Arduino / electronics" },
  { value: "scratch", label: "Scratch" },
  { value: "robotics", label: "Robotics" },
  { value: "computer_basics", label: "Computer basics" },
  { value: "other", label: "Other / mixed" }
];

const BLOCK_TOOLS = [
  { type: "rich_text", label: "Rich text", icon: List, color: "blue" },
  { type: "image_upload", label: "Image", icon: ImageIcon, color: "green" },
  { type: "code_explanation", label: "Code explanation", icon: Code, color: "violet" },
  { type: "runnable_code", label: "Runnable code", icon: MonitorPlay, color: "cyan" },
  { type: "practice_code", label: "Practice code", icon: Code, color: "amber" },
  { type: "auto_marked_code", label: "Auto-marked code", icon: ListChecks, color: "rose" },
  { type: "quiz", label: "Quiz", icon: ListOrdered, color: "purple" },
  { type: "flashcards", label: "Flashcards", icon: Copy, color: "teal" },
  { type: "assignment_submission", label: "Assignment", icon: FileUp, color: "orange" },
  { type: "mark_complete", label: "Mark complete", icon: CheckCircle2, color: "emerald" }
];

const LANGUAGE_OPTIONS = ["html", "css", "javascript", "python", "java"];

function blockTitle(type) {
  return BLOCK_TOOLS.find((tool) => tool.type === type)?.label || String(type || "Block").replace(/_/g, " ");
}

function defaultPayload(type) {
  switch (type) {
    case "rich_text":
      return { richText: "Write lesson content here." };
    case "image_upload":
      return { imageUrl: "", alt: "", caption: "" };
    case "code_explanation":
      return { language: "javascript", explanation: "Explain the idea step by step.", code: "console.log('Hello EduClub');" };
    case "runnable_code":
      return { language: "javascript", instructions: "Run the code and observe the output.", html: "<h1>Hello EduClub</h1>", css: "body { font-family: Arial; }", js: "console.log('Ready');", starterCode: "console.log('Hello EduClub');" };
    case "practice_code":
      return { language: "python", instructions: "Try the task, then run your code.", starterCode: "print('Hello EduClub')" };
    case "auto_marked_code":
      return { language: "javascript", instructions: "Solve the task. Your output and required keywords will be checked.", starterCode: "console.log('Hello EduClub');", expectedOutput: "Hello EduClub", requiredKeywords: ["console.log"], hiddenTests: [] };
    case "quiz":
      return { questions: [{ question: "Your question?", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 0 }] };
    case "flashcards":
      return { cards: [{ front: "Term", back: "Definition" }] };
    case "assignment_submission":
      return { instructions: "Submit your project evidence.", allowCode: true, allowScreenshot: true, allowText: true, allowLink: true, allowFile: true };
    case "mark_complete":
      return { title: "Finish lesson", xp: 20, message: "Congratulations. You earned XP for completing this lesson." };
    default:
      return {};
  }
}

function SortableItem({ id, children, className }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.72 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={className} {...attributes}>
      {children(listeners)}
    </div>
  );
}

function RichTextArea({ value, onChange, rows = 5, placeholder = "" }) {
  const textareaRef = useRef(null);
  const wrapSelection = (beforeToken, afterToken = beforeToken) => {
    const text = String(value || "");
    const start = textareaRef.current?.selectionStart ?? text.length;
    const end = textareaRef.current?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const selected = text.slice(start, end) || "text";
    const after = text.slice(end);
    onChange(`${before}${beforeToken}${selected}${afterToken}${after}`);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };
  const applyColor = (color) => wrapSelection(`<span style="color:${color}">`, "</span>");
  const applySize = (size) => wrapSelection(`<span style="font-size:${size}">`, "</span>");
  const insertList = (ordered = false) => {
    const text = String(value || "");
    const start = textareaRef.current?.selectionStart ?? text.length;
    const end = textareaRef.current?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const selected = text.slice(start, end);
    const after = text.slice(end);
    const lines = selected ? selected.split(/\r?\n/) : [""];
    const formatted = lines.map((line, index) => `${ordered ? `${index + 1}.` : "-"} ${line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "")}`).join("\n");
    onChange(`${before}${formatted}${after}`);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };
  return (
    <div className="rich-textarea">
      <div className="rich-textarea-toolbar">
        <button type="button" onClick={() => wrapSelection("<strong>", "</strong>")} title="Bold"><Bold size={15} /></button>
        <button type="button" onClick={() => wrapSelection("<em>", "</em>")} title="Italic"><Italic size={15} /></button>
        <button type="button" onClick={() => wrapSelection("<u>", "</u>")} title="Underline"><Underline size={15} /></button>
        <button type="button" onClick={() => insertList(false)} title="Bullet list"><List size={15} /></button>
        <button type="button" onClick={() => insertList(true)} title="Numbered list"><ListOrdered size={15} /></button>
        <select title="Text size" defaultValue="" onChange={(event) => { if (event.target.value) applySize(event.target.value); event.target.value = ""; }}>
          <option value="">Size</option>
          <option value="1rem">Normal</option>
          <option value="1.2rem">Large</option>
          <option value="1.45rem">Heading</option>
        </select>
        <select title="Text color" defaultValue="" onChange={(event) => { if (event.target.value) applyColor(event.target.value); event.target.value = ""; }}>
          <option value="">Color</option>
          <option value="#1d4ed8">Blue</option>
          <option value="#15803d">Green</option>
          <option value="#b45309">Gold</option>
          <option value="#be123c">Rose</option>
          <option value="#0f172a">Dark</option>
        </select>
      </div>
      <textarea ref={textareaRef} value={value || ""} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} />
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CourseBuilderPanel({ courses, onPublished }) {
  const [courseId, setCourseId] = useState("");
  const [blueprint, setBlueprint] = useState(null);
  const [meta, setMeta] = useState({});
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedCourseOptions = useMemo(
    () => [...(courses || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [courses]
  );

  const modules = blueprint?.modules || [];
  const selectedModule = modules.find((module) => module.id === selectedModuleId) || modules[0] || null;
  const lessons = selectedModule?.lessons || [];
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) || lessons[0] || null;
  const blocks = selectedLesson?.activity_blocks || [];

  const loadBlueprint = useCallback(async (id) => {
    if (!id) {
      setBlueprint(null);
      setSelectedModuleId("");
      setSelectedLessonId("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/courses/${id}/builder`);
      setBlueprint(data);
      const c = data.course || {};
      setMeta({
        title: c.title || c.name || "",
        name: c.name || "",
        short_description: c.short_description || "",
        description: c.description || "",
        objectives: c.objectives || "",
        cover_image_url: c.cover_image_url || "",
        target_level: c.target_level || "",
        technology: c.technology || "",
        status: c.status || "draft"
      });
      const firstModule = data.modules?.[0];
      setSelectedModuleId((current) => data.modules?.some((module) => module.id === current) ? current : firstModule?.id || "");
      setSelectedLessonId((current) => {
        const allLessons = data.modules?.flatMap((module) => module.lessons || []) || [];
        return allLessons.some((lesson) => lesson.id === current) ? current : firstModule?.lessons?.[0]?.id || "";
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlueprint(courseId);
  }, [courseId, loadBlueprint]);

  async function refresh() {
    await loadBlueprint(courseId);
  }

  async function runAction(label, task, successLabel = "Saved") {
    setSaving(label);
    setError("");
    try {
      const result = await task();
      setSaving(successLabel);
      window.setTimeout(() => setSaving(""), 1200);
      return result;
    } catch (err) {
      setError(err.message);
      setSaving("");
      return null;
    }
  }

  async function saveCourseMeta() {
    if (!courseId) return;
    await runAction("Saving course...", async () => {
      const data = await api.patch(`/courses/${courseId}/builder`, meta);
      setBlueprint(data);
      onPublished?.();
    });
  }

  async function uploadCoverImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !courseId) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Upload a JPG, JPEG, or PNG course cover image");
      return;
    }
    setCoverUploading(true);
    await runAction("Uploading cover...", async () => {
      const formData = new FormData();
      formData.append("image", file);
      const result = await api.upload(`/courses/${courseId}/cover-image`, formData);
      setMeta((current) => ({ ...current, cover_image_url: result.cover_image_url || "" }));
      await refresh();
      onPublished?.();
    }, "Uploaded");
    setCoverUploading(false);
  }

  async function publishCourse(published) {
    if (!courseId) return;
    await runAction(published ? "Publishing..." : "Unpublishing...", async () => {
      await api.patch(`/courses/${courseId}/publish`, { is_published: published });
      await refresh();
      onPublished?.();
    }, published ? "Published" : "Unpublished");
  }

  async function addModule() {
    if (!courseId) return;
    const row = await runAction("Adding module...", () => api.post(`/courses/${courseId}/modules`, { title: "New module" }), "Module added");
    await refresh();
    if (row?.id) setSelectedModuleId(row.id);
  }

  async function addQuizModule() {
    if (!courseId) return;
    const week = window.prompt("Quiz week number or title", "Week 5 Quiz");
    if (!week) return;
    const title = /^\d+$/.test(week.trim()) ? `Week ${week.trim()} Quiz` : week.trim();
    const module = await runAction("Adding quiz module...", () => api.post(`/courses/${courseId}/modules`, { title, name: title }), "Quiz module added");
    if (module?.id) {
      const lesson = await api.post(`/courses/modules/${module.id}/lessons`, { title, name: title });
      if (lesson?.id) {
        await api.post(`/courses/lessons/${lesson.id}/activity-blocks`, {
          activity_type: "quiz",
          marks_weight: 100,
          payload: defaultPayload("quiz")
        });
      }
      await refresh();
      setSelectedModuleId(module.id);
      if (lesson?.id) setSelectedLessonId(lesson.id);
    }
  }

  async function saveModule(moduleId, patch) {
    await runAction("Saving module...", async () => {
      await api.patch(`/courses/modules/${moduleId}`, patch);
      await refresh();
    });
  }

  async function deleteModule(moduleId) {
    if (!window.confirm("Delete this module and all lessons inside it?")) return;
    await runAction("Deleting module...", async () => {
      await api.delete(`/courses/modules/${moduleId}`);
      await refresh();
    }, "Deleted");
  }

  async function addLesson(moduleId) {
    const row = await runAction("Adding lesson...", () => api.post(`/courses/modules/${moduleId}/lessons`, { title: "New lesson" }), "Lesson added");
    await refresh();
    if (row?.id) setSelectedLessonId(row.id);
  }

  async function saveLesson(lessonId, patch) {
    await runAction("Saving lesson...", async () => {
      await api.patch(`/courses/lessons/${lessonId}`, patch);
      await refresh();
    });
  }

  async function deleteLesson(lessonId) {
    if (!window.confirm("Delete this lesson and all blocks inside it?")) return;
    await runAction("Deleting lesson...", async () => {
      await api.delete(`/courses/lessons/${lessonId}`);
      await refresh();
    }, "Deleted");
  }

  async function duplicateLesson(lesson) {
    if (!selectedModule) return;
    const created = await runAction("Duplicating lesson...", () => api.post(`/courses/modules/${selectedModule.id}/lessons`, { title: `${lesson.name || lesson.title} copy`, description: lesson.description || "" }), "Lesson duplicated");
    if (created?.id) {
      for (const block of lesson.activity_blocks || []) {
        await api.post(`/courses/lessons/${created.id}/activity-blocks`, {
          activity_type: block.activity_type,
          marks_weight: Number(block.marks_weight || 10),
          payload: block.payload || {}
        });
      }
    }
    await refresh();
    if (created?.id) setSelectedLessonId(created.id);
  }

  async function addBlock(type) {
    if (!selectedLesson) return;
    const created = await runAction(`Adding ${blockTitle(type)}...`, () => api.post(`/courses/lessons/${selectedLesson.id}/activity-blocks`, {
      activity_type: type,
      marks_weight: type === "mark_complete" ? 20 : 10,
      payload: defaultPayload(type)
    }), "Block added");
    await refresh();
    return created;
  }

  async function saveBlock(blockId, patch) {
    try {
      await api.patch(`/courses/activity-blocks/${blockId}`, patch);
      await refresh();
      return true;
    } catch (err) {
      if (String(err.message || "").toLowerCase().includes("activity block not found")) {
        await refresh();
        return false;
      }
      throw err;
    }
  }

  async function duplicateBlock(block) {
    if (!selectedLesson) return;
    await runAction("Duplicating block...", async () => {
      await api.post(`/courses/lessons/${selectedLesson.id}/activity-blocks`, {
        activity_type: block.activity_type,
        marks_weight: Number(block.marks_weight || 10),
        payload: block.payload || {}
      });
      await refresh();
    }, "Block duplicated");
  }

  async function deleteBlock(blockId) {
    if (!window.confirm("Delete this block?")) return;
    await runAction("Deleting block...", async () => {
      await api.delete(`/courses/activity-blocks/${blockId}`);
      await refresh();
    }, "Deleted");
  }

  async function reorderBlocks(activeId, overId) {
    if (!selectedLesson || !overId || activeId === overId) return;
    const oldIndex = blocks.findIndex((block) => block.id === activeId);
    const newIndex = blocks.findIndex((block) => block.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(blocks, oldIndex, newIndex);
    setBlueprint((current) => ({
      ...current,
      modules: current.modules.map((module) => ({
        ...module,
        lessons: (module.lessons || []).map((lesson) => lesson.id === selectedLesson.id ? { ...lesson, activity_blocks: next } : lesson)
      }))
    }));
    await api.patch(`/courses/lessons/${selectedLesson.id}/activity-blocks/reorder`, { ordered_ids: next.map((block) => block.id) });
  }

  async function reorderLessons(activeId, overId) {
    if (!selectedModule || !overId || activeId === overId) return;
    const oldIndex = lessons.findIndex((lesson) => lesson.id === activeId);
    const newIndex = lessons.findIndex((lesson) => lesson.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(lessons, oldIndex, newIndex);
    setBlueprint((current) => ({ ...current, modules: current.modules.map((module) => module.id === selectedModule.id ? { ...module, lessons: next } : module) }));
    await api.patch(`/courses/modules/${selectedModule.id}/lessons/reorder`, { ordered_ids: next.map((lesson) => lesson.id) });
  }

  return (
    <div className="course-builder course-builder-v2">
      <div className="builder-topbar">
        <label>
          Course
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">Select a course...</option>
            {sortedCourseOptions.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </label>
        <div className="builder-status">{saving || (loading ? "Loading..." : "Manual save ready")}</div>
        {courseId ? (
          <div className="builder-top-actions">
            <button type="button" onClick={() => setPreviewMode((value) => !value)}><Play size={15} />{previewMode ? "Edit builder" : "Preview learner"}</button>
            <button type="button" className="secondary-button" onClick={refresh}>Refresh</button>
            <button type="button" onClick={saveCourseMeta}><Save size={15} />Save details</button>
            <button type="button" onClick={() => publishCourse(true)}>Publish</button>
            <button type="button" className="secondary-button" onClick={() => publishCourse(false)}>Unpublish</button>
          </div>
        ) : null}
      </div>

      {error ? <div className="alert">{error}</div> : null}

      {blueprint && courseId ? (
        <>
          <section className="builder-course-details">
            <div className="course-cover-preview compact">
              {meta.cover_image_url ? <img src={assetUrl(meta.cover_image_url)} alt={`${meta.title || "Course"} cover`} /> : <div className="course-cover-placeholder"><ImageIcon size={22} /><span>No cover</span></div>}
            </div>
            <div className="builder-detail-grid">
              <label>Title<input value={meta.title} onChange={(event) => setMeta({ ...meta, title: event.target.value, name: event.target.value })} /></label>
              <label>Short description<input value={meta.short_description} onChange={(event) => setMeta({ ...meta, short_description: event.target.value })} /></label>
              <label>Target level<input value={meta.target_level} onChange={(event) => setMeta({ ...meta, target_level: event.target.value })} /></label>
              <label>Technology<select value={meta.technology} onChange={(event) => setMeta({ ...meta, technology: event.target.value })}>{TECH_OPTIONS.map((option) => <option key={option.value || "empty"} value={option.value}>{option.label}</option>)}</select></label>
              <label className="cover-upload-inline"><Upload size={15} />{coverUploading ? "Uploading..." : "Upload cover"}<input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={uploadCoverImage} /></label>
            </div>
          </section>

          <div className="builder-shell">
            <aside className="builder-outline">
              <div className="builder-pane-head">
                <strong>Modules</strong>
                <button type="button" onClick={addModule}><Plus size={14} />Module</button>
                <button type="button" onClick={addQuizModule}><ListChecks size={14} />Quiz module</button>
              </div>
              <div className="module-stack">
                {modules.map((module) => (
                  <div key={module.id} className={`outline-module ${module.id === selectedModule?.id ? "active" : ""}`}>
                    <button type="button" onClick={() => { setSelectedModuleId(module.id); setSelectedLessonId(module.lessons?.[0]?.id || ""); }}>
                      <Layers size={15} />
                      <span>{module.name || module.title || "Module"}</span>
                    </button>
                    {module.id === selectedModule?.id ? (
                      <div className="outline-edit">
                        <input defaultValue={module.name || ""} onBlur={(event) => event.target.value.trim() && saveModule(module.id, { name: event.target.value.trim(), title: event.target.value.trim() })} />
                        <div className="outline-actions">
                          <button type="button" onClick={() => addLesson(module.id)}><Plus size={13} />Lesson</button>
                          <button type="button" className="danger-button" onClick={() => deleteModule(module.id)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {selectedModule ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => reorderLessons(event.active.id, event.over?.id)}>
                  <SortableContext items={lessons.map((lesson) => lesson.id)} strategy={verticalListSortingStrategy}>
                    <div className="lesson-stack">
                      {lessons.map((lesson, index) => (
                        <SortableItem key={lesson.id} id={lesson.id} className={`outline-lesson ${lesson.id === selectedLesson?.id ? "active" : ""}`}>
                          {(listeners) => (
                            <>
                              <span className="drag-dot" {...listeners}><GripVertical size={13} /></span>
                              <button type="button" onClick={() => setSelectedLessonId(lesson.id)}>
                                <span>{index + 1}</span>{lesson.name || lesson.title || "Lesson"}
                              </button>
                            </>
                          )}
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : null}
            </aside>

            <main className="builder-workarea">
              {selectedLesson ? (
                <>
                  <div className="lesson-header-editor">
                    <div>
                      <p className="eyebrow">{selectedModule?.name || "Module"}</p>
                      <input className="lesson-title-input" defaultValue={selectedLesson.name || ""} onBlur={(event) => event.target.value.trim() && saveLesson(selectedLesson.id, { name: event.target.value.trim(), title: event.target.value.trim() })} />
                    </div>
                    <div className="lesson-header-actions">
                      <button type="button" onClick={() => duplicateLesson(selectedLesson)}><Copy size={14} />Duplicate</button>
                      <button type="button" className="danger-button" onClick={() => deleteLesson(selectedLesson.id)}><Trash2 size={14} />Delete</button>
                    </div>
                  </div>

                  {previewMode ? (
                    <LessonPreview lesson={selectedLesson} />
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => reorderBlocks(event.active.id, event.over?.id)}>
                      <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                        <div className="lesson-canvas">
                          {blocks.map((block) => (
                            <SortableItem key={block.id} id={block.id} className="builder-block-card">
                              {(listeners) => (
                                <BlockEditor
                                  block={block}
                                  dragListeners={listeners}
                                  onSave={(patch) => saveBlock(block.id, patch)}
                                  onDuplicate={() => duplicateBlock(block)}
                                  onDelete={() => deleteBlock(block.id)}
                                />
                              )}
                            </SortableItem>
                          ))}
                          {!blocks.length ? (
                            <div className="empty-canvas">
                              <Sparkles size={34} />
                              <strong>Build this lesson with blocks</strong>
                              <span>Click a tool on the right to add rich content, quizzes, code, assignments, and completion blocks.</span>
                            </div>
                          ) : null}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </>
              ) : (
                <div className="empty-canvas">
                  <BookOpen size={34} />
                  <strong>Select or create a lesson</strong>
                </div>
              )}
            </main>

            <aside className="builder-tools">
              <div className="builder-pane-head">
                <strong>Tools</strong>
                <span>Click to add</span>
              </div>
              <div className="tool-grid">
                {BLOCK_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button key={tool.type} type="button" className={`tool-card ${tool.color}`} disabled={!selectedLesson} onClick={() => addBlock(tool.type)}>
                      <Icon size={18} />
                      <span>{tool.label}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        </>
      ) : (
        <div className="empty-canvas">
          <BookOpen size={34} />
          <strong>Select a course to start building</strong>
        </div>
      )}
    </div>
  );
}

function BlockEditor({ block, dragListeners, onSave, onDuplicate, onDelete }) {
  const [marks, setMarks] = useState(String(block.marks_weight ?? 10));
  const [payload, setPayload] = useState(block.payload || {});
  const [saveState, setSaveState] = useState("");

  useEffect(() => {
    setMarks(String(block.marks_weight ?? 10));
    setPayload(block.payload || {});
  }, [block.id, block.marks_weight, block.payload]);

  const saveNow = useCallback(async () => {
    setSaveState("Saving...");
    try {
      const saved = await onSave({ marks_weight: Number(marks || 0), payload });
      setSaveState(saved === false ? "Removed" : "Saved");
      window.setTimeout(() => setSaveState(""), 1000);
    } catch (err) {
      setSaveState("Save failed");
      window.setTimeout(() => setSaveState(""), 1800);
    }
  }, [marks, onSave, payload]);

  const updatePayload = (key, value) => setPayload((current) => ({ ...current, [key]: value }));
  const type = block.activity_type;

  return (
    <article>
      <header className="block-card-head">
        <span className="drag-dot" {...dragListeners}><GripVertical size={16} /></span>
        <strong>{blockTitle(type)}</strong>
        <label>XP / marks<input type="number" min="0" max="100" value={marks} onChange={(event) => setMarks(event.target.value)} /></label>
        <span className="autosave-state">{saveState}</span>
        <button type="button" onClick={saveNow}><Save size={14} />Save</button>
        <button type="button" onClick={onDuplicate} title="Duplicate"><Copy size={14} /></button>
        <button type="button" className="danger-button" onClick={onDelete} title="Delete"><Trash2 size={14} /></button>
      </header>
      <div className="block-editor-body">
        <PayloadEditor type={type} payload={payload} setPayload={setPayload} updatePayload={updatePayload} />
      </div>
    </article>
  );
}

function PayloadEditor({ type, payload, setPayload, updatePayload }) {
  if (type === "rich_text" || type === "learn_content") {
    return <RichTextArea value={payload.richText || payload.content || ""} onChange={(value) => setPayload({ ...payload, richText: value, content: value })} />;
  }
  if (type === "image_upload") {
    return (
      <div className="payload-grid">
        {payload.imageUrl ? <img className="builder-image-preview" src={payload.imageUrl.startsWith("data:") ? payload.imageUrl : assetUrl(payload.imageUrl)} alt={payload.alt || "Lesson image"} /> : null}
        <label>Upload image<input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) updatePayload("imageUrl", await fileToDataUrl(file));
        }} /></label>
        <label>Image URL<input value={payload.imageUrl || ""} onChange={(event) => updatePayload("imageUrl", event.target.value)} /></label>
        <label>Alt text<input value={payload.alt || ""} onChange={(event) => updatePayload("alt", event.target.value)} /></label>
        <label>Caption<input value={payload.caption || ""} onChange={(event) => updatePayload("caption", event.target.value)} /></label>
      </div>
    );
  }
  if (type === "code_explanation") {
    return (
      <div className="payload-grid">
        <LanguageSelect value={payload.language} onChange={(value) => updatePayload("language", value)} />
        <label>Explanation<RichTextArea value={payload.explanation || ""} onChange={(value) => updatePayload("explanation", value)} /></label>
        <label>Code<textarea className="code-textarea" value={payload.code || ""} onChange={(event) => updatePayload("code", event.target.value)} /></label>
      </div>
    );
  }
  if (type === "runnable_code" || type === "practice_code" || type === "auto_marked_code") {
    const isWeb = ["html", "css"].includes(payload.language) || payload.language === "javascript";
    return (
      <div className="payload-grid">
        <LanguageSelect value={payload.language} onChange={(value) => updatePayload("language", value)} />
        <label>Instructions<RichTextArea value={payload.instructions || ""} onChange={(value) => updatePayload("instructions", value)} rows={3} /></label>
        {isWeb && type === "runnable_code" ? (
          <div className="web-code-grid">
            <label>HTML<textarea className="code-textarea" value={payload.html || ""} onChange={(event) => updatePayload("html", event.target.value)} /></label>
            <label>CSS<textarea className="code-textarea" value={payload.css || ""} onChange={(event) => updatePayload("css", event.target.value)} /></label>
            <label>JavaScript<textarea className="code-textarea" value={payload.js || ""} onChange={(event) => updatePayload("js", event.target.value)} /></label>
          </div>
        ) : (
          <label>Starter code<textarea className="code-textarea" value={payload.starterCode || ""} onChange={(event) => updatePayload("starterCode", event.target.value)} /></label>
        )}
        {type === "auto_marked_code" ? (
          <>
            <label>Expected output<input value={payload.expectedOutput || ""} onChange={(event) => updatePayload("expectedOutput", event.target.value)} /></label>
            <label>Required keywords, comma separated<input value={(payload.requiredKeywords || []).join(", ")} onChange={(event) => updatePayload("requiredKeywords", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>
          </>
        ) : null}
      </div>
    );
  }
  if (type === "quiz") {
    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    return (
      <div className="quiz-builder-list">
        {questions.map((question, index) => (
          <div className="quiz-question-editor" key={index}>
            <label>Question {index + 1}<textarea value={question.question || ""} onChange={(event) => {
              const next = [...questions];
              next[index] = { ...question, question: event.target.value };
              updatePayload("questions", next);
            }} /></label>
            {(question.options || ["", "", "", ""]).map((option, optionIndex) => (
              <label key={optionIndex}>Option {optionIndex + 1}<input value={option} onChange={(event) => {
                const next = [...questions];
                const options = [...(question.options || ["", "", "", ""])];
                options[optionIndex] = event.target.value;
                next[index] = { ...question, options };
                updatePayload("questions", next);
              }} /></label>
            ))}
            <label>Correct option<select value={question.correctIndex || 0} onChange={(event) => {
              const next = [...questions];
              next[index] = { ...question, correctIndex: Number(event.target.value) };
              updatePayload("questions", next);
            }}>{[0, 1, 2, 3].map((item) => <option key={item} value={item}>Option {item + 1}</option>)}</select></label>
          </div>
        ))}
        <button type="button" onClick={() => updatePayload("questions", [...questions, { question: "", options: ["", "", "", ""], correctIndex: 0 }])}><Plus size={14} />Add question</button>
      </div>
    );
  }
  if (type === "flashcards") {
    const cards = Array.isArray(payload.cards) ? payload.cards : [];
    return (
      <div className="quiz-builder-list">
        {cards.map((card, index) => (
          <div className="flashcard-editor" key={index}>
            <label>Front<input value={card.front || ""} onChange={(event) => {
              const next = [...cards];
              next[index] = { ...card, front: event.target.value };
              updatePayload("cards", next);
            }} /></label>
            <label>Back<textarea value={card.back || ""} onChange={(event) => {
              const next = [...cards];
              next[index] = { ...card, back: event.target.value };
              updatePayload("cards", next);
            }} /></label>
          </div>
        ))}
        <button type="button" onClick={() => updatePayload("cards", [...cards, { front: "", back: "" }])}><Plus size={14} />Add flashcard</button>
      </div>
    );
  }
  if (type === "assignment_submission" || type === "submission") {
    return (
      <div className="payload-grid">
        <label>Instructions<RichTextArea value={payload.instructions || ""} onChange={(value) => updatePayload("instructions", value)} /></label>
        {["allowCode", "allowScreenshot", "allowText", "allowLink", "allowFile"].map((key) => (
          <label className="check-row" key={key}><input type="checkbox" checked={payload[key] !== false} onChange={(event) => updatePayload(key, event.target.checked)} />{key.replace("allow", "Allow ")}</label>
        ))}
      </div>
    );
  }
  if (type === "mark_complete") {
    return (
      <div className="payload-grid">
        <label>Button title<input value={payload.title || ""} onChange={(event) => updatePayload("title", event.target.value)} /></label>
        <label>XP<input type="number" value={payload.xp || 20} onChange={(event) => updatePayload("xp", Number(event.target.value))} /></label>
        <label>Celebration message<RichTextArea value={payload.message || ""} onChange={(value) => updatePayload("message", value)} rows={3} /></label>
      </div>
    );
  }
  return <textarea className="code-textarea" value={JSON.stringify(payload, null, 2)} onChange={(event) => {
    try { setPayload(JSON.parse(event.target.value)); } catch {}
  }} />;
}

function LanguageSelect({ value, onChange }) {
  return (
    <label>Language
      <select value={value || "javascript"} onChange={(event) => onChange(event.target.value)}>
        {LANGUAGE_OPTIONS.map((language) => <option key={language} value={language}>{language.toUpperCase()}</option>)}
      </select>
    </label>
  );
}

function LessonPreview({ lesson }) {
  return (
    <div className="lesson-preview">
      {(lesson.activity_blocks || []).map((block) => (
        <PreviewBlock key={block.id} block={block} />
      ))}
      {!lesson.activity_blocks?.length ? <div className="empty-canvas">No blocks yet.</div> : null}
    </div>
  );
}

function PreviewBlock({ block }) {
  const payload = block.payload || {};
  const [flipped, setFlipped] = useState({});
  const [codeOutput, setCodeOutput] = useState("");
  const type = block.activity_type;

  function runCode() {
    if (payload.language === "javascript") {
      const logs = [];
      try {
        // eslint-disable-next-line no-new-func
        new Function("console", payload.starterCode || payload.js || "")({ log: (...args) => logs.push(args.join(" ")) });
        setCodeOutput(logs.join("\n") || "Code ran successfully.");
      } catch (err) {
        setCodeOutput(err.message);
      }
    } else {
      const code = payload.starterCode || "";
      const match = code.match(/print\((['"])(.*?)\1\)|System\.out\.println\((['"])(.*?)\3\)/);
      setCodeOutput(match ? (match[2] || match[4]) : "Console output preview will appear here.");
    }
  }

  if (type === "rich_text" || type === "learn_content") return <section className="preview-card whitespace" dangerouslySetInnerHTML={{ __html: payload.richText || payload.content || "" }} />;
  if (type === "image_upload") return <section className="preview-card">{payload.imageUrl ? <img src={payload.imageUrl.startsWith("data:") ? payload.imageUrl : assetUrl(payload.imageUrl)} alt={payload.alt || ""} /> : null}<p>{payload.caption}</p></section>;
  if (type === "code_explanation") return <section className="preview-card"><div className="whitespace" dangerouslySetInnerHTML={{ __html: payload.explanation || "" }} /><pre>{payload.code}</pre></section>;
  if (type === "runnable_code" || type === "practice_code" || type === "auto_marked_code") {
    const srcDoc = `<style>${payload.css || ""}</style>${payload.html || ""}<script>${payload.js || ""}<\/script>`;
    return <section className="preview-card"><p className="whitespace">{payload.instructions}</p>{type === "runnable_code" && (payload.html || payload.css || payload.js) ? <iframe title="Live preview" sandbox="allow-scripts" srcDoc={srcDoc} /> : null}<pre>{payload.starterCode || payload.js}</pre><button type="button" onClick={runCode}>Run code</button>{codeOutput ? <output>{codeOutput}</output> : null}</section>;
  }
  if (type === "quiz") return <section className="preview-card"><strong>Quiz</strong>{(payload.questions || []).map((question, index) => <div key={index}><p>{index + 1}. {question.question}</p>{(question.options || []).map((option, optionIndex) => <button type="button" key={optionIndex}>{option}</button>)}</div>)}</section>;
  if (type === "flashcards") return <section className="preview-card flash-preview">{(payload.cards || []).map((card, index) => <button type="button" key={index} onClick={() => setFlipped({ ...flipped, [index]: !flipped[index] })}>{flipped[index] ? card.back : card.front}</button>)}</section>;
  if (type === "assignment_submission") return <section className="preview-card"><p className="whitespace">{payload.instructions}</p><div className="assignment-preview">Code submission · Screenshot upload · Text explanation · Project link · File upload</div></section>;
  if (type === "mark_complete") return <section className="preview-card complete-preview"><CheckCircle2 size={24} /><strong>{payload.title || "Mark complete"}</strong><span>{payload.xp || 20} XP</span></section>;
  return <section className="preview-card">{blockTitle(type)}</section>;
}
