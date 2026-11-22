const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, getSettings, log, today } = require('../db');
const { shopAuth, shopActive, shopView } = require('../auth');
const { upload, rmUpload, uploadBill, rmBill, billDir, looksLikeImage } = require('../uploads');

/* ---------- Account router: /api/shop (no active subscription needed) ---------- */
const account = express.Router();
account.use(shopAuth);

account.get('/me', (req, res) => res.json({ shop: shopView(req.shop) }));

account.put('/me', upload.single('logo'), (req, res) => {
  const name = String(req.body.name || '').trim(), address = String(req.body.address || '').trim();
  if (name.length < 2 || address.length < 3) {
    if (req.file) rmUpload(req.file.filename);
    return res.status(400).json({ error: 'Shop name and address are required' });
  }
  let logo = req.shop.logo;
  if (req.file) { rmUpload(logo); logo = req.file.filename; }
  db.prepare('UPDATE shops SET name=?,address=?,logo=? WHERE id=?').run(name, address, logo, req.shop.id);
  log(req.shop.id, 'shop', 'profile_update', name);
  res.json({ shop: shopView(db.prepare('SELECT * FROM shops WHERE id=?').get(req.shop.id)) });
});

account.post('/password', (req, res) => {
  const { current = '', password = '' } = req.body;
  if (!bcrypt.compareSync(String(current), req.shop.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (String(password).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  db.prepare('UPDATE shops SET password_hash=?, must_change_password=0 WHERE id=?').run(bcrypt.hashSync(String(password), 10), req.shop.id);
  log(req.shop.id, 'shop', 'password_change', '');
  res.json({ ok: true, shop: shopView(db.prepare('SELECT * FROM shops WHERE id=?').get(req.shop.id)) });
});

account.get('/payment-info', (req, res) => {
  const s = getSettings();
  res.json({
    price_per_month: +s.price_per_month, max_months: 12,
    hbl_title: s.hbl_title, hbl_account: s.hbl_account,
    jazzcash_title: s.jazzcash_title, jazzcash_number: s.jazzcash_number,
    support_phone: s.support_phone,
  });
});

account.get('/payments', (req, res) => {
  res.json(db.prepare('SELECT * FROM payments WHERE shop_id=? ORDER BY id DESC LIMIT 100').all(req.shop.id));
});

account.post('/payments', upload.single('screenshot'), (req, res) => {
  const shot = req.file && req.file.filename;
  const fail = (m) => { rmUpload(shot); return res.status(400).json({ error: m }); };
  const { method } = req.body;
  const months = Math.floor(Number(req.body.months));
  const txn = String(req.body.txn_ref || '').trim();
  if (!['HBL', 'JazzCash'].includes(method)) return fail('Select a payment method');
  if (!(months >= 1 && months <= 12)) return fail('Choose between 1 and 12 months');
  if (txn.length < 4) return fail('Enter the transaction ID / reference');
  if (db.prepare("SELECT 1 FROM payments WHERE shop_id=? AND status='pending'").get(req.shop.id))
    return fail('You already have a payment pending review');
  const s = getSettings();
  const amount = months * Number(s.price_per_month);
  db.prepare('INSERT INTO payments(shop_id,method,months,amount,txn_ref,screenshot,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(req.shop.id, method, months, amount, txn, shot || null, new Date().toISOString());
  log(req.shop.id, 'shop', 'payment_submitted', `${method} ${months} month(s) Rs ${amount} ref ${txn}`);
  res.json({ ok: true });
});

/* ---------- Business router: /api (active subscription required) ---------- */
const biz = express.Router();
biz.use(shopAuth, shopActive);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const parseItems = (v) => {
  if (!Array.isArray(v) || !v.length || v.length > 100) return null;
  const out = [];
  for (const i of v) {
    const name = String((i && i.name) || '').trim().slice(0, 120);
    const qty = Number(i && i.qty), price = Number(i && i.price);
    if (!name || !(qty > 0) || !Number.isFinite(price) || price < 0) return null;
    out.push({ name, qty, price });
  }
  return out;
};
const sumItems = (its) => Math.round(its.reduce((a, i) => a + i.qty * i.price, 0) * 100) / 100;
const nextSeq = (table, shopId) => db.prepare(`SELECT COALESCE(MAX(seq),0)+1 n FROM ${table} WHERE shop_id=?`).get(shopId).n;
const billNo = (prefix, seq) => `${prefix}-${String(seq).padStart(4, '0')}`;
const withItems = (rows) => rows.map((x) => ({ ...x, items: JSON.parse(x.items) }));

function dateFilter(q, col, where, params) {
  if (DATE.test(q.from || '')) { where.push(`${col}>=?`); params.push(q.from); }
  if (DATE.test(q.to || '')) { where.push(`${col}<=?`); params.push(q.to); }
}
const TYPES = ['hardware', 'electronic'];

/* ----- Dealers ----- */
biz.get('/dealers', (req, res) => {
  res.json(db.prepare(`SELECT d.*, COUNT(b.id) bills, COALESCE(SUM(b.total),0) total
    FROM dealers d LEFT JOIN purchase_bills b ON b.dealer_id=d.id
    WHERE d.shop_id=? GROUP BY d.id ORDER BY d.name COLLATE NOCASE`).all(req.shop.id));
});
function dealerInput(b) {
  const type = b.type, name = String(b.name || '').trim(), company = String(b.company || '').trim(), phone = String(b.phone || '').trim();
  if (!TYPES.includes(type)) return { error: 'Select a dealer type (Hardware / Electronic)' };
  if (!name) return { error: 'Enter the dealer name' };
  if (!company) return { error: 'Enter the company name' };
  if (phone.replace(/\D/g, '').length < 7) return { error: 'Enter the dealer phone number' };
  return { type, name, company, phone };
}
biz.post('/dealers', (req, res) => {
  const d = dealerInput(req.body);
  if (d.error) return res.status(400).json({ error: d.error });
  const id = db.prepare('INSERT INTO dealers(shop_id,type,name,company,phone,created_at) VALUES(?,?,?,?,?,?)')
    .run(req.shop.id, d.type, d.name, d.company, d.phone, new Date().toISOString()).lastInsertRowid;
  log(req.shop.id, 'shop', 'dealer_add', `${d.name} (${d.company}) ${d.type}`);
  res.json({ id, ...d });
});
biz.put('/dealers/:id', (req, res) => {
  const d = dealerInput(req.body);
  if (d.error) return res.status(400).json({ error: d.error });
  const ok = db.prepare('UPDATE dealers SET type=?,name=?,company=?,phone=? WHERE id=? AND shop_id=?')
    .run(d.type, d.name, d.company, d.phone, req.params.id, req.shop.id).changes;
  if (!ok) return res.status(404).json({ error: 'Dealer not found' });
  log(req.shop.id, 'shop', 'dealer_edit', d.name);
  res.json({ ok: true });
});
biz.delete('/dealers/:id', (req, res) => {
  const used = db.prepare('SELECT 1 FROM purchase_bills WHERE dealer_id=? AND shop_id=?').get(req.params.id, req.shop.id);
  if (used) return res.status(400).json({ error: 'This dealer has bills on record and cannot be deleted' });
  const d = db.prepare('SELECT name FROM dealers WHERE id=? AND shop_id=?').get(req.params.id, req.shop.id);
  if (!d) return res.status(404).json({ error: 'Dealer not found' });
  db.prepare('DELETE FROM dealers WHERE id=?').run(req.params.id);
  log(req.shop.id, 'shop', 'dealer_delete', d.name);
  res.json({ ok: true });
});

/* ----- Purchases ----- */
biz.get('/purchases/next', (req, res) => res.json({ bill_no: billNo('PB', nextSeq('purchase_bills', req.shop.id)), date: today() }));

biz.get('/purchases', (req, res) => {
  const where = ['b.shop_id=?'], params = [req.shop.id];
  dateFilter(req.query, 'b.bill_date', where, params);
  if (TYPES.includes(req.query.dealer_type)) { where.push('d.type=?'); params.push(req.query.dealer_type); }
  if (req.query.dealer_id) { where.push('b.dealer_id=?'); params.push(Number(req.query.dealer_id)); }
  const W = where.join(' AND ');
  const rows = db.prepare(`SELECT b.*, d.name dealer_name, d.company dealer_company, d.phone dealer_phone, d.type dealer_type
    FROM purchase_bills b JOIN dealers d ON d.id=b.dealer_id WHERE ${W} ORDER BY b.seq DESC LIMIT 1000`).all(...params);
  const totals = db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(b.total),0) total,
    COALESCE(SUM(CASE WHEN d.type='hardware' THEN b.total END),0) hardware,
    COALESCE(SUM(CASE WHEN d.type='electronic' THEN b.total END),0) electronic
    FROM purchase_bills b JOIN dealers d ON d.id=b.dealer_id WHERE ${W}`).get(...params);
  // the file name stays private; the browser only learns whether a photo exists
  res.json({ rows: rows.map(({ bill_image, ...x }) => ({ ...x, items: JSON.parse(x.items), has_image: !!bill_image })), totals });
});

// Creates a purchase bill. Accepts JSON, or multipart/form-data with an optional "bill_image" photo of the supplier's paper bill.
biz.post('/purchases', uploadBill.single('bill_image'), (req, res) => {
  const photo = req.file;
  const fail = (m) => { if (photo) rmBill(photo.filename); return res.status(400).json({ error: m }); };
  let rawItems = req.body.items;
  if (typeof rawItems === 'string') { try { rawItems = JSON.parse(rawItems); } catch { rawItems = null; } }   // multipart sends items as text
  const its = parseItems(rawItems);
  if (!its) return fail('Enter a valid name, quantity and price for every item');
  const dealer = db.prepare('SELECT * FROM dealers WHERE id=? AND shop_id=?').get(Number(req.body.dealer_id), req.shop.id);
  if (!dealer) return fail('Select a dealer');
  if (photo && !looksLikeImage(photo)) return fail('The bill photo is not a valid image (use PNG, JPG or WEBP)');
  const total = sumItems(its), date = today();
  const out = db.transaction(() => {
    const seq = nextSeq('purchase_bills', req.shop.id), no = billNo('PB', seq);
    const id = db.prepare('INSERT INTO purchase_bills(shop_id,seq,bill_no,dealer_id,bill_date,items,total,bill_image,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(req.shop.id, seq, no, dealer.id, date, JSON.stringify(its), total, photo ? photo.filename : null, new Date().toISOString()).lastInsertRowid;
    return { id, seq, bill_no: no };
  })();
  log(req.shop.id, 'shop', 'purchase_add', `${out.bill_no} | ${dealer.name} | Rs ${total}${photo ? ' | bill photo attached' : ''}`);
  res.json({ ...out, bill_date: date, total, has_image: !!photo });
});

// Attach a photo to an existing purchase bill, or replace the current one
biz.post('/purchases/:id/image', uploadBill.single('bill_image'), (req, res) => {
  const photo = req.file;
  const bill = db.prepare('SELECT id, bill_no, bill_image FROM purchase_bills WHERE id=? AND shop_id=?').get(req.params.id, req.shop.id);
  if (!bill) { if (photo) rmBill(photo.filename); return res.status(404).json({ error: 'Bill not found' }); }
  if (!photo || !looksLikeImage(photo)) { if (photo) rmBill(photo.filename); return res.status(400).json({ error: 'Choose a valid image (PNG, JPG or WEBP)' }); }
  db.prepare('UPDATE purchase_bills SET bill_image=? WHERE id=?').run(photo.filename, bill.id);
  rmBill(bill.bill_image);                                  // remove the replaced file
  log(req.shop.id, 'shop', 'purchase_image', `${bill.bill_no}${bill.bill_image ? ' (replaced)' : ''}`);
  res.json({ ok: true, has_image: true });
});

// Bill photos are private: only the shop that owns the bill can download them
biz.get('/purchases/:id/image', (req, res) => {
  const bill = db.prepare('SELECT bill_image FROM purchase_bills WHERE id=? AND shop_id=?').get(req.params.id, req.shop.id);
  if (!bill || !bill.bill_image) return res.status(404).json({ error: 'No photo is attached to this bill' });
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(path.join(billDir, path.basename(bill.bill_image)));
});

/* ----- Sales ----- */
biz.get('/sales/next', (req, res) => res.json({ bill_no: billNo('SB', nextSeq('sale_bills', req.shop.id)), date: today() }));

biz.get('/sales', (req, res) => {
  const where = ['shop_id=?', 'voided=0'], params = [req.shop.id];
  dateFilter(req.query, 'bill_date', where, params);
  if (TYPES.includes(req.query.category)) { where.push('category=?'); params.push(req.query.category); }
  const W = where.join(' AND ');
  const rows = db.prepare(`SELECT * FROM sale_bills WHERE ${W} ORDER BY seq DESC LIMIT 1000`).all(...params);
  const totals = db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(total),0) total, COALESCE(SUM(profit),0) profit,
    COALESCE(SUM(CASE WHEN category='hardware' THEN total END),0) hardware,
    COALESCE(SUM(CASE WHEN category='electronic' THEN total END),0) electronic
    FROM sale_bills WHERE ${W}`).get(...params);
  res.json({ rows: withItems(rows), totals });
});

biz.post('/sales', (req, res) => {
  const its = parseItems(req.body.items);
  if (!its) return res.status(400).json({ error: 'Enter a valid name, quantity and price for every item' });
  if (!TYPES.includes(req.body.category)) return res.status(400).json({ error: 'Select Hardware or Electronic' });
  const profit = req.body.profit === '' || req.body.profit == null ? 0 : Number(req.body.profit);
  if (!Number.isFinite(profit)) return res.status(400).json({ error: 'Enter profit as a valid number' });
  const total = sumItems(its), date = today();
  const out = db.transaction(() => {
    const seq = nextSeq('sale_bills', req.shop.id), no = billNo('SB', seq);
    const id = db.prepare('INSERT INTO sale_bills(shop_id,seq,bill_no,bill_date,category,items,total,profit,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(req.shop.id, seq, no, date, req.body.category, JSON.stringify(its), total, profit, new Date().toISOString()).lastInsertRowid;
    return { id, seq, bill_no: no };
  })();
  log(req.shop.id, 'shop', 'sale_add', `${out.bill_no} | ${req.body.category} | Rs ${total} | profit ${profit}`);
  res.json({ ...out, bill_date: date, total, profit });
});

/* ----- Customers and credit ledger (udhaar / khata) ----- */
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const EPS = 0.005;
function custPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('92') && d.length === 12) d = '0' + d.slice(2);
  return d;
}
// Amount the customer still owes (credits minus payments, ignoring voided entries)
const balanceOf = (shopId, customerId) => r2(db.prepare(
  "SELECT COALESCE(SUM(CASE type WHEN 'credit' THEN amount ELSE -amount END),0) b FROM ledger_entries WHERE shop_id=? AND customer_id=? AND voided=0"
).get(shopId, customerId).b);
const findCustomer = (req) => db.prepare('SELECT * FROM customers WHERE id=? AND shop_id=?').get(req.params.id, req.shop.id);

function addEntry(shopId, customerId, type, amount, { items = null, note = '', saleBillId = null } = {}) {
  const seq = db.prepare('SELECT COALESCE(MAX(seq),0)+1 n FROM ledger_entries WHERE shop_id=? AND type=?').get(shopId, type).n;
  const ref = `${type === 'credit' ? 'CR' : 'PY'}-${String(seq).padStart(4, '0')}`;
  const id = db.prepare(`INSERT INTO ledger_entries(shop_id,customer_id,type,seq,ref_no,entry_date,items,note,amount,sale_bill_id,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(shopId, customerId, type, seq, ref, today(), items ? JSON.stringify(items) : null, note, amount, saleBillId, new Date().toISOString()).lastInsertRowid;
  return { id, ref_no: ref };
}
function customerInput(b) {
  const name = String(b.name || '').trim(), phone = custPhone(b.phone), address = String(b.address || '').trim().slice(0, 150);
  if (name.length < 2) return { error: 'Enter the customer name' };
  if (phone.length < 7 || phone.length > 15) return { error: 'Enter a valid customer phone number' };
  return { name, phone, address };
}

biz.get('/customers', (req, res) => {
  const q = String(req.query.q || '').trim(), due = req.query.due === '1';
  const where = ['c.shop_id=?'], params = [req.shop.id];
  if (q) { where.push('(c.name LIKE ? OR c.phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const rows = db.prepare(`SELECT c.id, c.name, c.phone, c.address,
      ROUND(COALESCE(SUM(CASE WHEN e.voided=0 THEN CASE e.type WHEN 'credit' THEN e.amount ELSE -e.amount END END),0),2) balance,
      MAX(CASE WHEN e.voided=0 THEN e.entry_date END) last_activity
    FROM customers c LEFT JOIN ledger_entries e ON e.customer_id=c.id
    WHERE ${where.join(' AND ')} GROUP BY c.id ${due ? 'HAVING balance > 0.005' : ''}
    ORDER BY ${due ? 'balance DESC' : 'c.name COLLATE NOCASE'} LIMIT 500`).all(...params);
  const sum = db.prepare(`SELECT COALESCE(SUM(b),0) outstanding, COUNT(*) due_customers FROM (
      SELECT SUM(CASE type WHEN 'credit' THEN amount ELSE -amount END) b FROM ledger_entries
      WHERE shop_id=? AND voided=0 GROUP BY customer_id HAVING b > 0.005)`).get(req.shop.id);
  const total = db.prepare('SELECT COUNT(*) n FROM customers WHERE shop_id=?').get(req.shop.id).n;
  res.json({ rows, summary: { outstanding: r2(sum.outstanding), due_customers: sum.due_customers, customers: total } });
});

biz.post('/customers', (req, res) => {
  const c = customerInput(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  try {
    const id = db.prepare('INSERT INTO customers(shop_id,name,phone,address,created_at) VALUES(?,?,?,?,?)')
      .run(req.shop.id, c.name, c.phone, c.address, new Date().toISOString()).lastInsertRowid;
    log(req.shop.id, 'shop', 'customer_add', `${c.name} ${c.phone}`);
    res.json({ id, ...c });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: 'A customer with this phone number already exists' });
    throw e;
  }
});

biz.put('/customers/:id', (req, res) => {
  const c = customerInput(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  try {
    const ok = db.prepare('UPDATE customers SET name=?, phone=?, address=? WHERE id=? AND shop_id=?').run(c.name, c.phone, c.address, req.params.id, req.shop.id).changes;
    if (!ok) return res.status(404).json({ error: 'Customer not found' });
    log(req.shop.id, 'shop', 'customer_edit', c.name);
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: 'A customer with this phone number already exists' });
    throw e;
  }
});

biz.delete('/customers/:id', (req, res) => {
  const c = findCustomer(req);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  if (db.prepare('SELECT 1 FROM ledger_entries WHERE customer_id=?').get(c.id))
    return res.status(400).json({ error: 'This customer has ledger history and cannot be deleted' });
  db.prepare('DELETE FROM customers WHERE id=?').run(c.id);
  log(req.shop.id, 'shop', 'customer_delete', c.name);
  res.json({ ok: true });
});

// Full account statement (oldest first) with a running balance
biz.get('/customers/:id', (req, res) => {
  const c = findCustomer(req);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const entries = db.prepare(`SELECT e.*, s.bill_no sale_bill_no FROM ledger_entries e
    LEFT JOIN sale_bills s ON s.id=e.sale_bill_id WHERE e.customer_id=? AND e.shop_id=? ORDER BY e.id`).all(c.id, req.shop.id);
  let run = 0, credit = 0, paid = 0;
  const out = entries.map((e) => {
    if (!e.voided) {
      run = r2(run + (e.type === 'credit' ? e.amount : -e.amount));
      if (e.type === 'credit') credit += e.amount; else paid += e.amount;
    }
    return { ...e, items: e.items ? JSON.parse(e.items) : null, running_balance: run };
  });
  res.json({
    customer: { id: c.id, name: c.name, phone: c.phone, address: c.address, created_at: c.created_at },
    balance: run, total_credit: r2(credit), total_paid: r2(paid), entries: out,
  });
});

// Customer takes goods on credit. Optionally: part-payment now, and also record it as a sale bill.
biz.post('/customers/:id/credit', (req, res) => {
  const c = findCustomer(req);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const its = parseItems(req.body.items);
  if (!its) return res.status(400).json({ error: 'Enter a valid name, quantity and price for every item' });
  const total = sumItems(its);
  const paidNow = req.body.paid_now === '' || req.body.paid_now == null ? 0 : r2(req.body.paid_now);
  if (!Number.isFinite(paidNow) || paidNow < 0 || paidNow > total + EPS)
    return res.status(400).json({ error: 'The amount paid now must be between 0 and the bill total' });
  const recordSale = !!req.body.record_sale;
  let category = null, profit = 0;
  if (recordSale) {
    category = req.body.category;
    if (!TYPES.includes(category)) return res.status(400).json({ error: 'Select Hardware or Electronic' });
    profit = req.body.profit === '' || req.body.profit == null ? 0 : Number(req.body.profit);
    if (!Number.isFinite(profit)) return res.status(400).json({ error: 'Enter profit as a valid number' });
  }
  const note = String(req.body.note || '').trim().slice(0, 200);
  const out = db.transaction(() => {
    let saleId = null, saleNo = null;
    if (recordSale) {
      const seq = nextSeq('sale_bills', req.shop.id);
      saleNo = billNo('SB', seq);
      saleId = db.prepare('INSERT INTO sale_bills(shop_id,seq,bill_no,bill_date,category,items,total,profit,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(req.shop.id, seq, saleNo, today(), category, JSON.stringify(its), total, profit, new Date().toISOString()).lastInsertRowid;
    }
    const credit = addEntry(req.shop.id, c.id, 'credit', total, { items: its, note, saleBillId: saleId });
    const payment = paidNow > 0 ? addEntry(req.shop.id, c.id, 'payment', paidNow, { note: 'Paid at the time of purchase' }) : null;
    return { credit, payment, sale_bill_no: saleNo };
  })();
  log(req.shop.id, 'shop', 'credit_add', `${c.name} | ${out.credit.ref_no} | Rs ${total}${paidNow ? ' | paid now Rs ' + paidNow : ''}`);
  res.json({ ...out, total, balance: balanceOf(req.shop.id, c.id) });
});

// Customer pays (part or all of) what they owe. The balance can never go below zero.
biz.post('/customers/:id/payment', (req, res) => {
  const c = findCustomer(req);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const amount = r2(req.body.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'Enter a payment amount greater than zero' });
  const bal = balanceOf(req.shop.id, c.id);
  if (amount > bal + EPS) return res.status(400).json({ error: `This payment (Rs ${amount}) is more than the balance due (Rs ${bal})` });
  const note = String(req.body.note || '').trim().slice(0, 200);
  const e = addEntry(req.shop.id, c.id, 'payment', amount, { note });
  log(req.shop.id, 'shop', 'payment_add', `${c.name} | ${e.ref_no} | Rs ${amount}`);
  res.json({ ...e, balance: r2(bal - amount) });
});

// Entries are never deleted. A mistake is voided with a reason and stays visible in the statement.
biz.post('/ledger/:id/void', (req, res) => {
  const e = db.prepare('SELECT * FROM ledger_entries WHERE id=? AND shop_id=?').get(req.params.id, req.shop.id);
  if (!e) return res.status(404).json({ error: 'Entry not found' });
  if (e.voided) return res.status(400).json({ error: 'This entry is already voided' });
  const reason = String(req.body.reason || '').trim().slice(0, 200);
  if (reason.length < 3) return res.status(400).json({ error: 'Enter a reason (at least 3 characters)' });
  if (e.type === 'credit' && balanceOf(req.shop.id, e.customer_id) - e.amount < -EPS)
    return res.status(400).json({ error: 'Cannot void this credit because the payments received would exceed what is left. Void the related payment first.' });
  db.transaction(() => {
    db.prepare('UPDATE ledger_entries SET voided=1, void_reason=? WHERE id=?').run(reason, e.id);
    if (e.sale_bill_id) db.prepare('UPDATE sale_bills SET voided=1 WHERE id=?').run(e.sale_bill_id); // cancel the linked sale too
  })();
  log(req.shop.id, 'shop', 'entry_void', `${e.ref_no} | ${reason}`);
  res.json({ ok: true, balance: balanceOf(req.shop.id, e.customer_id) });
});

/* ----- Summary & reports ----- */
biz.get('/summary', (req, res) => {
  const sid = req.shop.id, t = today(), month = t.slice(0, 7) + '-01';
  const P = (from) => db.prepare('SELECT COUNT(*) count, COALESCE(SUM(total),0) total FROM purchase_bills WHERE shop_id=? AND bill_date>=?').get(sid, from);
  const S = (from) => db.prepare('SELECT COUNT(*) count, COALESCE(SUM(total),0) total, COALESCE(SUM(profit),0) profit FROM sale_bills WHERE shop_id=? AND voided=0 AND bill_date>=?').get(sid, from);
  res.json({
    today: { purchases: P(t), sales: S(t) },
    month: { purchases: P(month), sales: S(month) },
    all: { purchases: P('0000-00-00'), sales: S('0000-00-00') },
    receivable: db.prepare(`SELECT COALESCE(SUM(b),0) total, COUNT(*) customers FROM (
      SELECT SUM(CASE type WHEN 'credit' THEN amount ELSE -amount END) b FROM ledger_entries
      WHERE shop_id=? AND voided=0 GROUP BY customer_id HAVING b > 0.005)`).get(sid),
  });
});

biz.get('/reports/daily', (req, res) => {
  const d = new Date(); d.setDate(d.getDate() - 30);
  const from = DATE.test(req.query.from || '') ? req.query.from : d.toLocaleDateString('en-CA');
  const to = DATE.test(req.query.to || '') ? req.query.to : today();
  const sales = db.prepare('SELECT bill_date date, COUNT(*) sale_count, SUM(total) sales, SUM(profit) profit FROM sale_bills WHERE shop_id=? AND voided=0 AND bill_date BETWEEN ? AND ? GROUP BY bill_date').all(req.shop.id, from, to);
  const purch = db.prepare('SELECT bill_date date, COUNT(*) purchase_count, SUM(total) purchases FROM purchase_bills WHERE shop_id=? AND bill_date BETWEEN ? AND ? GROUP BY bill_date').all(req.shop.id, from, to);
  const m = {};
  for (const s of sales) m[s.date] = { date: s.date, sale_count: s.sale_count, sales: s.sales, profit: s.profit, purchase_count: 0, purchases: 0 };
  for (const p of purch) m[p.date] = { date: p.date, sale_count: 0, sales: 0, profit: 0, ...(m[p.date] || {}), purchase_count: p.purchase_count, purchases: p.purchases };
  res.json(Object.values(m).sort((a, b) => b.date.localeCompare(a.date)));
});

biz.get('/activity', (req, res) => {
  res.json(db.prepare('SELECT id,action,details,created_at FROM activity_logs WHERE shop_id=? ORDER BY id DESC LIMIT 300').all(req.shop.id));
});

module.exports = { account, biz };
