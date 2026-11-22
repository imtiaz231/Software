module.exports = {
  apps: [{
    name: 'shop-manager',
    cwd: './server',
    script: 'src/index.js',
    env: { NODE_ENV: 'production', PORT: 4000, TZ: 'Asia/Karachi' },
    // Put JWT_SECRET, ADMIN_PASSWORD and DATA_DIR in server/.env
  }],
};
