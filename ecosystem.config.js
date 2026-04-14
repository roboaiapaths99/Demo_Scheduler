module.exports = {
  apps: [
    {
      name: 'tutor-availability-system',
      script: 'server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enable cluster mode
      watch: false, // Disable watching in production
      max_memory_restart: '1G', // Restart if memory exceeds 1GB
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5000
      },
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      kill_signal: 'SIGINT',
      graceful_reload: true,
      tree_kill: true,
      // Health check
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      health_check_active: true,
      health_check_slash: '/api/health',
      health_check_interval: 10000,
      health_check_timeout: 3000,
      health_check_grace_period: 10000,
      // Monitoring
      pmx: true,
      // Deployment
      deploy: {
        production: {
          user: 'deploy',
          host: 'your-server.com',
          ref: 'origin/main',
          repo: 'git@github.com:username/tutor-availability-system.git',
          path: '/var/www/tutor-availability-system',
          'pre-deploy-local': '',
          'post-deploy': 'npm install && npm run prod && pm2 reload ecosystem.config.js --env production',
          'pre-setup': '',
          'ssh_options': 'StrictHostKeyChecking=no'
        }
      }
    }
  ]
};
