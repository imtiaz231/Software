require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, DATA_DIR, getSettings } = require('./db');
const authRoutes = require('./routes/auth');
const { account, biz } = require('./routes/shop');
const adminRoutes = require('./routes/admin');

// ---- Admin seed ----
if (!db.prepare('SELECT 1 FROM admins').get()) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === 'production') { console.error('FATAL: set ADMIN_PASSWORD.'); process.exit(1); }
    password = 'admin12345';
    console.warn('[!] Dev admin created: username=admin password=admin12345 (local use only)');
  }
  db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run(username, bcrypt.hashSync(password, 10));
  console.log(`Admin account created: ${username}`);
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '300kb' }));

app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '7d', index: false }));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/public/status', (req, res) => {
  const s = getSettings();
  res.json({ app_name: s.app_name, maintenance: s.maintenance_mode === '1', message: s.maintenance_message });
});
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 80, standardHeaders: true, legacyHeaders: false }), authRoutes);
app.use('/api/shop', account);
app.use('/api/admin', adminRoutes);
app.use('/api', biz); // must be last (shopAuth + active subscription)

const dist = path.join(__dirname, '..', 'public');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    setHeaders: (res, file) => {
      if (/(sw\.js|index\.html)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
      else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  const client = err instanceof multer.MulterError || (err.message || '').startsWith('Only ');
  if (!client) console.error(err);
  res.status(client ? 400 : 500).json({ error: client ? (err.code === 'LIMIT_FILE_SIZE' ? 'The image is too large (logo and screenshot: 2 MB, bill photo: 8 MB)' : err.message) : 'Server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running: http://localhost:${port}`));
