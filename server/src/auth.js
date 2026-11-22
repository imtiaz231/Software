const jwt = require('jsonwebtoken');
const { db, getSettings } = require('./db');

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me')) {
  console.error('FATAL: JWT_SECRET must be set in production.');
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET || 'dev-secret-not-for-production';
const sign = (role, id) => jwt.sign({ role, id }, SECRET, { expiresIn: '12h' });

function parse(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), SECRET); } catch { return null; }
}
const hasAccess = (s) => s.status !== 'blocked' && !!s.expires_at && new Date(s.expires_at) > new Date();

function shopView(s) {
  const access = hasAccess(s);
  return {
    id: s.id, name: s.name, address: s.address, phone: s.phone,
    logo: s.logo ? '/uploads/' + s.logo : null,
    status: s.status, expires_at: s.expires_at, access,
    daysLeft: access ? Math.ceil((new Date(s.expires_at) - Date.now()) / 864e5) : 0,
    must_change: !!s.must_change_password,
    created_at: s.created_at,
  };
}

function adminAuth(req, res, next) {
  const t = parse(req);
  if (!t || t.role !== 'admin') return res.status(401).json({ error: 'Admin login required' });
  const a = db.prepare('SELECT id,username FROM admins WHERE id=?').get(t.id);
  if (!a) return res.status(401).json({ error: 'Invalid session' });
  req.admin = a; next();
}

// Shop login + maintenance + block check (no subscription check)
function shopAuth(req, res, next) {
  const t = parse(req);
  if (!t || t.role !== 'shop') return res.status(401).json({ error: 'Login required' });
  const shop = db.prepare('SELECT * FROM shops WHERE id=?').get(t.id);
  if (!shop) return res.status(401).json({ error: 'Invalid session' });
  const s = getSettings();
  if (s.maintenance_mode === '1') return res.status(503).json({ maintenance: true, error: s.maintenance_message });
  if (shop.status === 'blocked') return res.status(403).json({ blocked: true, error: 'Your account is blocked. Please contact the administrator.' });
  req.shop = shop; next();
}
// Requires an active subscription
function shopActive(req, res, next) {
  if (!hasAccess(req.shop)) return res.status(402).json({ subscription: true, error: 'Your subscription is not active. Please make a payment to get access.' });
  next();
}
module.exports = { sign, hasAccess, shopView, adminAuth, shopAuth, shopActive };
