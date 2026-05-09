const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { env } = require("./config/env");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const authRoutes = require("./routes/auth.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const coursesRoutes = require("./routes/courses.routes");
const enrolmentsRoutes = require("./routes/enrolments.routes");
const leaderboardsRoutes = require("./routes/leaderboards.routes");
const learnersRoutes = require("./routes/learners.routes");
const quizzesRoutes = require("./routes/quizzes.routes");
const reportsRoutes = require("./routes/reports.routes");
const schoolsRoutes = require("./routes/schools.routes");
const schoolAdminRoutes = require("./routes/schoolAdmin.routes");
const settingsRoutes = require("./routes/settings.routes");
const termsRoutes = require("./routes/terms.routes");
const typingRoutes = require("./routes/typing.routes");
const usersRoutes = require("./routes/users.routes");

const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "educlub-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/enrolments", enrolmentsRoutes);
app.use("/api/leaderboards", leaderboardsRoutes);
app.use("/api/learners", learnersRoutes);
app.use("/api/quizzes", quizzesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/schools", schoolsRoutes);
app.use("/api/school-admin", schoolAdminRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/terms", termsRoutes);
app.use("/api/typing", typingRoutes);
app.use("/api/users", usersRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
