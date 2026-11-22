const express = require('express');
const bcrypt = require('bcryptjs');
const { db, log } = require('../db');
const { sign, shopView } = require('../auth');
const { upload, rmUpload } = require('../uploads');
const { getSettings } = require('../db');

const rateLimit = require('express-rate-limit');
const r = express.Router();
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  message: { error: 'Too many requests. Please try again later.' },
});

function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('92') && d.length === 12) d = '0' + d.slice(2);
  return d;
}
const validPhone = (d) => d.length >= 10 && d.length <= 13;

r.post('/register', upload.single('logo'), (req, res) => {
  const logo = req.file && req.file.filename;
  const fail = (m) => { rmUpload(logo); return res.status(400).json({ error: m }); };
  const name = String(req.body.name || '').trim();
  const address = String(req.body.address || '').trim();
  const phone = normPhone(req.body.phone);
  const password = String(req.body.password || '');
  if (name.length < 2) return fail('Enter the shop name');
  if (address.length < 3) return fail('Enter the shop address');
  if (!validPhone(phone)) return fail('Enter a valid phone number (e.g. 03001234567)');
  if (password.length < 6) return fail('Password must be at least 6 characters');
  try {
    const id = db.prepare('INSERT INTO shops(name,address,phone,password_hash,logo,created_at) VALUES(?,?,?,?,?,?)')
      .run(name, address, phone, bcrypt.hashSync(password, 10), logo || null, new Date().toISOString()).lastInsertRowid;
    log(id, 'shop', 'register', name);
    const shop = db.prepare('SELECT * FROM shops WHERE id=?').get(id);
    res.json({ token: sign('shop', id), role: 'shop', shop: shopView(shop) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return fail('This phone number is already registered');
    throw e;
  }
});

r.post('/login', (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');
  const bad = () => res.status(401).json({ error: 'Incorrect phone/username or password' });

  const admin = db.prepare('SELECT * FROM admins WHERE username=?').get(identifier);
  if (admin) {
    if (!bcrypt.compareSync(password, admin.password_hash)) return bad();
    return res.json({ token: sign('admin', admin.id), role: 'admin', admin: { username: admin.username } });
  }
  const shop = db.prepare('SELECT * FROM shops WHERE phone=?').get(normPhone(identifier));
  if (!shop || !bcrypt.compareSync(password, shop.password_hash)) return bad();
  const s = getSettings();
  if (s.maintenance_mode === '1') return res.status(503).json({ maintenance: true, error: s.maintenance_message });
  if (shop.status === 'blocked') return res.status(403).json({ error: 'Your account is blocked. Please contact the administrator.' });
  log(shop.id, 'shop', 'login', '');
  res.json({ token: sign('shop', shop.id), role: 'shop', shop: shopView(shop) });
});

// Public: a shop that forgot its password asks the admin for a reset.
// The response is identical whether or not the phone number exists (no account enumeration).
r.post('/forgot-password', forgotLimiter, (req, res) => {
  const phone = normPhone(req.body.phone);
  const note = String(req.body.note || '').trim().slice(0, 200);
  if (!validPhone(phone)) return res.status(400).json({ error: 'Enter a valid phone number (e.g. 03001234567)' });
  const shop = db.prepare('SELECT id FROM shops WHERE phone=?').get(phone);
  if (shop && !db.prepare("SELECT 1 FROM password_requests WHERE shop_id=? AND status='pending'").get(shop.id)) {
    db.prepare('INSERT INTO password_requests(shop_id,note,created_at) VALUES(?,?,?)').run(shop.id, note, new Date().toISOString());
    log(shop.id, 'shop', 'password_request', note);
  }
  res.json({ ok: true, message: 'If this phone number is registered, the administrator has been notified and will contact you with a new password.' });
});

module.exports = r;
