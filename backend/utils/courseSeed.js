const COURSE_CATALOG = [
  ["Computer skills", "Build confidence with files, typing, documents, presentations, and safe internet habits.", true],
  ["Robotics", "Explore sensors, motors, logic, and playful problem-solving with robots.", true],
  ["Web development", "Create websites step by step with HTML, CSS, JavaScript, practice code, quizzes, and creative projects.", false],
  ["Android apps development", "Design and build simple mobile app ideas.", true],
  ["Introduction to scratch", "Learn coding blocks, sprites, loops, and stories in Scratch.", true],
  ["Advanced scratch", "Build richer Scratch games with variables, messages, and polished interactions.", true],
  ["AI and Machine Learning", "Understand smart systems, data examples, and responsible AI basics.", true],
  ["Data analysis", "Collect, clean, chart, and explain data with beginner-friendly tools.", true]
];

const { ensureCourseColumns } = require("./schemaGuard");

const WEB_MODULES = [
  ["Web Builders' Toolkit", ["Meet the web page", "HTML tags and text", "Saving and previewing your first page"]],
  ["Text, Links, and Images", ["Headings and paragraphs", "Links that move around", "Images with helpful descriptions"]],
  ["Page Structure", ["Lists and sections", "Cards and containers", "Build a mini profile page"]],
  ["CSS First Steps", ["Colors and fonts", "Spacing and borders", "Make a page feel neat"]],
  ["Layouts", ["Rows and columns", "Responsive thinking", "Build a simple gallery"]],
  ["JavaScript Basics", ["Buttons and alerts", "Variables and text", "Change the page with code"]],
  ["Interactive Pages", ["Inputs and forms", "If statements", "Mini calculator challenge"]],
  ["Creative Project Lab", ["Plan a website idea", "Build a themed page", "Polish and present"]],
  ["Debugging and Quality", ["Find code mistakes", "Accessibility basics", "Make it work on small screens"]],
  ["Launch Week", ["Combine pages", "Final quiz practice", "Publish-ready showcase"]]
];

function lessonPayload(moduleName, lessonName, moduleIndex, lessonIndex) {
  const safeTitle = lessonName.replace(/"/g, "&quot;");
  const code = `<!doctype html>
<html>
  <head>
    <title>${safeTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; background: #f5fbff; color: #172033; }
      .card { background: white; border: 1px solid #d8e6f3; border-radius: 8px; padding: 16px; }
      button { background: #2367d1; color: white; border: 0; border-radius: 6px; padding: 8px 12px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${safeTitle}</h1>
      <p>Edit this page and watch your idea grow.</p>
      <button onclick="document.querySelector('p').textContent='I made my page interactive!'">Try me</button>
    </div>
  </body>
</html>`;
  return {
    content: `${lessonName} introduces one small web idea at a time. Read the example, notice the tags, then change one thing and preview it. Keep your code tidy and explain what each part does in your own words.`,
    learning_notes: `In ${moduleName}, this lesson focuses on ${lessonName.toLowerCase()}. Start with the visible result, then connect it to the code. A web page is built from structure, style, and small interactions.`,
    practice_prompt: "Re-type the sample, then change the heading, one color, and one sentence. Preview after each small change.",
    starter_code: code,
    homework_prompt: "At home, make a tiny page about something you enjoy. Add a heading, a short paragraph, and one style change.",
    creativity_prompt: "Create a page that feels like you: a hobby, game idea, club poster, family recipe, or dream invention.",
    quiz: [
      { question: "What file type is commonly used for a web page?", options: ["HTML", "MP3", "ZIP", "PNG"], answer: "HTML" },
      { question: "Which part usually changes how a page looks?", options: ["CSS", "Battery", "Folder", "Speaker"], answer: "CSS" },
      { question: "Why should we preview our code often?", options: ["To catch mistakes early", "To delete it", "To hide it", "To make it slower"], answer: "To catch mistakes early" },
      { question: "What should good code be?", options: ["Clear and tested", "Random", "Hidden", "Always copied"], answer: "Clear and tested" },
      { question: "What is a good creative project habit?", options: ["Build bit by bit", "Wait until the end", "Never test", "Ignore errors"], answer: "Build bit by bit" }
    ],
    xp_points: 20 + moduleIndex + lessonIndex
  };
}

async function ensureDefaultCourses(db) {
  await ensureCourseColumns(db);
  for (const [name, objectives, comingSoon] of COURSE_CATALOG) {
    const existing = (await db.query("select id from courses where lower(coalesce(name, title)) = lower($1) and deleted_at is null limit 1", [name])).rows[0];
    if (existing) {
      await db.query(
        `update courses
       set title = coalesce(title, name), description = coalesce(description, objectives),
           status = 'published', is_published = true, is_coming_soon = $2,
           published_at = coalesce(published_at, now())
       where id = $1`,
        [existing.id, comingSoon]
      );
    } else {
      await db.query(
        `insert into courses (title, name, description, objectives, club, status, is_published, is_coming_soon, published_at)
         values ($1, $1, $2, $2, 'Computer Club', 'published', true, $3, now())`,
        [name, objectives, comingSoon]
      );
    }
  }

  const course = (await db.query("select id from courses where lower(coalesce(name, title)) = lower('Web development') limit 1")).rows[0];
  if (!course) return;

  for (let moduleIndex = 0; moduleIndex < WEB_MODULES.length; moduleIndex += 1) {
    const [moduleName, lessons] = WEB_MODULES[moduleIndex];
    const module = (await db.query(
      `insert into modules (course_id, title, name, description, objectives, sort_order, pass_threshold, badge_name, xp_points)
       values ($1, $2, $2, $3, $3, $4, 60, $5, $6)
       on conflict (course_id, sort_order) do update set
         title = excluded.title, name = excluded.name, description = excluded.description,
         objectives = excluded.objectives, badge_name = excluded.badge_name, xp_points = excluded.xp_points
       returning id`,
      [course.id, moduleName, `Learners practise ${moduleName.toLowerCase()} through reading, live code, home tasks, creativity, and a quiz.`, moduleIndex + 1, `${moduleName} badge`, 50 + moduleIndex * 5]
    )).rows[0];

    for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
      const lessonName = lessons[lessonIndex];
      const payload = lessonPayload(moduleName, lessonName, moduleIndex, lessonIndex);
      await db.query(
        `insert into lessons (
           module_id, title, name, description, content, example, sort_order, learning_notes, practice_prompt,
           starter_code, homework_prompt, creativity_prompt, quiz, xp_points
         )
         values ($1, $2, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
         on conflict (module_id, sort_order) do update set
           title = excluded.title,
           name = excluded.name,
           description = excluded.description,
           content = excluded.content,
           example = excluded.example,
           learning_notes = excluded.learning_notes,
           practice_prompt = excluded.practice_prompt,
           starter_code = excluded.starter_code,
           homework_prompt = excluded.homework_prompt,
           creativity_prompt = excluded.creativity_prompt,
           quiz = excluded.quiz,
           xp_points = excluded.xp_points`,
        [
          module.id,
          lessonName,
          payload.content,
          JSON.stringify({ notes: payload.content }),
          payload.starter_code,
          lessonIndex + 1,
          payload.learning_notes,
          payload.practice_prompt,
          payload.starter_code,
          payload.homework_prompt,
          payload.creativity_prompt,
          JSON.stringify(payload.quiz),
          payload.xp_points
        ]
      );
    }
  }
}

module.exports = { ensureDefaultCourses, COURSE_CATALOG };
