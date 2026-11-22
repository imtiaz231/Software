// Usage: node scripts/reset-admin.js <username> <newPassword>
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcryptjs');
const { db } = require('../src/db');
const [u, p] = process.argv.slice(2);
if (!u || !p || p.length < 8) { console.log('Usage: node scripts/reset-admin.js <username> <password (8+ chars)>'); process.exit(1); }
const h = bcrypt.hashSync(p, 10);
const ex = db.prepare('SELECT id FROM admins WHERE username=?').get(u);
if (ex) db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(h, ex.id);
else db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run(u, h);
console.log('Admin password updated:', u);
