const path = require("path");

const appDir = path.join(__dirname);

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
        PORT: process.env.PORT || 3000
      }
    }
  ]
};
