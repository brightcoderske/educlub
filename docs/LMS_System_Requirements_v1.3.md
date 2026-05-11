# EduClub LMS — System Requirements Document
**Version:** 1.3  
**Scope:** Co-Curricular Activities Learning Management System (Web App / PWA)  
**Primary Focus:** Computer Club (extensible to Chess, Music, Taekwondo, etc.)

---

## 0. Problem Statement

### 0.1 The Problem

Schools running co-curricular programmes — particularly technology and computer clubs — face three interconnected challenges:

**Curriculum delivery without structure.** Instructors often rely on loose, untracked lesson plans that vary by teacher, lack measurable outcomes, and do not build progressively on prior knowledge. There is no consistent framework ensuring every learner meets the same learning objectives.

**Inefficient administration.** Managing learner enrolment, tracking individual progress across multiple classes and courses, collecting assignments, and giving feedback is manual and fragmented. School admins spend disproportionate time on logistics rather than instruction.

**Weak and inconsistent reporting.** Parents and school leadership receive little to no formal evidence of a child's progress in co-curricular activities. Report cards — where they exist — are manually compiled, error-prone, inconsistent across schools, and not data-driven.

### 0.2 What EduClub Solves

| Problem | Solution |
|---|---|
| Unstructured curriculum delivery | Standardised, module-based courses with defined objectives, auto-sequenced lessons, and measurable outcomes at every level |
| Varied learner experience | Every learner follows the same curriculum path with consistent content, examples, and assessments — regardless of instructor |
| Manual progress tracking | Real-time, auto-calculated progress per lesson, module, and course — visible to learner, teacher, and admin |
| Poor reporting | Auto-generated, data-driven report cards scoped per term — available individually or in bulk |
| Typing and foundational skills gap | Structured typing assessment on enrolment to baseline digital readiness and track improvement |
| Assessment fragmentation | Centralised quiz pool system allowing standardised assessments across classes and schools |
| Parent disconnect | Parent-facing report cards and email notifications keeping families informed without extra admin work |
| Lost progress across terms | Persistent course progress tied to the learner — not the term — so children continue exactly where they left off |
| Club growth visibility | Term-on-term enrolment comparison to track whether the club is growing |

---

## 1. System Overview

EduClub is a Progressive Web App (PWA) — installable on phones and desktops — that manages co-curricular club courses for schools. It operates on an **academic calendar** of years and terms (3 terms per year). Enrolment is term-based; course progress is persistent across terms. The system supports gamified, child-friendly learning with structured assessments, school-level administration, centralised quiz pools, typing assessments, leaderboards, and automated term-scoped report card generation.

---

## 2. Academic Calendar & Term System

### 2.1 Structure

```
Academic Year (e.g., 2026)
 ├── Term 1
 ├── Term 2
 └── Term 3
```

- The system maintains a single **Active Term** at any time per school.
- System Admin is only one who can define and activate terms.
- All enrolments, quizzes, typing tests, and report cards are **scoped to a term**.
- Course **progress** (lessons completed, module scores) is tied to the **learner** and persists across terms regardless of enrolment scope.

### 2.2 Academic Calendar Management
| Who | Action |
|---|---|
| System Admin | Create academic years system-wide; set term date ranges globally |
| School Admin | Activate a term for their school; view term history |

### 2.3 Active Term Indicator
- All dashboards (admin and student) display the current **Year + Term** prominently (e.g., "2026 — Term 2").
- Historical terms are accessible in read-only view for reference and reporting.

---

## 3. Term-Based Enrolment

### 3.1 Enrolment Model
- Enrolment is **per learner, per course, per term**.
- When a new term begins, the previous term's enrolments do **not** automatically carry forward — the school admin manages the new cohort deliberately.
- Course progress data is **never deleted** — it lives on the learner's profile permanently.

### 3.2 New Term Enrolment Workflow (School Admin)

```
Start New Term
 │
 ├─ 1. Pull learners from previous term (one-click import of last term's cohort)
 │
 ├─ 2. Remove opted-out learners (deselect / mark as inactive for this term)
 │
 ├─ 3. Add new learners (manual or Excel upload)
 │
 ├─ 4. Allocate courses per learner / class (bulk or individual)
 │       ├─ Returning learner + same course → system resumes from last saved progress
 │       ├─ Returning learner + new course → starts fresh on new course
 │       └─ New learner → starts course from Module 1, Lesson 1
 │
 └─ 5. Publish / open Term — learners can now access their dashboard
```

### 3.3 Course Continuity Rules
| Scenario | Behaviour |
|---|---|
| Returning learner, same course re-allocated | Resumes from exact lesson/module last completed; prior scores preserved and visible |
| Returning learner, new course allocated | Starts new course from beginning; prior course history still accessible in their profile |
| New learner joining mid-term or new term | Starts from Module 1, Lesson 1; no penalty; progresses at own pace |
| Learner not re-enrolled in new term | Account remains; history preserved; no active courses shown until re-enrolled |

### 3.4 Club Growth Indicator
- On the School Admin dashboard, whenever a new term is opened, a **subtle growth card** shows:
  - Last term enrolment count vs current term enrolment count
  - Difference (▲ or ▼) with percentage change
  - Visual mini-chart of enrolment trend across all terms in the current year
- This is also visible on the System Admin dashboard per school and across all schools.

---

## 4. User Roles & Permissions

### 4.1 System Admin (Super Admin)
| Capability | Detail |
|---|---|
| Authentication | Email + 2FA (TOTP or email OTP) |
| Academic Calendar | Create and manage academic years and term definitions |
| School Management | Add, edit, suspend, delete school accounts |
| User Management | Manage all admins, teachers, and learners across all schools |
| Course Authorship | Full CRUD on all courses, modules, lessons, content, quizzes, projects |
| Quiz Pool Management | Add questions to the global pool; assign question visibility to specific schools |
| Course Publishing | Publish/unpublish courses to all schools or selected schools |
| Reporting | View all learner progress, per term, per school, per class, per child |
| Historical Reporting | Access all past term records across all schools |
| School Reports | Generate school-level academic excellence reports scoped to any term |
| Analytics | System-wide dashboards — enrolment trends, completion rates, avg scores per term |
| Leaderboards | View all leaderboards: course, quiz, typing — per school, per term, all-time |
| Club Growth | See enrolment growth/decline per school across terms and years |
| Support | Audit logs, reset any password, manage 2FA recovery |
| Preferences | System-wide settings (branding, notification templates) |
| Typing Test Management | View typing test results across all schools and terms |

---

### 4.2 School Admin (Teacher / Club Coordinator)
| Capability | Detail |
|---|---|
| Authentication | Email + 2FA; prompt password change on first login |
| Profile | Name (shown on report cards), school, allocated club(s), email |
| Term Management | View active term; initiate new term enrolment; pull from last term |
| Learner Management | Add learners manually or via Excel; remove from active term; view history |
| Learner Profiles | Edit full profile: name, grade, parent name, parent email, parent phone |
| Account Generation | System auto-generates username + temporary password per learner |
| Course Allocation | Bulk allocate courses per term; filter by class/grade; system handles resume logic |
| Module Control | Open/close individual modules for controlled pacing (Module 1 open by default) |
| Deadlines | Set optional submission deadlines per module or lesson, scoped to current term |
| Feedback | Review and give written feedback on file/project submissions |
| Report Cards | Generate term-scoped report cards: individual, class, or whole school |
| Report Card Design | Customise: school name, club name, term label, 4 header categories, logo; multi-section layout |
| Dashboard | Active term stats: enrolment counts, growth card, submission queue, class progress |
| Historical View | Browse any past term — learner progress, report cards, quiz results (read-only) |
| Password Reset | Trigger password reset for any learner |
| Branding | Upload school logo | added by admin on school registration
| Quiz Management | Create quizzes per term; assign to classes; manage pool |
| Quiz Pool Access | View and use questions from the school pool (including System Admin-shared questions) |
| Typing Test Results | View typing results per learner, per class, per term |
| Leaderboards | View course, quiz, and typing leaderboards for their school |
| Stream Management | Add, edit, and delete class streams for their school (via Preferences tab) — e.g., Grade 4 Wisdom, Grade 4 Love |
| **Restrictions** | Cannot edit lesson content, course quiz questions, or project tasks |

---

### 4.3 Student (Learner)
| Capability | Detail |
|---|---|
| Authentication | Username + password (system-generated); forced change on first login |
| Onboarding Typing Test | Mandatory timed typing test on first class join each term (or as reset by admin) |
| Dashboard | Active term: enrolled courses (cards + progress), trend graph, assessments, badges |
| Course Navigation | Active term courses in sidebar; locked modules greyed out |
| Course Progress | Resumes exactly where left off if continuing a course from a prior term |
| Learning | Engage with lesson content, videos, examples, practice tasks |
| Quizzes | Auto-marked; infinite retries; instant feedback |
| Stand-alone Quizzes | Complete teacher-assigned class quizzes from the quiz pool |
| Submissions | Upload files for project tasks; view feedback from teacher |
| Gamification | Sound effects, badges, XP — accumulated across all terms and years |
| Progress View | Real-time progress per lesson, module, course; grade band display |
| Report Card | View current term report card live; access past term report cards |
| Portfolio | All submitted works across all terms |
| History | Can view their own past term performance (read-only) |
| **Restrictions** | Cannot reset own password; cannot access other students' data |

---

## 5. Authentication & Security

| Feature | Detail |
|---|---|
| Password Policy | Min 8 chars, uppercase, lowercase, number, special char |
| First Login | Force password change for all system-generated accounts |
| 2FA | Required for System Admin and School Admin (TOTP app or email OTP) |
| Session Management | JWT with refresh tokens; auto-logout after inactivity (configurable) |
| Password Reset | Email magic link (15-min expiry) for admins; teacher-initiated reset for students |
| Rate Limiting | Brute-force protection on login (5 attempts → 15-min lockout) |
| Role-Based Access Control (RBAC) | All API endpoints gated by role; students cannot access admin routes |
| Data Encryption | Passwords bcrypt-hashed; sensitive fields encrypted at rest |
| HTTPS | Enforced across all environments |
| Audit Logs | All admin actions logged (who, what, when, term) |
| Input Validation | Server-side validation on all inputs; parameterised queries |
| File Upload Security | Type whitelist, size limits, virus scan on submissions |
| CSRF Protection | Anti-CSRF tokens on all state-changing requests |
| Historical Data Protection | Past term records are read-only; cannot be edited or deleted by school admin |

---

## 6. Course Structure

```
Course (global, persistent)
 └── Module 1
      └── Lesson 1
           ├── Content (text, images, embedded video links)
           ├── Example (editable by school admin)
           ├── Practice Tasks (2–3 per lesson)
           │    ├── Quiz (≥5 questions, ≥2 typed-answer; auto-marked; infinite retries)
           │    └── Project / File Submission
           └── Score (0–100%)
 └── Module 2 ...
```

### Course Rules
- Courses exist globally and are not reset per term — progress persists on the learner.
- A **Course** has learning objectives; overall score = average of all module scores.
- A **Module** has 3–5 lessons; overall score = average of lesson scores.
- A **Lesson** score = quiz score + task completion; lessons build sequentially.
- Modules unlock sequentially (score threshold met OR teacher manually opens).
- Content, quiz questions, and project tasks authored by **System Admin only**.
- School admins may edit examples and content annotations only.
- All content must be child-friendly, gamified, and concise.

### Grading Bands
| Score | Band |
|---|---|
| 0–50% | Approaching Expectation |
| 51–75% | Meets Expectation |
| 76–100% | Exceeding Expectation |

---

## 7. Leaderboards & Rankings

### 7.1 Purpose
Provide a transparent, motivating view of learner performance — visible to teachers and admins, optionally to students — across courses, quizzes, and typing tests.

### 7.2 Leaderboard Types

| Leaderboard | Ranked By | Scope Options |
|---|---|---|
| Course Leaderboard | Overall course score % | Per course · Per class · Per school · All-time |
| Module Leaderboard | Module score % | Per module · Per class |
| Quiz Leaderboard | Quiz score % | Per quiz · Per class · Per school |
| Typing Leaderboard | WPM (primary), Accuracy % (secondary) | Per class · Per school · All-time |
| XP / Overall Leaderboard | Cumulative XP across all terms | Per class · Per school · All-time |

### 7.3 Scope Filters
All leaderboards can be filtered by:
- **Term** (current term, specific past term, all-time cumulative)
- **Year** (e.g., 2026)
- **Class / Grade**
- **School** (System Admin only)

### 7.4 Visibility Rules
| Role | Visibility |
|---|---|
| System Admin | All leaderboards for all schools, all terms |
| School Admin | All leaderboards for their school — all terms |
| Student | Can see class leaderboard (own rank highlighted); toggle configurable by admin |

### 7.5 Cumulative Badges & XP
- Badges and XP are **never reset** between terms or years — they accumulate on the learner's profile for life.
- Leaderboards can be viewed as "this term" or "all-time" to distinguish current vs historical standing.

---

## 8. Typing Test (Onboarding Assessment)

### 8.1 Purpose
Establishes a digital readiness baseline per login session or rather course /modue/lesson join. Results are term-scoped on the report card and can be compared across terms to track improvement.

### 8.2 Trigger
- Automatically presented to a student the **first time they access a lesson in a new term**.
- Admin may manually reset the typing test for any learner at any time.

### 8.3 Test Mechanics
| Property | Detail |
|---|---|
| Text source | Auto-generated Christian/faith-based passage (server-side seeded) |
| Text length | 300–500 words (configurable per school) |
| Timer | 300–500 seconds (configurable; shown as live countdown) |
| Display | Passage above; learner types in input box below |
| Live metrics | WPM, Accuracy %, Remaining Time — updated in real time |
| Completion | Submits on timer expiry or text completion, whichever comes first |
| Result recorded | WPM, Accuracy %, Time taken, raw typed answer, timestamp, term |
| Retakes | Not permitted by default; admin resets manually |

### 8.4 Scoring Logic
- **WPM** = (Correct words typed) ÷ (Time taken in minutes)
- **Accuracy** = (Correct characters ÷ Total characters typed) × 100

### 8.5 Admin View
- Results table per class: learner, WPM, accuracy, term, date.
- Cross-term comparison: see a learner's WPM across Term 1 → Term 2 → Term 3.
- Exportable.

### 8.6 Report Card
- Typing Assessment section shows WPM, accuracy %, and test date, curve for the whole term, accuracy and speed chnages scoped to the current term.

---

## 9. Quiz Pool System (Stand-alone Assessments)

### 9.1 Purpose
Centralised question bank for teacher-created, class-assigned assessments — separate from lesson-embedded quizzes.

### 9.2 Architecture
```
Global Pool (System Admin) — shared to specific schools
 └── School Pool (School Admin)
      └── Quizzes — assigned to one or more classes, scoped to active term
           └── Students in those classes take the quiz
```

### 9.3 Question Format
Columns: `question`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option`

**CSV Import:**
```
question,option_a,option_b,option_c,option_d,correct_option
What does HTML stand for?,Hyper Text Markup Language,High Text Machine Language,Hyper Transfer Markup Language,Hyper Text Making Language,A
```
- Invalid rows → downloadable error report.
- Duplicate detection by text hash.

### 9.4 Quiz Creation (School Admin)
1. Name the quiz; optional description.
2. Select classes (multi-select from school's active term classes).
3. Build question set from school pool.
4. Set options: time limit (optional), question count, randomise order.
5. Publish → students see it on their dashboard.

### 9.5 Quiz-Taking (Student)
- Appears as a card on dashboard under "Assessments."
- Multiple choice; one question at a time; optional timer.
- Auto-marked; score and correct answers shown after.
- Results logged with term tag.

### 9.6 Quiz Results
- Admin views: per quiz, per student, per class, class average — filterable by term.
- Exportable.
- Report card: Assessments section lists each quiz: name, score, date, term.

---

## 10. Report Card

The report card is **term-scoped** and **multi-section**, auto-populating from all tracked activities in that term.

### 10.1 Header (Customisable by School Admin)
| Field | Detail |
|---|---|
| School name | From school profile |
| School logo | Uploaded by admin |
| Club name | From allocation |
| Academic Year | Auto from active term (e.g., 2026) |
| Term | Auto from active term (e.g., Term 2) |
| 4 additional custom header fields | Admin-defined labels and values |
| Learner name | Auto |
| Grade / Class | Auto |
| Teacher name | Auto |
| Date generated | Auto |

### 10.2 Report Card Sections (per term)
| Section | Content | Auto-populated? |
|---|---|---|
| Course Section (one per allocated course) | Module scores, overall score, grade band, progress notes | ✅ Yes |
| Typing Assessment | WPM, Accuracy %, test date | ✅ Yes |
| Assessments (Quiz Pool) | Each quiz: name, score %, date | ✅ Yes |
| Teacher Remarks | Free-text per section or overall | ✏️ Manual |

### 10.3 Generation Options
| Type | Scope |
|---|---|
| Individual | Single learner PDF — current or any past term |
| Class bulk | All learners in a class, zipped |
| School bulk | All learners in school, zipped |

- Learner views current term report card live; past term cards available read-only.
- Parent receives PDF by email on admin publish.

---

## 11. Available Courses (Initial Set)

1. Website Development (HTML, CSS, JavaScript)
2. Android App Development
3. Scratch Programming
4. Python Programming
5. Data Analysis
6. AI & Machine Learning Fundamentals
7. Excel for Kids
8. Graphic Design
9. Robotics
10. *(Extensible — added by System Admin)*

---

## 12. Learner Profile

| Field | Notes |
|---|---|
| System username | Auto-generated, unique, derived from name |
| Display name | Full name |
| Grade / Class | Set on upload or manually |
| Stream | Optional — selected from school-defined streams (e.g., Wisdom, Love, Joy); assignable on manual add or Excel upload |
| Date of Birth | Optional |
| Parent/Guardian Name | For reporting |
| Parent Email | Notifications and report delivery |
| Parent Phone | Optional |
| Profile Photo | Optional upload |
| Active Term Courses | Courses enrolled this term with live progress |
| All-time Course History | All courses attempted across all terms |
| Typing Test History | WPM and accuracy per term — trend viewable |
| Quiz History | All stand-alone quizzes across all terms |
| Badge & XP Summary | Cumulative — never reset |
| Portfolio | All submitted works across all terms |

---

## 13. Gamification System

| Element | Behaviour |
|---|---|
| Sound effects | Correct answer, lesson complete, badge award |
| XP Points | Earned per lesson, quiz, submission — cumulative across all terms |
| Module Badge | Awarded on module completion; persists forever on learner profile |
| Achievement Celebrations | Animated on milestone (first lesson, first module, full course, new term start) |
| Leaderboard | See §7 — class and school rankings, filtered by term or all-time |
| Streak Tracking | Consecutive days of activity — resets each term; best streak saved to profile |

---

## 14. Dashboards

### Student Dashboard
- Current term label (e.g., "2026 — Term 2") displayed at top
- Enrolled course cards (progress %, grade band, quick-enter button)
- Trend graph: score over modules/weeks — current term; can switch to view past terms
- Assessments card: pending quizzes, completed quizzes (this term)
- Achievement badges strip (all-time)
- Portfolio quick-link
- Notifications

### School Admin Dashboard
- Active term label at top
- **Club growth card**: last term vs current term enrolment (▲/▼ + mini trend chart)
- Enrolment counts per course (this term)
- Class-level progress overview
- Pending submissions queue
- Typing test results summary per class (this term)
- Quiz results overview (this term)
- Leaderboard quick-links (course, quiz, typing)
- Report card generation shortcuts
- Historical term selector → switch to view any past term in read-only mode

### System Admin Dashboard
- Active term overview (all schools)
- Club growth summary: enrolment trends per school, system-wide
- System-wide course completion rates (by term and all-time)
- Per-school academic performance
- Leaderboard viewer (all schools, all terms)
- Quiz pool management panel
- Audit log viewer
- Course publishing controls

---

## 15. Notifications

| Event | Recipient | Method |
|---|---|---|
| New learner account created | Parent email | Email |
| Password reset request | Admin/Parent | Email magic link |
| Submission feedback posted | Student | In-app |
| Module opened by teacher | Student | In-app + optional push |
| Deadline approaching | Student | In-app + optional push |
| New quiz assigned | Student | In-app |
| Report card available | Parent email | Email |
| New course published | School Admin | Email + in-app |
| Typing test completed | School Admin | In-app (summary) |
| New term activated | All users (school) | In-app |
| New term enrolment ready to configure | School Admin | Email + in-app |

---

## 16. Excel / CSV Import Formats

### Learner Upload (Excel)
Required: `Full Name`, `Grade`
Optional: `Stream`, `Date of Birth`, `Parent Name`, `Parent Email`, `Parent Phone`

**Example rows:**
```
Full Name,    Grade, Stream,  Date of Birth, Parent Name,   Parent Email
Alice Mwangi, 4,     Wisdom,  2016-03-12,    Jane Mwangi,   jane@email.com
Brian Otieno, 4,     Love,    ,              David Otieno,  david@email.com
Carol Njeri,  1,     ,        ,              ,
```

- `Stream` is optional — leave blank if the grade has no streams or the stream is unknown.
- Stream values are validated against the school's configured streams; unrecognised values trigger a warning in the error report (not a hard block — admin can correct after import).
- Duplicate name detection → auto-append number to username.
- Validation errors → downloadable error report.
- Used both for fresh imports and new-term additions.

### Quiz Question Upload (CSV)
Columns: `question`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option`
- `correct_option` must be A, B, C, or D.
- Invalid rows → downloadable error report.
- Duplicate detection by question text hash.

---

## 17. School Preferences (School Admin)

Accessible via the **Preferences** tab in the School Admin panel. Settings are school-specific and persist across terms.

### 17.1 Stream Management
Streams represent named divisions within a grade (e.g., Grade 4 — Wisdom, Love, Hope, Joy).

| Action | Detail |
|---|---|
| Add stream | Enter a stream name; optionally associate with a specific grade or leave grade-agnostic |
| Edit stream name | Renames the stream everywhere it appears (learner profiles, filters, reports) |
| Delete stream | Only allowed if no active learners are assigned to it; archived learners retain historical stream label |
| View streams | Table of all configured streams grouped by grade |

Stream names are free-form text — the school defines them. Examples: Wisdom, Love, Joy, Hope, Grace, Eagle, Lion.

Once streams are configured, they appear as a dropdown in:
- Manual learner add form (optional field)
- Excel import validation (values checked against this list)
- Learner profile edit
- Bulk course allocation filters (filter by grade + stream)
- Report card generation filters (generate for a specific stream)
- Leaderboard filters (view rankings within a stream)

### 17.2 Other Preferences
| Setting | Detail |
|---|---|
| Typing test duration | Configure passage length (300–500 words) and timer (300–500 seconds) for the school |
| Module pass threshold | Score % required for a module to unlock the next (default configurable) |
| Leaderboard visibility | Toggle whether students can see class leaderboards |
| Notification preferences | Which events trigger email/push per role |
| Report card header fields | Customise the 4 additional header category labels and default values |

## Efficient Club Management & Learning

The system should support smooth learner progression, bulk administration, reporting, tracking, and AI-assisted insights.

### Graduating Learners / Grade Progression
- At the start of a new academic year, learners can be promoted automatically or manually.
- Example: Grade 1 learners in 2026 become Grade 2 learners in 2027.
- Admin can review and confirm promotion before applying.
- Learner history, progress, badges, XP, reports, and portfolio remain attached to the learner.
- Learners who repeat, transfer, or leave can be edited individually.

### Bulk Actions
School Admin can perform bulk actions, including:
- Bulk learner promotion- to next grade
- Bulk edit learner details
- Bulk delete / deactivate learners
- Bulk course allocation
- Bulk remove from active term
- Bulk report card generation
- Bulk password reset
- Bulk upload via Excel
- Bulk export of learner data, quiz results, typing results, and reports

### Reporting & Tracking
The system provides clear tracking for:
- Learner progress per course, module, lesson, and term
- Quiz scores
- Typing test improvement
- Submission status
- Attendance/activity history if added later
- Club growth by term and year
- Class, stream, school, and learner-level performance

### AI Analytics & Hints
The system includes AI-powered support for admins and learners:
- AI hints for learners when they struggle with lessons or quizzes
- AI progress insights for teachers
- AI flags learners who may need extra support
- AI suggests revision areas based on weak scores
- AI generates simple performance summaries for report cards
- AI helps teachers identify top performers, improving learners, and inactive learners
- AI dashboard shows trends, risks, and recommendations

suggested code structure:
C:\educlub
│
├── frontend/
│   ├── app/
│   │   ├── page.js
│   │   ├── layout.js
│   │   ├── globals.css
│   │   │
│   │   ├── login/
│   │   │   └── page.js
│   │   │
│   │   ├── admin/
│   │   │   └── page.js
│   │   │
│   │   ├── school-admin/
│   │   │   └── page.js
│   │   │
│   │   ├── student/
│   │   │   └── page.js
│   │   │
│   │   └── reports/
│   │       └── page.js
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── LoginForm.js
│   │   │   ├── ForgotPassword.js
│   │   │   └── auth.css
│   │   │
│   │   ├── dashboard/
│   │   │   ├── StudentDashboard.js
│   │   │   ├── SchoolAdminDashboard.js
│   │   │   ├── SystemAdminDashboard.js
│   │   │   └── dashboard.css
│   │   │
│   │   ├── learners/
│   │   │   ├── LearnerList.js
│   │   │   ├── LearnerProfile.js
│   │   │   ├── AddLearner.js
│   │   │   ├── BulkLearnerActions.js
│   │   │   ├── GradePromotion.js
│   │   │   └── learners.css
│   │   │
│   │   ├── courses/
│   │   │   ├── CourseList.js
│   │   │   ├── CourseView.js
│   │   │   ├── ModuleView.js
│   │   │   ├── LessonView.js
│   │   │   └── courses.css
│   │   │
│   │   ├── enrolments/
│   │   │   ├── TermEnrolment.js
│   │   │   ├── CourseAllocation.js
│   │   │   └── enrolments.css
│   │   │
│   │   ├── quizzes/
│   │   │   ├── QuizList.js
│   │   │   ├── QuizTaking.js
│   │   │   ├── QuizResults.js
│   │   │   ├── QuestionPool.js
│   │   │   └── quizzes.css
│   │   │
│   │   ├── typing/
│   │   │   ├── TypingTest.js
│   │   │   ├── TypingResults.js
│   │   │   └── typing.css
│   │   │
│   │   ├── reports/
│   │   │   ├── ReportCard.js
│   │   │   ├── ReportBuilder.js
│   │   │   ├── BulkReports.js
│   │   │   └── reports.css
│   │   │
│   │   ├── leaderboards/
│   │   │   ├── Leaderboard.js
│   │   │   └── leaderboards.css
│   │   │
│   │   ├── analytics/
│   │   │   ├── AIAnalytics.js
│   │   │   ├── LearnerHints.js
│   │   │   └── analytics.css
│   │   │
│   │   └── settings/
│   │       ├── SchoolPreferences.js
│   │       ├── StreamManagement.js
│   │       └── settings.css
│   │
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.js
│   │   │   └── button.css
│   │   ├── Card/
│   │   │   ├── Card.js
│   │   │   └── card.css
│   │   ├── Modal/
│   │   ├── Table/
│   │   ├── Sidebar/
│   │   ├── Navbar/
│   │   ├── Loader/
│   │   └── Charts/
│   │
│   ├── styles/
│   │   ├── variables.css
│   │   ├── animations.css
│   │   ├── forms.css
│   │   └── tables.css
│   │
│   ├── lib/
│   │   ├── api.js
│   │   ├── auth.js
│   │   └── helpers.js
│   │
│   ├── public/
│   │   ├── logo.png
│   │   └── icons/
│   │
│   ├── package.json
│   └── next.config.js
│
├── backend/
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── schools.routes.js
│   │   ├── learners.routes.js
│   │   ├── terms.routes.js
│   │   ├── courses.routes.js
│   │   ├── enrolments.routes.js
│   │   ├── quizzes.routes.js
│   │   ├── typing.routes.js
│   │   ├── reports.routes.js
│   │   ├── leaderboards.routes.js
│   │   ├── analytics.routes.js
│   │   └── settings.routes.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── learners.controller.js
│   │   ├── courses.controller.js
│   │   ├── quizzes.controller.js
│   │   ├── reports.controller.js
│   │   └── analytics.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── learner.service.js
│   │   ├── course.service.js
│   │   ├── enrolment.service.js
│   │   ├── quiz.service.js
│   │   ├── typing.service.js
│   │   ├── report.service.js
│   │   ├── promotion.service.js
│   │   ├── leaderboard.service.js
│   │   ├── notification.service.js
│   │   └── ai.service.js
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   ├── error.middleware.js
│   │   └── upload.middleware.js
│   │
│   ├── config/
│   │   ├── supabase.js
│   │   ├── database.js
│   │   ├── email.js
│   │   └── env.js
│   │
│   ├── utils/
│   │   ├── generatePassword.js
│   │   ├── generateUsername.js
│   │   ├── calculateScore.js
│   │   ├── generatePDF.js
│   │   └── validators.js
│   │
│   ├── uploads/
│   │   ├── learner-files/
│   │   └── report-cards/
│   │
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── migrations/
│
├── docs/
│   ├── system-requirements.md
│   ├── flowchart.mermaid
│   └── deployment-notes.md
│
├── .gitignore
├── README.md
└── .env.example


the flow
Frontend
↓
Backend Server
↓
Router
↓
Middleware
↓
Controller
↓
Service / Business Logic
↓
Supabase PostgreSQL Database


Frontend-
Next.js
JavaScript
CSS

javascript
components
pages
logic
API calls

css
styling
animations
layouts
responsive design

backend
Node.js
Express.js
JavaScript

backend javascript
routes
controllers
services
middlewares
authentication
business logic

---

## 18. PWA / Technical Requirements

| Requirement | Detail |
|---|---|
| Installable | PWA manifest — "Add to Home Screen" on Android & iOS |
| Offline Support | Lesson content cached for offline reading (service worker) |
| Responsive | Mobile-first; works on 320px+ screens |
| Performance | Lazy-loaded modules; image optimisation; target LCP < 2.5s |
| Accessibility | WCAG 2.1 AA — keyboard nav, screen reader labels, colour contrast |
| Browser Support | Latest Chrome, Safari, Firefox, Samsung Internet |
| Video Hosting | Links to external providers (YouTube, Vimeo) — no self-hosting |
| Real-time | WebSocket or SSE for live typing test metrics |
| Data isolation | All queries scoped by term ID to prevent cross-term data bleed |

---

## 19. What Was Added vs v1.2

| Addition | Detail |
|---|---|
| Stream Management — §4.2 | School Admin can add/edit/delete streams in Preferences tab |
| Learner Profile — Stream field (§12) | Optional stream field; persists on profile; shown in filters and reports |
| Excel Import — Stream column (§16) | `Stream` added as optional column; validated against school's configured list; warnings on unrecognised values |
| Manual Add — Stream field | Stream dropdown (populated from school's list) on the manual learner add form |
| School Preferences section (§17) | Dedicated section covering stream management, typing test config, pass threshold, leaderboard visibility, notification prefs, report card header fields |
| Filters updated | Bulk course allocation, report card generation, and leaderboards all filterable by grade + stream |

---

## 20. Out of Scope (v1.0)

- Live video / synchronous classes
- Student-to-student messaging
- Payment / subscription billing
- External SSO (Google, Microsoft) — v2
- Multi-language / i18n — v2
- Essay / long-form auto-grading — v2

---

*Document v1.3 — updated to include Grade Streams, School Preferences tab, and stream-aware filters across enrolment, reporting, and leaderboards.*
