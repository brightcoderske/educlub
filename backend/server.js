const app = require("./app");
const { assertRequiredEnv, env } = require("./config/env");

assertRequiredEnv();

app.listen(env.port, () => {
  console.log(`EduClub backend listening on port ${env.port}`);
});
