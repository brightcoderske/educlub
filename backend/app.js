const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { env } = require("./config/env");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const authRoutes = require("./routes/auth.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const accessControlRoutes = require("./routes/accessControl.routes");
const certificateGenerationRoutes = require("./routes/certificateGeneration.routes");
const certificationsRoutes = require("./routes/certifications.routes");
const contributorsRoutes = require("./routes/contributors.routes");
const coursesRoutes = require("./routes/courses.routes");
const enrolmentsRoutes = require("./routes/enrolments.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const leaderboardsRoutes = require("./routes/leaderboards.routes");
const learnersRoutes = require("./routes/learners.routes");
const progressRoutes = require("./routes/progress.routes");
const quizzesRoutes = require("./routes/quizzes.routes");
const reportsRoutes = require("./routes/reports.routes");
const schoolsRoutes = require("./routes/schools.routes");
const schoolAdminRoutes = require("./routes/schoolAdmin.routes");
const settingsRoutes = require("./routes/settings.routes");
const studentRoutes = require("./routes/student.routes");
const termsRoutes = require("./routes/terms.routes");
const thumbnailRoutes = require("./routes/thumbnail.routes");
const typingRoutes = require("./routes/typing.routes");
const usersRoutes = require("./routes/users.routes");

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.frontendOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "educlub-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/access-control", accessControlRoutes);
app.use("/api/certificate-generation", certificateGenerationRoutes);
app.use("/api/certifications", certificationsRoutes);
app.use("/api/contributors", contributorsRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/enrolments", enrolmentsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/leaderboards", leaderboardsRoutes);
app.use("/api/learners", learnersRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/quizzes", quizzesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/schools", schoolsRoutes);
app.use("/api/school-admin", schoolAdminRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/terms", termsRoutes);
app.use("/api/thumbnail", thumbnailRoutes);
app.use("/api/typing", typingRoutes);
app.use("/api/users", usersRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
