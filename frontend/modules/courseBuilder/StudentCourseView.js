"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Code,
  FileUp,
  Image as ImageIcon,
  Lock,
  Play,
  Sparkles,
  Trophy
} from "lucide-react";
import toast from "react-hot-toast";
import { api, assetUrl } from "../../lib/api";

function flattenLessons(modules) {
  return (modules || []).flatMap((module) => (module.lessons || []).map((lesson) => ({
    ...lesson,
    moduleId: module.id,
    moduleName: module.name || module.title
  })));
}

function itemId(item) {
  return String(item?.id || item || "");
}

function isCompletionBlock(block) {
  return block?.activity_type === "mark_complete";
}

function requiredLessonBlocks(lesson) {
  return (lesson?.activity_blocks || []).filter((block) => !isCompletionBlock(block));
}

function expectationLabel(score, max = 100) {
  const pct = max ? (Number(score || 0) / Number(max)) * 100 : Number(score || 0);
  if (pct <= 50) return "Approaching Expectation";
  if (pct <= 80) return "Meeting Expectation";
  return "Exceeding Expectation";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function runCode(language, code, web = {}) {
  if (language === "javascript") {
    const logs = [];
    try {
      // eslint-disable-next-line no-new-func
      new Function("console", code || web.js || "")({ log: (...args) => logs.push(args.join(" ")) });
      return logs.join("\n") || "Code ran successfully.";
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }
  const source = code || "";
  const match = source.match(/print\((['"])(.*?)\1\)|System\.out\.println\((['"])(.*?)\3\)/);
  return match ? (match[2] || match[4]) : "Console output preview will appear here.";
}

function Celebration({ message, xp, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="absolute h-8 w-6 rounded-full opacity-80"
              style={{
                left: `${(index * 17) % 100}%`,
                bottom: "-20px",
                background: ["#2563eb", "#16a34a", "#f59e0b", "#db2777"][index % 4],
                animation: `float-up ${2.6 + (index % 4) * 0.35}s ease-in infinite`,
                animationDelay: `${index * 0.08}s`
              }}
            />
          ))}
        </div>
        <Trophy className="mx-auto mb-4 text-yellow-500" size={56} />
        <h2 className="text-2xl font-black text-slate-900">Congratulations!</h2>
        <p className="mt-2 whitespace-pre-wrap text-slate-600">{message}</p>
        <strong className="mt-4 block text-lg text-emerald-700">You earned {xp || 20} XP</strong>
        <button type="button" className="mt-6 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white" onClick={onClose}>Continue</button>
      </div>
      <style jsx>{`
        @keyframes float-up {
          from { transform: translateY(0) rotate(0deg); opacity: 0.8; }
          to { transform: translateY(-560px) rotate(24deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function StudentCourseView({ courseId, userId }) {
  const router = useRouter();
  const [blueprint, setBlueprint] = useState(null);
  const [progress, setProgress] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [celebration, setCelebration] = useState(null);
  const [interactedBlockIds, setInteractedBlockIds] = useState(new Set());

  async function load() {
    setLoading(true);
    try {
      const [courseData, progressData] = await Promise.all([
        api.get(`/courses/${courseId}/view`),
        api.get(`/courses/${courseId}/progress/${userId}`)
      ]);
      setBlueprint(courseData);
      setProgress(progressData);
      const lessons = flattenLessons(courseData.modules);
      setActiveLessonId((current) => lessons.some((lesson) => lesson.id === current) ? current : lessons[0]?.id || "");
    } catch (err) {
      setError(err.message || "Failed to load course");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (courseId && userId) load();
  }, [courseId, userId]);

  const modules = blueprint?.modules || [];
  const lessons = useMemo(() => flattenLessons(modules), [modules]);
  const completedLessons = progress?.completed_lessons || [];
  const completedActivities = progress?.completed_activities || [];
  const completedLessonIds = useMemo(() => new Set(completedLessons.map(itemId)), [completedLessons]);
  const completedActivityIds = useMemo(() => new Set(completedActivities.map(itemId)), [completedActivities]);
  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId) || lessons[0] || null;
  const activeIndex = activeLesson ? lessons.findIndex((lesson) => lesson.id === activeLesson.id) : -1;
  const courseProgress = lessons.length ? Math.round((completedLessonIds.size / lessons.length) * 100) : 0;
  const requiredBlocks = useMemo(() => requiredLessonBlocks(activeLesson), [activeLesson]);
  const lessonReady = requiredBlocks.length > 0 && requiredBlocks.every((block) => completedActivityIds.has(itemId(block.id)) || interactedBlockIds.has(itemId(block.id)));
  const activeLessonComplete = completedLessonIds.has(itemId(activeLesson?.id));

  function isLessonUnlocked(index) {
    return index === 0 || completedLessonIds.has(itemId(lessons[index - 1]?.id)) || completedLessonIds.has(itemId(lessons[index]?.id));
  }

  function selectLesson(lesson) {
    const index = lessons.findIndex((item) => item.id === lesson.id);
    if (!isLessonUnlocked(index)) {
      toast.error("Complete the previous lesson to unlock this one.");
      return;
    }
    setActiveLessonId(lesson.id);
  }

  async function refreshProgress() {
    const next = await api.get(`/courses/${courseId}/progress/${userId}`);
    setProgress(next);
    return next;
  }

  function isLessonReadyWith(blocks, completedIds, interactedIds) {
    return blocks.length > 0 && blocks.every((block) => completedIds.has(itemId(block.id)) || interactedIds.has(itemId(block.id)));
  }

  async function markLessonComplete(message, xp, options = {}) {
    if (!activeLesson) return;
    if (!lessonReady && !options.force) {
      toast.error(requiredBlocks.length ? "Interact with every lesson activity before marking complete." : "This lesson needs content before it can be completed.");
      return;
    }
    try {
      await api.post(`/courses/${courseId}/lessons/${activeLesson.id}/complete`, { userId });
      setProgress((current) => ({
        ...(current || {}),
        completed_lessons: Array.from(new Set([...(current?.completed_lessons || []).map(itemId), activeLesson.id])),
        total_score: current?.total_score || progress?.total_score || 0
      }));
      const refreshed = await refreshProgress();
      setProgress((current) => ({
        ...(current || refreshed || {}),
        completed_lessons: Array.from(new Set([...(current?.completed_lessons || refreshed?.completed_lessons || []).map(itemId), activeLesson.id]))
      }));
      if (options.showCelebration !== false) {
        setCelebration({ message: message || "Great work. This lesson is complete.", xp: xp || 20 });
      }
    } catch (err) {
      toast.error(err.message || "Failed to mark complete");
    }
  }

  async function submitBlock(block, payload) {
    const result = await api.post(`/courses/activity-blocks/${block.id}/submit`, { userId, ...payload });
    const blockId = itemId(block.id);
    const nextCompletedActivityIds = new Set(completedActivityIds);
    nextCompletedActivityIds.add(blockId);
    const nextInteractedBlockIds = new Set(interactedBlockIds);
    nextInteractedBlockIds.add(blockId);
    setInteractedBlockIds(nextInteractedBlockIds);
    setProgress((current) => ({
      ...(current || {}),
      completed_activities: Array.from(new Set([...(current?.completed_activities || []).map(itemId), block.id])),
      total_score: result?.total_score ?? current?.total_score ?? progress?.total_score ?? 0
    }));
    await refreshProgress();
    if (!activeLessonComplete && isLessonReadyWith(requiredLessonBlocks(activeLesson), nextCompletedActivityIds, nextInteractedBlockIds)) {
      await markLessonComplete("Great work. You completed this lesson.", 20, { force: true, showCelebration: true });
    }
    return result;
  }

  function markBlockInteracted(blockId) {
    setInteractedBlockIds((current) => new Set([...current, itemId(blockId)]));
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">Loading course...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Celebration message={celebration?.message} xp={celebration?.xp} onClose={() => setCelebration(null)} />
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.back()} className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-lg font-black">{blueprint?.course?.name || "Course"}</h1>
              <p className="text-sm text-slate-500">{courseProgress}% complete · {progress?.total_score || 0} XP</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={load} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">Refresh</button>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-blue-600" style={{ width: `${courseProgress}%` }} />
            </div>
          </div>
        </div>
      </header>

      {error ? <div className="mx-auto mt-4 max-w-7xl rounded-lg bg-red-50 p-4 text-red-700">{error}</div> : null}

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-black">Course modules</h2>
          <div className="grid gap-3">
            {modules.map((module) => {
              const moduleLessons = module.lessons || [];
              const done = moduleLessons.filter((lesson) => completedLessonIds.has(itemId(lesson.id))).length;
              const moduleDone = done === moduleLessons.length && moduleLessons.length > 0;
              return (
                <section key={module.id} className={`rounded-lg border p-3 ${moduleDone ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <strong>{module.name}</strong>
                    <span className="text-xs font-bold text-slate-500">{done}/{moduleLessons.length}</span>
                  </div>
                  <div className="grid gap-2">
                    {moduleLessons.map((lesson) => {
                      const index = lessons.findIndex((item) => item.id === lesson.id);
                      const unlocked = isLessonUnlocked(index);
                      const complete = completedLessonIds.has(itemId(lesson.id));
                      return (
                        <button
                          type="button"
                          key={lesson.id}
                          onClick={() => selectLesson({ ...lesson, moduleId: module.id, moduleName: module.name })}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-bold ${activeLesson?.id === lesson.id ? "border-blue-500 bg-blue-50 text-blue-800" : complete ? "border-emerald-200 bg-white text-emerald-800" : unlocked ? "border-slate-200 bg-white text-slate-700" : "border-slate-200 bg-slate-100 text-slate-400"}`}
                        >
                          {complete ? <CheckCircle size={15} /> : unlocked ? <Play size={15} /> : <Lock size={15} />}
                          <span>{lesson.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white">
          {activeLesson ? (
            <>
              <div className="border-b border-slate-200 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">{activeLesson.moduleName}</p>
                <h2 className="mt-1 text-2xl font-black">{activeLesson.name}</h2>
                {activeLesson.description ? <p className="mt-2 whitespace-pre-wrap text-slate-600">{activeLesson.description}</p> : null}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button type="button" disabled={activeIndex <= 0} onClick={() => selectLesson(lessons[activeIndex - 1])} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 font-bold disabled:opacity-50"><ChevronLeft size={16} />Previous</button>
                  <button type="button" disabled={!lessonReady || activeLessonComplete} title={lessonReady ? "" : "Interact with every lesson activity first"} onClick={() => markLessonComplete("Congratulations. You completed this lesson.", 20)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50"><CheckCircle size={16} />{activeLessonComplete ? "Completed" : "Mark as complete"}</button>
                  <button type="button" disabled={activeIndex >= lessons.length - 1 || !isLessonUnlocked(activeIndex + 1)} onClick={() => selectLesson(lessons[activeIndex + 1])} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 font-bold disabled:opacity-50">Next<ChevronRight size={16} /></button>
                </div>
                {!lessonReady && !activeLessonComplete ? <p className="mt-3 text-sm font-semibold text-slate-500">{requiredBlocks.length ? "Complete or interact with each lesson activity to unlock completion." : "Add lesson activities before this lesson can be completed."}</p> : null}
              </div>
              <div className="grid gap-4 p-5">
                {(activeLesson.activity_blocks || []).map((block) => (
                  <LearnerBlock
                    key={block.id}
                    block={block}
                    completed={completedActivityIds.has(itemId(block.id))}
                    onSubmit={(payload) => submitBlock(block, payload)}
                    onInteract={() => markBlockInteracted(block.id)}
                    interacted={interactedBlockIds.has(itemId(block.id))}
                    lessonReady={lessonReady}
                    onComplete={(message, xp) => markLessonComplete(message, xp)}
                  />
                ))}
                {!activeLesson.activity_blocks?.length ? <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">No lesson blocks yet.</div> : null}
              </div>
            </>
          ) : (
            <div className="grid min-h-[420px] place-items-center text-slate-500">Select a lesson.</div>
          )}
        </section>
      </main>
    </div>
  );
}

function LearnerBlock({ block, completed, interacted, lessonReady, onSubmit, onInteract, onComplete }) {
  const payload = block.payload || {};
  const type = block.activity_type;

  if (type === "rich_text" || type === "learn_content") {
    return <article className="rounded-xl border border-slate-200 p-5"><div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: payload.richText || payload.content || "" }} /><button type="button" onClick={() => onSubmit({ submission: { interaction: "read" } })} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white">{completed || interacted ? "Content read" : "I have read this"}</button></article>;
  }

  if (type === "image_upload") {
    const src = payload.imageUrl || payload.image_url;
    return <article className="rounded-xl border border-slate-200 p-5">{src ? <img className="max-h-96 w-full rounded-lg object-contain" src={String(src).startsWith("data:") ? src : assetUrl(src)} alt={payload.alt || ""} /> : <ImageIcon />}{payload.caption ? <p className="mt-2 text-center text-slate-600">{payload.caption}</p> : null}<button type="button" onClick={() => onSubmit({ submission: { interaction: "viewed_image" } })} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white">{completed || interacted ? "Image viewed" : "I have viewed this"}</button></article>;
  }

  if (type === "code_explanation") {
    return <article className="rounded-xl border border-slate-200 p-5"><div className="mb-3 whitespace-pre-wrap text-slate-700" dangerouslySetInnerHTML={{ __html: payload.explanation || "" }} /><pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-slate-100">{payload.code}</pre><button type="button" onClick={() => onSubmit({ submission: { interaction: "reviewed_explanation" } })} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white">{completed || interacted ? "Explanation reviewed" : "I reviewed this"}</button></article>;
  }

  if (["runnable_code", "practice_code", "auto_marked_code", "practice"].includes(type)) {
    return <CodeRunner block={block} completed={completed} onSubmit={onSubmit} />;
  }

  if (type === "quiz") {
    return <QuizBlock block={block} completed={completed} onSubmit={onSubmit} />;
  }

  if (type === "flashcards") {
    return <Flashcards cards={payload.cards || []} completed={completed || interacted} onComplete={() => onSubmit({ submission: { interaction: "flipped_flashcards" } })} />;
  }

  if (type === "assignment_submission" || type === "submission") {
    return <AssignmentBlock block={block} completed={completed} onSubmit={onSubmit} />;
  }

  if (type === "mark_complete") {
    return (
      <article className="grid justify-items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <Sparkles className="text-emerald-600" size={32} />
        <h3 className="text-xl font-black">{payload.title || "Finish lesson"}</h3>
        <p className="whitespace-pre-wrap text-slate-600">{payload.message}</p>
        <button type="button" disabled={!lessonReady} onClick={() => onComplete(payload.message, payload.xp)} className="rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white disabled:opacity-50">Complete and earn {payload.xp || 20} XP</button>
        {!lessonReady ? <span className="text-sm font-semibold text-emerald-800">Finish the lesson activities first.</span> : null}
      </article>
    );
  }

  return <article className="rounded-xl border border-slate-200 p-5">{type}</article>;
}

function CodeRunner({ block, completed, onSubmit }) {
  const payload = block.payload || {};
  const language = payload.language || "javascript";
  const initialCode = payload.starterCode || payload.code || payload.js || "";
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState("");
  const [result, setResult] = useState(null);
  const isWeb = block.activity_type === "runnable_code" && (payload.html || payload.css || payload.js);
  const srcDoc = `<style>${payload.css || ""}</style>${payload.html || ""}<script>${payload.js || code || ""}<\/script>`;

  function run() {
    setOutput(runCode(language, code, payload));
  }

  async function submit() {
    const runOutput = output || runCode(language, code, payload);
    setOutput(runOutput);
    const saved = await onSubmit({ submission: { code, output: runOutput } });
    setResult(saved);
  }

  return (
    <article className="grid gap-4 rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2"><Code size={18} /><strong>{block.activity_type === "auto_marked_code" ? "Auto-marked coding task" : "Code activity"}</strong></div>
      <p className="whitespace-pre-wrap text-slate-600">{payload.instructions}</p>
      {isWeb ? <iframe title="Live preview" sandbox="allow-scripts" srcDoc={srcDoc} className="min-h-60 w-full rounded-lg border border-slate-200" /> : null}
      <textarea className="min-h-44 rounded-lg border border-slate-300 bg-slate-950 p-4 font-mono text-sm text-slate-100" value={code} onChange={(event) => setCode(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={run} className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white">Run code</button>
        <button type="button" onClick={submit} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white">{completed ? "Resubmit" : "Submit"}</button>
      </div>
      {output ? <pre className="rounded-lg bg-slate-100 p-4 text-sm text-slate-800">{output}</pre> : null}
      {result ? <p className="font-bold text-emerald-700">Score: {result.score}. {result.expectation || expectationLabel(result.score, block.marks_weight)}</p> : null}
    </article>
  );
}

function QuizBlock({ block, completed, onSubmit }) {
  const questions = block.payload?.questions || [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const question = questions[index];
  if (!question) return <article className="rounded-xl border border-slate-200 p-5">No quiz questions yet.</article>;

  async function finish() {
    if (questions.some((item, questionIndex) => answers[item.id || questionIndex] === undefined)) {
      toast.error("Answer every quiz question before submitting.");
      return;
    }
    const saved = await onSubmit({ answer: { answers } });
    setResult(saved);
  }

  return (
    <article className="grid gap-4 rounded-xl border border-purple-200 bg-purple-50 p-5">
      <strong>Question {index + 1} of {questions.length}</strong>
      <p className="text-lg font-bold">{question.question}</p>
      <div className="grid gap-2">
        {(question.options || []).map((option, optionIndex) => (
          <button key={optionIndex} type="button" onClick={() => setAnswers({ ...answers, [question.id || index]: optionIndex })} className={`rounded-lg border px-4 py-3 text-left font-bold ${answers[question.id || index] === optionIndex ? "border-purple-600 bg-white text-purple-800" : "border-purple-200 bg-white"}`}>{option}</button>
        ))}
      </div>
      <div className="flex justify-between">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-lg bg-white px-3 py-2 font-bold disabled:opacity-50">Previous</button>
        {index < questions.length - 1 ? <button type="button" onClick={() => setIndex(index + 1)} className="rounded-lg bg-purple-600 px-3 py-2 font-bold text-white">Next</button> : <button type="button" onClick={finish} className="rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white">{completed ? "Resubmit quiz" : "Submit quiz"}</button>}
      </div>
      {result ? <p className="font-bold text-emerald-700">Score: {result.score}. {result.expectation}</p> : null}
    </article>
  );
}

function Flashcards({ cards, completed, onComplete }) {
  const [flipped, setFlipped] = useState({});
  function flip(index) {
    const next = { ...flipped, [index]: !flipped[index] };
    setFlipped(next);
    if (cards.length && cards.every((_, cardIndex) => next[cardIndex])) {
      onComplete?.();
    }
  }
  return (
    <article className="grid gap-3 rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-3"><strong>Flashcards</strong>{completed ? <span className="text-sm font-bold text-emerald-700">All cards flipped</span> : null}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map((card, index) => (
          <button key={index} type="button" onClick={() => flip(index)} className="min-h-32 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center font-bold">
            {flipped[index] ? card.back : card.front}
          </button>
        ))}
      </div>
    </article>
  );
}

function AssignmentBlock({ block, completed, onSubmit }) {
  const payload = block.payload || {};
  const [form, setForm] = useState({ code: "", text: "", link: "", screenshot: "", file: "", fileName: "" });
  const [message, setMessage] = useState("");

  async function submit() {
    const saved = await onSubmit({ submission: form });
    setMessage(`Submitted. ${saved.expectation || ""}`);
  }

  return (
    <article className="grid gap-4 rounded-xl border border-orange-200 bg-orange-50 p-5">
      <div className="flex items-center gap-2"><FileUp size={18} /><strong>Assignment submission</strong></div>
      <p className="whitespace-pre-wrap text-slate-700">{payload.instructions}</p>
      {payload.allowCode !== false ? <label className="grid gap-1 font-bold">Code submission<textarea className="min-h-32 rounded-lg border border-orange-200 p-3 font-mono" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label> : null}
      {payload.allowText !== false ? <label className="grid gap-1 font-bold">Text explanation<textarea className="rounded-lg border border-orange-200 p-3" value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} /></label> : null}
      {payload.allowLink !== false ? <label className="grid gap-1 font-bold">Project link<input className="rounded-lg border border-orange-200 p-3" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} /></label> : null}
      {payload.allowScreenshot !== false ? <label className="grid gap-1 font-bold">Screenshot upload<input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (file) setForm({ ...form, screenshot: await fileToDataUrl(file) });
      }} /></label> : null}
      {payload.allowFile !== false ? <label className="grid gap-1 font-bold">File upload<input type="file" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (file) setForm({ ...form, file: await fileToDataUrl(file), fileName: file.name });
      }} /></label> : null}
      <button type="button" onClick={submit} className="rounded-lg bg-orange-600 px-4 py-2 font-bold text-white">{completed ? "Resubmit assignment" : "Submit assignment"}</button>
      {message ? <p className="font-bold text-emerald-700">{message}</p> : null}
    </article>
  );
}
