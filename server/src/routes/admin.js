const express = require('express');
const bcrypt = require('bcryptjs');
const { db, defaults, getSettings, log } = require('../db');
const { adminAuth, shopView } = require('../auth');

const r = express.Router();
r.use(adminAuth);

// Adds calendar months (Jan 31 + 1 month = Feb 28/29, never spills into March)
function addMonths(date, n) {
  const d = new Date(date), day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() !== day) d.setDate(0);
  return d;
}
// Extends from the current expiry if the shop is still active, otherwise from today
function grant(shopId, { months = 0, days = 0 }) {
  const s = db.prepare('SELECT * FROM shops WHERE id=?').get(shopId);
  let base = s.expires_at && new Date(s.expires_at) > new Date() ? new Date(s.expires_at) : new Date();
  if (months) base = addMonths(base, months);
  if (days) base.setDate(base.getDate() + days);
  db.prepare('UPDATE shops SET expires_at=? WHERE id=?').run(base.toISOString(), shopId);
  return base.toISOString();
}

// Sets a temporary password, forces the shop to change it at next login, and closes any open requests.
function setTempPassword(shopId, password) {
  db.transaction(() => {
    db.prepare('UPDATE shops SET password_hash=?, must_change_password=1 WHERE id=?').run(bcrypt.hashSync(password, 10), shopId);
    db.prepare("UPDATE password_requests SET status='done', resolved_at=? WHERE shop_id=? AND status='pending'").run(new Date().toISOString(), shopId);
  })();
  log(shopId, 'admin', 'password_reset', 'Temporary password set by admin');
}

r.get('/me', (req, res) => res.json(req.admin));

r.get('/stats', (req, res) => {
  const shops = db.prepare('SELECT * FROM shops').all(), now = Date.now();
  const st = { total: shops.length, active: 0, expired: 0, never_paid: 0, blocked: 0, expiring_soon: 0 };
  for (const s of shops) {
    if (s.status === 'blocked') st.blocked++;
    else if (!s.expires_at) st.never_paid++;
    else if (new Date(s.expires_at) > now) { st.active++; if (new Date(s.expires_at) - now < 7 * 864e5) st.expiring_soon++; }
    else st.expired++;
  }
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  res.json({
    ...st,
    password_requests: db.prepare("SELECT COUNT(*) c FROM password_requests WHERE status='pending'").get().c,
    pending_payments: db.prepare("SELECT COUNT(*) c FROM payments WHERE status='pending'").get().c,
    revenue_total: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status='approved'").get().s,
    revenue_month: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status='approved' AND reviewed_at>=?").get(monthStart.toISOString()).s,
    maintenance: getSettings().maintenance_mode === '1',
  });
});

r.get('/shops', (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const rows = db.prepare(`SELECT s.*,
    (SELECT COUNT(*) FROM sale_bills WHERE shop_id=s.id) sales_count,
    (SELECT COUNT(*) FROM purchase_bills WHERE shop_id=s.id) purchase_count
    FROM shops s WHERE s.name LIKE ? OR s.phone LIKE ? ORDER BY s.id DESC LIMIT 500`).all(q, q);
  res.json(rows.map((s) => ({ ...shopView(s), sales_count: s.sales_count, purchase_count: s.purchase_count })));
});

r.post('/shops/:id/grant', (req, res) => {
  const months = Math.floor(Number(req.body.months)) || 0, days = Math.floor(Number(req.body.days)) || 0;
  if (months ? !(months >= 1 && months <= 60) : !(days >= 1 && days <= 3650))
    return res.status(400).json({ error: months ? 'Months must be between 1 and 60' : 'Days must be between 1 and 3650' });
  if (!db.prepare('SELECT 1 FROM shops WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Shop not found' });
  const until = grant(req.params.id, months ? { months } : { days });
  log(req.params.id, 'admin', 'access_granted', `${months ? months + ' month(s)' : days + ' day(s)'}, expires ${until.slice(0, 10)}`);
  res.json({ expires_at: until });
});

r.post('/shops/:id/revoke', (req, res) => {
  db.prepare('UPDATE shops SET expires_at=? WHERE id=?').run(new Date().toISOString(), req.params.id);
  log(req.params.id, 'admin', 'access_revoked', '');
  res.json({ ok: true });
});

r.post('/shops/:id/status', (req, res) => {
  const status = req.body.status;
  if (!['active', 'blocked'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE shops SET status=? WHERE id=?').run(status, req.params.id);
  log(req.params.id, 'admin', status === 'blocked' ? 'shop_blocked' : 'shop_unblocked', '');
  res.json({ ok: true });
});

r.post('/shops/:id/reset-password', (req, res) => {
  const pw = String(req.body.password || '');
  if (pw.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!db.prepare('SELECT 1 FROM shops WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Shop not found' });
  setTempPassword(req.params.id, pw);
  res.json({ ok: true });
});

r.get('/payments', (req, res) => {
  const st = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
  res.json(db.prepare(`SELECT p.*, s.name shop_name, s.phone shop_phone FROM payments p JOIN shops s ON s.id=p.shop_id
    ${st ? 'WHERE p.status=?' : ''} ORDER BY p.id DESC LIMIT 300`).all(...(st ? [st] : [])));
});

r.post('/payments/:id/approve', (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id=?').get(req.params.id);
  if (!p || p.status !== 'pending') return res.status(400).json({ error: 'Payment is not pending' });
  db.transaction(() => {
    db.prepare("UPDATE payments SET status='approved', reviewed_at=? WHERE id=?").run(new Date().toISOString(), p.id);
    grant(p.shop_id, { months: p.months });
  })();
  log(p.shop_id, 'admin', 'payment_approved', `${p.method} Rs ${p.amount} (${p.months} month(s))`);
  res.json({ ok: true });
});

r.post('/payments/:id/reject', (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id=?').get(req.params.id);
  if (!p || p.status !== 'pending') return res.status(400).json({ error: 'Payment is not pending' });
  const note = String(req.body.note || '').slice(0, 200);
  db.prepare("UPDATE payments SET status='rejected', note=?, reviewed_at=? WHERE id=?").run(note, new Date().toISOString(), p.id);
  log(p.shop_id, 'admin', 'payment_rejected', note);
  res.json({ ok: true });
});

r.get('/password-requests', (req, res) => {
  const st = ['pending', 'done', 'dismissed'].includes(req.query.status) ? req.query.status : null;
  res.json(db.prepare(`SELECT q.*, s.name shop_name, s.phone shop_phone FROM password_requests q JOIN shops s ON s.id=q.shop_id
    ${st ? 'WHERE q.status=?' : ''} ORDER BY q.id DESC LIMIT 300`).all(...(st ? [st] : [])));
});
r.post('/password-requests/:id/resolve', (req, res) => {
  const q = db.prepare('SELECT * FROM password_requests WHERE id=?').get(req.params.id);
  if (!q || q.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });
  const pw = String(req.body.password || '');
  if (pw.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  setTempPassword(q.shop_id, pw);
  res.json({ ok: true });
});
r.post('/password-requests/:id/dismiss', (req, res) => {
  const q = db.prepare('SELECT * FROM password_requests WHERE id=?').get(req.params.id);
  if (!q || q.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });
  db.prepare("UPDATE password_requests SET status='dismissed', resolved_at=? WHERE id=?").run(new Date().toISOString(), q.id);
  res.json({ ok: true });
});

r.get('/settings', (req, res) => res.json(getSettings()));
r.put('/settings', (req, res) => {
  const before = getSettings();
  const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  db.transaction(() => {
    for (const k of Object.keys(defaults)) {
      if (req.body[k] === undefined) continue;
      let v = String(req.body[k]).slice(0, 500);
      if (k.startsWith('price_')) v = String(Math.max(0, Math.floor(Number(v)) || 0));
      if (k === 'maintenance_mode') v = v === '1' ? '1' : '0';
      up.run(k, v);
    }
  })();
  if (req.body.maintenance_mode !== undefined && String(req.body.maintenance_mode) !== before.maintenance_mode)
    log(null, 'admin', req.body.maintenance_mode === '1' ? 'maintenance_on' : 'maintenance_off', '');
  res.json(getSettings());
});

r.post('/password', (req, res) => {
  const a = db.prepare('SELECT * FROM admins WHERE id=?').get(req.admin.id);
  if (!bcrypt.compareSync(String(req.body.current || ''), a.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (String(req.body.password || '').length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(String(req.body.password), 10), a.id);
  res.json({ ok: true });
});

r.get('/activity', (req, res) => {
  const sid = Number(req.query.shop_id) || null;
  res.json(db.prepare(`SELECT a.*, s.name shop_name FROM activity_logs a LEFT JOIN shops s ON s.id=a.shop_id
    ${sid ? 'WHERE a.shop_id=?' : ''} ORDER BY a.id DESC LIMIT 500`).all(...(sid ? [sid] : [])));
});

module.exports = r;
