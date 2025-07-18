module.exports = {
  apps: [
    {
      name: "school-trip-dashboard-backend",
      script: "./server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};