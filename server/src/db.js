const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
// Migration: older databases do not have this column yet
if (!db.prepare('PRAGMA table_info(shops)').all().some((c) => c.name === 'must_change_password')) {
  db.exec('ALTER TABLE shops ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
}

// Migration: purchase bills can now have a photo of the supplier's paper bill
if (!db.prepare('PRAGMA table_info(purchase_bills)').all().some((c) => c.name === 'bill_image')) {
  db.exec('ALTER TABLE purchase_bills ADD COLUMN bill_image TEXT');
}

// Migration: sale bills can now be cancelled (voided) when a credit sale is voided
if (!db.prepare('PRAGMA table_info(sale_bills)').all().some((c) => c.name === 'voided')) {
  db.exec('ALTER TABLE sale_bills ADD COLUMN voided INTEGER NOT NULL DEFAULT 0');
}

// Migration: payments used to store a fixed plan ('monthly'/'yearly'); now they store a number of months (1-12).
if (!db.prepare('PRAGMA table_info(payments)').all().some((c) => c.name === 'months')) {
  db.transaction(() => {
    db.exec(`
      ALTER TABLE payments RENAME TO payments_old;
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id),
        method TEXT NOT NULL CHECK (method IN ('HBL','JazzCash')),
        months INTEGER NOT NULL CHECK (months BETWEEN 1 AND 12),
        amount INTEGER NOT NULL,
        txn_ref TEXT NOT NULL,
        screenshot TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        note TEXT,
        created_at TEXT NOT NULL,
        reviewed_at TEXT
      );
      INSERT INTO payments(id,shop_id,method,months,amount,txn_ref,screenshot,status,note,created_at,reviewed_at)
        SELECT id,shop_id,method,CASE plan WHEN 'yearly' THEN 12 ELSE 1 END,amount,txn_ref,screenshot,status,note,created_at,reviewed_at FROM payments_old;
      DROP TABLE payments_old;
      CREATE INDEX IF NOT EXISTS idx_pay_status ON payments(status);
    `);
  })();
}

const defaults = {
  app_name: 'Shop Manager',
  maintenance_mode: '0',
  maintenance_message: 'The software is under maintenance. Please try again in a little while.',
  price_per_month: '15000',
  hbl_title: '', hbl_account: '',
  jazzcash_title: '', jazzcash_number: '',
  support_phone: '',
};
const ins = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
for (const [k, v] of Object.entries(defaults)) ins.run(k, v);

function getSettings() {
  const o = {};
  for (const r of db.prepare('SELECT key,value FROM settings').all()) o[r.key] = r.value;
  return o;
}
function log(shopId, actor, action, details = '') {
  db.prepare('INSERT INTO activity_logs(shop_id,actor,action,details,created_at) VALUES(?,?,?,?,?)')
    .run(shopId, actor, action, String(details).slice(0, 500), new Date().toISOString());
}
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: process.env.TZ || 'Asia/Karachi' });

module.exports = { db, DATA_DIR, defaults, getSettings, log, today };
