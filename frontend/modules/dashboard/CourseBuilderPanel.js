"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import { GripVertical, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../lib/api";
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

const ACTIVITY_LABELS = {
  learn_content: "Learn content",
  practice: "Practice task",
  creative_corner: "Creative corner",
  teacher_task: "Teacher class task",
  quiz: "Quiz (auto-mark)",
  submission: "Submission task"
};

function sumLessonMarks(lesson) {
  const blocks = lesson?.activity_blocks || [];
  return blocks.reduce((acc, b) => acc + Number(b.marks_weight || 0), 0);
}

function SortableRow({ id, children, className }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1
  };
  return (
    <div ref={setNodeRef} style={style} className={className} {...attributes}>
      {children(listeners)}
    </div>
  );
}

export default function CourseBuilderPanel({ courses, onPublished }) {
  const [courseId, setCourseId] = useState("");
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState({});
  const [expanded, setExpanded] = useState(() => new Set());
  const [activityTypes, setActivityTypes] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedCourseOptions = useMemo(
    () => [...(courses || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [courses]
  );

  const loadBlueprint = useCallback(async (id) => {
    if (!id) {
      setBlueprint(null);
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
    } catch (err) {
      setError(err.message);
      setBlueprint(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .get("/courses/meta/activity-types")
      .then((r) => setActivityTypes(r.types || []))
      .catch(() => setActivityTypes(Object.keys(ACTIVITY_LABELS)));
  }, []);

  useEffect(() => {
    loadBlueprint(courseId);
  }, [courseId, loadBlueprint]);

  useEffect(() => {
    if (!blueprint?.modules?.length) return;
    setExpanded((prev) => (prev.size ? prev : new Set([blueprint.modules[0].id])));
  }, [blueprint]);

  async function saveCourseMeta() {
    if (!courseId) return;
    setError("");
    try {
      const data = await api.patch(`/courses/${courseId}/builder`, meta);
      setBlueprint(data);
      onPublished?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function publishCourse(published) {
    if (!courseId) return;
    setError("");
    try {
      await api.patch(`/courses/${courseId}/publish`, { is_published: published });
      await loadBlueprint(courseId);
      onPublished?.();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function reorderModules(activeId, overId) {
    if (!blueprint || !overId || activeId === overId) return;
    const mods = blueprint.modules || [];
    const oldIndex = mods.findIndex((m) => m.id === activeId);
    const newIndex = mods.findIndex((m) => m.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(mods, oldIndex, newIndex);
    await api.patch(`/courses/${courseId}/modules/reorder`, { ordered_ids: next.map((m) => m.id) });
    await loadBlueprint(courseId);
  }

  async function reorderLessons(moduleId, activeId, overId) {
    const mod = blueprint.modules.find((m) => m.id === moduleId);
    if (!mod || !overId || activeId === overId) return;
    const lessons = mod.lessons || [];
    const oldIndex = lessons.findIndex((l) => l.id === activeId);
    const newIndex = lessons.findIndex((l) => l.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(lessons, oldIndex, newIndex);
    await api.patch(`/courses/modules/${moduleId}/lessons/reorder`, { ordered_ids: next.map((l) => l.id) });
    await loadBlueprint(courseId);
  }

  async function reorderBlocks(lessonId, activeId, overId) {
    const lesson = blueprint.modules.flatMap((m) => m.lessons || []).find((l) => l.id === lessonId);
    if (!lesson || !overId || activeId === overId) return;
    const blocks = lesson.activity_blocks || [];
    const oldIndex = blocks.findIndex((b) => b.id === activeId);
    const newIndex = blocks.findIndex((b) => b.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(blocks, oldIndex, newIndex);
    await api.patch(`/courses/lessons/${lessonId}/activity-blocks/reorder`, { ordered_ids: next.map((b) => b.id) });
    await loadBlueprint(courseId);
  }

  async function addModule() {
    if (!courseId) return;
    await api.post(`/courses/${courseId}/modules`, { title: "New module" });
    await loadBlueprint(courseId);
  }

  async function addLesson(moduleId) {
    await api.post(`/courses/modules/${moduleId}/lessons`, { title: "New lesson" });
    await loadBlueprint(courseId);
    setExpanded((s) => new Set(s).add(moduleId));
  }

  async function addBlock(lessonId, type) {
    await api.post(`/courses/lessons/${lessonId}/activity-blocks`, {
      activity_type: type,
      marks_weight: 10,
      payload: {}
    });
    await loadBlueprint(courseId);
  }

  async function saveModuleTitle(moduleId, name) {
    await api.patch(`/courses/modules/${moduleId}`, { name, title: name });
    await loadBlueprint(courseId);
  }

  async function saveLessonTitle(lessonId, name) {
    await api.patch(`/courses/lessons/${lessonId}`, { name, title: name });
    await loadBlueprint(courseId);
  }

  async function deleteModule(moduleId) {
    if (!window.confirm("Delete this module and all lessons inside it?")) return;
    await api.delete(`/courses/modules/${moduleId}`);
    await loadBlueprint(courseId);
  }

  async function deleteLesson(lessonId) {
    if (!window.confirm("Delete this lesson and its activities?")) return;
    await api.delete(`/courses/lessons/${lessonId}`);
    await loadBlueprint(courseId);
  }

  async function deleteBlock(blockId) {
    if (!window.confirm("Delete this activity block?")) return;
    await api.delete(`/courses/activity-blocks/${blockId}`);
    await loadBlueprint(courseId);
  }

  async function saveBlock(block, rawPayload) {
    let payload = block.payload;
    if (rawPayload !== undefined) {
      try {
        payload = JSON.parse(rawPayload || "{}");
      } catch {
        setError("Activity payload must be valid JSON");
        return;
      }
    }
    await api.patch(`/courses/activity-blocks/${block.id}`, {
      marks_weight: Number(block.marks_weight),
      payload
    });
    setError("");
    await loadBlueprint(courseId);
  }

  const modules = blueprint?.modules || [];

  return (
    <div className="course-builder">
      <div className="course-builder-toolbar">
        <label>
          Course from catalogue
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Select a course…</option>
            {sortedCourseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {loading ? <div className="loading-block">Loading course builder…</div> : null}

      {blueprint && courseId ? (
        <>
          <section className="course-builder-meta">
            <h3 style={{ margin: 0 }}>Course details</h3>
            <div className="course-builder-meta-grid">
              <label>
                Title
                <input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value, name: e.target.value })} />
              </label>
              <label>
                Short description
                <input value={meta.short_description} onChange={(e) => setMeta({ ...meta, short_description: e.target.value })} />
              </label>
              <label>
                Target age / level
                <input value={meta.target_level} onChange={(e) => setMeta({ ...meta, target_level: e.target.value })} placeholder="e.g. Ages 10–12, Grade 6" />
              </label>
              <label>
                Technology
                <select value={meta.technology} onChange={(e) => setMeta({ ...meta, technology: e.target.value })}>
                  {TECH_OPTIONS.map((o) => (
                    <option key={o.value || "empty"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published (metadata only — use Publish button for live)</option>
                </select>
              </label>
              <label>
                Cover image URL
                <input value={meta.cover_image_url} onChange={(e) => setMeta({ ...meta, cover_image_url: e.target.value })} placeholder="https://…" />
              </label>
            </div>
            <label>
              Full description
              <textarea value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
            </label>
            <label>
              Objectives
              <textarea value={meta.objectives} onChange={(e) => setMeta({ ...meta, objectives: e.target.value })} />
            </label>
            <div className="course-builder-actions">
              <button type="button" onClick={saveCourseMeta}>
                Save course details
              </button>
              <button type="button" className="secondary-button" onClick={() => publishCourse(true)}>
                Publish course (live)
              </button>
              <button type="button" className="secondary-button" onClick={() => publishCourse(false)}>
                Unpublish
              </button>
            </div>
          </section>

          <section className="panel compact-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>Modules → Lessons → Activities</h3>
              <button type="button" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={addModule}>
                <Plus size={16} /> Add module
              </button>
            </div>
            <p className="eyebrow" style={{ marginTop: 6 }}>
              Drag modules, lessons, and activity blocks to reorder. Each lesson&apos;s activity marks should total 100 when you are ready to go live.
            </p>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => reorderModules(e.active.id, e.over?.id)}>
              <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                {modules.map((module) => (
                  <SortableRow key={module.id} id={module.id} className="course-builder-module">
                    {(listeners) => (
                      <>
                        <div className="course-builder-module-head">
                          <button type="button" className="course-builder-drag-handle" {...listeners} aria-label="Drag module">
                            <GripVertical size={18} />
                          </button>
                          <button type="button" className="link-button" onClick={() => toggleExpand(module.id)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {expanded.has(module.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <input
                            defaultValue={module.name}
                            key={`${module.id}-name`}
                            onBlur={(ev) => {
                              const v = ev.target.value.trim();
                              if (v && v !== module.name) saveModuleTitle(module.id, v);
                            }}
                          />
                          <button type="button" className="danger-button" onClick={() => deleteModule(module.id)} title="Delete module">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        {expanded.has(module.id) ? (
                          <div className="course-builder-module-body">
                            <div style={{ marginBottom: 8 }}>
                              <button type="button" onClick={() => addLesson(module.id)}>
                                <Plus size={14} /> Add lesson
                              </button>
                            </div>
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(ev) => reorderLessons(module.id, ev.active.id, ev.over?.id)}
                            >
                              <SortableContext items={(module.lessons || []).map((l) => l.id)} strategy={verticalListSortingStrategy}>
                                {(module.lessons || []).map((lesson) => {
                                  const markSum = sumLessonMarks(lesson);
                                  const markOk = (lesson.activity_blocks || []).length === 0 || Math.abs(markSum - 100) < 0.05;
                                  return (
                                    <SortableRow key={lesson.id} id={lesson.id} className="course-builder-lesson">
                                      {(lListeners) => (
                                        <>
                                          <div className="course-builder-lesson-head">
                                            <span className="course-builder-drag-handle" {...lListeners}>
                                              <GripVertical size={16} />
                                            </span>
                                            <input
                                              defaultValue={lesson.name}
                                              key={`${lesson.id}-ln`}
                                              onBlur={(ev) => {
                                                const v = ev.target.value.trim();
                                                if (v && v !== lesson.name) saveLessonTitle(lesson.id, v);
                                              }}
                                            />
                                            <span className={`course-builder-marks-hint ${markOk ? "ok" : "warn"}`}>Σ marks {markSum.toFixed(1)}</span>
                                            <button type="button" className="danger-button" onClick={() => deleteLesson(lesson.id)}>
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                          <div className="course-builder-lesson-body">
                                            <DndContext
                                              sensors={sensors}
                                              collisionDetection={closestCenter}
                                              onDragEnd={(ev) => reorderBlocks(lesson.id, ev.active.id, ev.over?.id)}
                                            >
                                              <SortableContext items={(lesson.activity_blocks || []).map((b) => b.id)} strategy={verticalListSortingStrategy}>
                                                {(lesson.activity_blocks || []).map((block) => (
                                                  <BlockEditor
                                                    key={block.id}
                                                    block={block}
                                                    activityTypes={activityTypes.length ? activityTypes : Object.keys(ACTIVITY_LABELS)}
                                                    onSave={saveBlock}
                                                    onDelete={deleteBlock}
                                                  />
                                                ))}
                                              </SortableContext>
                                            </DndContext>
                                            <div className="course-builder-mini-actions">
                                              <label>
                                                Add activity
                                                <select
                                                  defaultValue=""
                                                  onChange={(e) => {
                                                    const t = e.target.value;
                                                    e.target.value = "";
                                                    if (t) addBlock(lesson.id, t);
                                                  }}
                                                >
                                                  <option value="">Choose type…</option>
                                                  {(activityTypes.length ? activityTypes : Object.keys(ACTIVITY_LABELS)).map((t) => (
                                                    <option key={t} value={t}>
                                                      {ACTIVITY_LABELS[t] || t}
                                                    </option>
                                                  ))}
                                                </select>
                                              </label>
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </SortableRow>
                                  );
                                })}
                              </SortableContext>
                            </DndContext>
                          </div>
                        ) : null}
                      </>
                    )}
                  </SortableRow>
                ))}
              </SortableContext>
            </DndContext>
          </section>
        </>
      ) : null}
    </div>
  );
}

function BlockEditor({ block, activityTypes, onSave, onDelete }) {
  const [marks, setMarks] = useState(String(block.marks_weight ?? 0));
  const [payloadText, setPayloadText] = useState(JSON.stringify(block.payload || {}, null, 2));

  useEffect(() => {
    setMarks(String(block.marks_weight ?? 0));
    setPayloadText(JSON.stringify(block.payload || {}, null, 2));
  }, [block.id, block.marks_weight, block.payload]);

  return (
    <SortableRow id={block.id} className="course-builder-block">
      {(listeners) => (
        <>
          <div className="course-builder-block-head">
            <span className="course-builder-drag-handle" {...listeners}>
              <GripVertical size={16} />
            </span>
            <strong>{ACTIVITY_LABELS[block.activity_type] || block.activity_type}</strong>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Marks
              <input type="number" min={0} max={100} step={0.5} value={marks} onChange={(e) => setMarks(e.target.value)} />
            </label>
            <button type="button" onClick={() => onSave({ ...block, marks_weight: Number(marks) }, payloadText)}>
              Save block
            </button>
            <button type="button" className="danger" onClick={() => onDelete(block.id)}>
              <Trash2 size={14} />
            </button>
          </div>
          <textarea className="course-builder-json" value={payloadText} onChange={(e) => setPayloadText(e.target.value)} spellCheck={false} />
        </>
      )}
    </SortableRow>
  );
}
