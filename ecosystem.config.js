const fs = require("fs");
const path = require("path");

const appDir = __dirname;

/** PM2 не читает .env сам — без этого TELEGRAM_BOT_TOKEN пустой и бот «молчит». */
function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const envFromFile = loadEnvFile(path.join(appDir, ".env"));

module.exports = {
  apps: [
    {
      name: "csrproizvodstvo",
      script: "npm",
      args: "start",
      cwd: appDir,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
        ...envFromFile
      }
    }
  ]
};
