/**
 * PM2 cluster: 2 Node workers behind built-in load balancing (use 2 CPU cores).
 * Start: npm run pm2:start   |   Stop: npm run pm2:stop
 * Requires .env in this directory (PORT, DB_*, JWT_SECRET, API_KEY, etc.).
 */
const path = require('path');

const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'cosmos-erp',
      script: path.join(root, 'app.js'),
      cwd: root,
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '900M',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production'
      }
    }
  ]
};
