module.exports = {
  apps: [
    {
      name: 'fieldtracking-api',
      cwd: './Web_App/apps/api',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '../../.env.production',
      max_memory_restart: '1G',
      autorestart: true,
    },
    {
      name: 'fieldtracking-web',
      cwd: './Web_App/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_file: '../../.env.production',
      max_memory_restart: '1G',
      autorestart: true,
    },
  ],
};
