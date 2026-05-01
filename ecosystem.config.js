module.exports = {
  apps: [
    {
      name: "production-scheduler",
      script: "npm",
      args: "start",
      cwd: "/var/www/production-scheduler",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
