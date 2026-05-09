require("dotenv").config();

const http = require("http");

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 4000,
        path,
        method: options.method || "GET",
        headers: {
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(options.headers || {})
        }
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body: text ? JSON.parse(text) : null });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const login = await request(
    "/api/auth/login",
    { method: "POST" },
    { identifier: process.env.SYSTEM_ADMIN_EMAIL, password: process.env.SYSTEM_ADMIN_PASSWORD }
  );

  if (login.statusCode !== 200) {
    throw new Error(`Login failed with status ${login.statusCode}`);
  }

  const summary = await request("/api/analytics/system-admin/summary", {
    headers: { Authorization: `Bearer ${login.body.accessToken}` }
  });

  if (summary.statusCode !== 200 || !summary.body.totals) {
    throw new Error(`Dashboard summary failed with status ${summary.statusCode}: ${JSON.stringify(summary.body)}`);
  }

  const headers = { Authorization: `Bearer ${login.body.accessToken}` };
  const dashboardPaths = [
    "/api/schools",
    "/api/terms",
    "/api/users",
    "/api/courses",
    "/api/quizzes/global-questions",
    "/api/leaderboards",
    "/api/analytics/audit-logs",
    "/api/analytics/system-admin/school-performance"
  ];

  for (const path of dashboardPaths) {
    const result = await request(path, { headers });
    if (result.statusCode !== 200) {
      throw new Error(`${path} failed with status ${result.statusCode}: ${JSON.stringify(result.body)}`);
    }
  }

  console.log("Local System Admin login and all dashboard API checks passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
