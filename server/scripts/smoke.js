// End-to-end smoke test. Start the server first, then: BASE=http://localhost:4000 npm test
const BASE = process.env.BASE || 'http://localhost:4000';
const ADMIN = { identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin12345' };
let pass = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } pass++; console.log('ok  -', m); };
async function call(p, { method = 'GET', body, token, form } = {}) {
  const headers = {}; if (token) headers.Authorization = 'Bearer ' + token;
  let b; if (form) b = form; else if (body) { headers['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  const r = await fetch(BASE + '/api' + p, { method, headers, body: b });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
(async () => {
  const phone = '03' + String(Date.now()).slice(-9);
  const f = new FormData();
  f.set('name', 'Test Traders'); f.set('address', 'Saddar, Karachi'); f.set('phone', phone); f.set('password', 'secret123');
  f.set('logo', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'logo.png');
  let r = await call('/auth/register', { method: 'POST', form: f });
  ok(r.status === 200 && r.data.shop.logo, 'shop registers with logo upload');
  const t = r.data.token;
  r = await call('/summary', { token: t }); ok(r.status === 402, 'data is blocked without a subscription');
  r = await call('/auth/login', { method: 'POST', body: { identifier: phone, password: 'secret123' } }); ok(r.status === 200, 'shop login');

  const pf = new FormData(); pf.set('method', 'JazzCash'); pf.set('months', '3'); pf.set('txn_ref', 'TXN123456');
  const bad = new FormData(); bad.set('method', 'HBL'); bad.set('months', '13'); bad.set('txn_ref', 'TXNBAD1');
  r = await call('/shop/payments', { method: 'POST', token: t, form: bad }); ok(r.status === 400, 'more than 12 months is rejected');
  r = await call('/shop/payments', { method: 'POST', token: t, form: pf }); ok(r.status === 200, '3-month payment submitted');
  r = await call('/auth/login', { method: 'POST', body: ADMIN }); ok(r.status === 200 && r.data.role === 'admin', 'admin login');
  const a = r.data.token;
  r = await call('/admin/payments?status=pending', { token: a });
  const pay = r.data.find((x) => x.txn_ref === 'TXN123456'); ok(!!pay && pay.months === 3 && pay.amount === 45000, 'admin sees the pending payment (3 months = Rs 45,000)');
  r = await call(`/admin/payments/${pay.id}/approve`, { method: 'POST', token: a }); ok(r.status === 200, 'payment approved');
  r = await call('/shop/me', { token: t }); ok(r.data.shop.access && r.data.shop.daysLeft >= 88 && r.data.shop.daysLeft <= 93, '3 months of access granted');

  r = await call('/dealers', { method: 'POST', token: t, body: { type: 'electronic', name: 'Ali', company: 'Pak Electronics', phone: '03211234567' } });
  ok(r.status === 200, 'dealer added'); const dealer = r.data.id;
  for (let i = 1; i <= 3; i++) {
    r = await call('/purchases', { method: 'POST', token: t, body: { dealer_id: dealer, items: [{ name: 'Fan', qty: 2, price: 1000 * i }] } });
    ok(r.data.bill_no === 'PB-000' + i, `purchase bill sequence PB-000${i}`);
  }
  r = await call('/purchases', { token: t }); ok(r.data.totals.total === 12000 && r.data.totals.count === 3 && r.data.totals.electronic === 12000, 'purchase total = 12000');
  r = await call('/dealers/' + dealer, { method: 'DELETE', token: t }); ok(r.status === 400, 'a dealer with bills cannot be deleted');

  // supplier bill photo
  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const mk = (extra = {}) => { const fd = new FormData(); fd.set('dealer_id', String(dealer)); fd.set('items', JSON.stringify([{ name: 'Wire', qty: 4, price: 250 }])); for (const [k, v] of Object.entries(extra)) fd.set(k, v); return fd; };
  r = await call('/purchases', { method: 'POST', token: t, form: mk({ bill_image: new Blob([PNG], { type: 'image/png' }) }) });
  ok(r.status === 200 && r.data.has_image && r.data.bill_no === 'PB-0004', 'purchase saved together with a bill photo'); const pbPhoto = r.data.id;
  r = await call('/purchases', { token: t }); ok(r.data.rows.find((x) => x.id === pbPhoto).has_image === true && !('bill_image' in r.data.rows[0]), 'list shows has_image and hides the file name');
  let img = await fetch(BASE + `/api/purchases/${pbPhoto}/image`, { headers: { Authorization: 'Bearer ' + t } }); ok(img.status === 200 && img.headers.get('content-type') === 'image/png', 'owner can download the bill photo');
  img = await fetch(BASE + `/api/purchases/${pbPhoto}/image`); ok(img.status === 401, 'bill photo needs a login');
  r = await call('/purchases', { method: 'POST', token: t, form: mk({ bill_image: new Blob([Buffer.from('this is not an image')], { type: 'image/png' }) }) });
  ok(r.status === 400, 'a fake image file is rejected'); const n = (await call('/purchases', { token: t })).data.totals.count; ok(n === 4, 'a rejected upload does not create a bill');
  r = await call('/purchases', { method: 'POST', token: t, form: mk({ bill_image: new Blob([Buffer.from('hello')], { type: 'application/pdf' }) }) }); ok(r.status === 400, 'a non-image file type is rejected');
  r = await call('/purchases', { method: 'POST', token: t, form: mk() }); ok(r.status === 200 && !r.data.has_image, 'the photo is optional'); const pbNoPhoto = r.data.id;
  const att = new FormData(); att.set('bill_image', new Blob([PNG], { type: 'image/png' }), 'bill.png');
  r = await call(`/purchases/${pbNoPhoto}/image`, { method: 'POST', token: t, form: att }); ok(r.status === 200, 'a photo can be attached to an existing bill later');
  r = await call('/purchases', { token: t }); ok(r.data.totals.total === 14000 && r.data.totals.count === 5, 'photo uploads do not change the purchase totals');

  await call('/sales', { method: 'POST', token: t, body: { category: 'hardware', items: [{ name: 'Drill', qty: 1, price: 5000 }], profit: 800 } });
  r = await call('/sales', { method: 'POST', token: t, body: { category: 'electronic', items: [{ name: 'Bulb', qty: 10, price: 200 }], profit: 300 } });
  ok(r.data.bill_no === 'SB-0002', 'sale bill sequence');
  r = await call('/sales?category=hardware', { token: t }); ok(r.data.rows.length === 1, 'category filter works');
  r = await call('/sales', { token: t }); ok(r.data.totals.total === 7000 && r.data.totals.profit === 1100, 'sales total 7000 / profit 1100');
  r = await call('/summary', { token: t }); ok(r.data.today.sales.total === 7000, "today's summary");
  r = await call('/reports/daily', { token: t }); ok(r.data[0].sales === 7000 && r.data[0].purchases === 14000, 'daily report');

  // customer credit ledger (udhaar / khata)
  r = await call('/customers', { method: 'POST', token: t, body: { name: 'Bilal Khan', phone: '0300-5551234' } }); ok(r.status === 200, 'customer created'); const cust = r.data.id;
  r = await call('/customers', { method: 'POST', token: t, body: { name: 'Duplicate', phone: '03005551234' } }); ok(r.status === 400, 'duplicate customer phone is rejected');
  r = await call(`/customers/${cust}/credit`, { method: 'POST', token: t, body: { items: [{ name: 'Cement', qty: 10, price: 1000 }], paid_now: 2000, record_sale: true, category: 'hardware', profit: 1500 } });
  ok(r.status === 200 && r.data.balance === 8000 && r.data.credit.ref_no === 'CR-0001' && r.data.payment.ref_no === 'PY-0001', 'credit of Rs 10,000 with Rs 2,000 paid now leaves Rs 8,000 due');
  r = await call('/sales', { token: t }); ok(r.data.totals.total === 17000 && r.data.totals.profit === 2600, 'the credit sale was also recorded as a sale bill');
  r = await call(`/customers/${cust}/payment`, { method: 'POST', token: t, body: { amount: 9000 } }); ok(r.status === 400, 'a payment larger than the balance is rejected');
  r = await call(`/customers/${cust}/payment`, { method: 'POST', token: t, body: { amount: 3000, note: 'Cash' } }); ok(r.status === 200 && r.data.balance === 5000 && r.data.ref_no === 'PY-0002', 'payment of Rs 3,000 leaves Rs 5,000 due');
  r = await call('/customers?due=1', { token: t }); ok(r.data.rows.length === 1 && r.data.summary.outstanding === 5000, 'customer appears in the dues list');
  r = await call('/customers?q=bilal', { token: t }); ok(r.data.rows.length === 1, 'customer search by name works');
  r = await call('/summary', { token: t }); ok(r.data.receivable.total === 5000, 'dashboard shows the receivable total');
  r = await call(`/customers/${cust}`, { token: t }); const py2 = r.data.entries.find((x) => x.ref_no === 'PY-0002'); ok(r.data.balance === 5000 && r.data.entries.length === 3, 'statement has 3 entries');
  r = await call(`/ledger/${py2.id}/void`, { method: 'POST', token: t, body: { reason: 'Entered by mistake' } }); ok(r.status === 200 && r.data.balance === 8000, 'voiding a payment restores the balance');
  const cr1 = (await call(`/customers/${cust}`, { token: t })).data.entries.find((x) => x.ref_no === 'CR-0001');
  r = await call(`/ledger/${cr1.id}/void`, { method: 'POST', token: t, body: { reason: 'Wrong customer' } }); ok(r.status === 400, 'a credit cannot be voided while payments exceed what is left');
  r = await call(`/customers/${cust}/payment`, { method: 'POST', token: t, body: { amount: 8000 } }); ok(r.data.balance === 0, 'paying the full balance clears the account');
  r = await call('/customers?due=1', { token: t }); ok(r.data.rows.length === 0, 'a settled customer leaves the dues list');
  r = await call(`/customers/${cust}/credit`, { method: 'POST', token: t, body: { items: [{ name: 'Bulb', qty: 1, price: 500 }], record_sale: true, category: 'electronic', profit: 100 } });
  ok(r.data.balance === 500, 'new credit after settlement'); const cr2 = r.data.credit.id;
  r = await call(`/ledger/${cr2}/void`, { method: 'POST', token: t, body: { reason: 'Customer cancelled' } }); ok(r.status === 200 && r.data.balance === 0, 'voiding a credit works');
  r = await call('/sales', { token: t }); ok(r.data.totals.total === 17000, 'the voided credit also cancelled its sale bill');
  r = await call(`/customers/${cust}`, { method: 'DELETE', token: t }); ok(r.status === 400, 'a customer with ledger history cannot be deleted');

  const f2 = new FormData(); f2.set('name', 'Other'); f2.set('address', 'Lahore'); f2.set('phone', '03' + String(Date.now() + 7).slice(-9)); f2.set('password', 'secret123');
  const t2 = (await call('/auth/register', { method: 'POST', form: f2 })).data.token;
  await call('/admin/shops/' + (await call('/shop/me', { token: t2 })).data.shop.id + '/grant', { method: 'POST', token: a, body: { months: 12 } });
  r = await call('/sales', { token: t2 }); ok(r.data.totals.count === 0, "each shop's data is separate");
  img = await fetch(BASE + `/api/purchases/${pbPhoto}/image`, { headers: { Authorization: 'Bearer ' + t2 } }); ok(img.status === 404, "another shop cannot download this shop's bill photo");
  r = await call('/customers/' + cust, { token: t2 }); ok(r.status === 404, "another shop cannot open this shop's customer");

  // forgot-password flow
  r = await call('/auth/forgot-password', { method: 'POST', body: { phone: '03999999999' } });
  ok(r.status === 200 && r.data.ok, 'unknown phone gets the same generic response');
  r = await call('/auth/forgot-password', { method: 'POST', body: { phone, note: 'I forgot my password' } }); ok(r.status === 200, 'forgot-password request accepted');
  await call('/auth/forgot-password', { method: 'POST', body: { phone } });
  r = await call('/admin/password-requests?status=pending', { token: a });
  const mine = r.data.filter((x) => x.shop_phone === phone); ok(mine.length === 1, 'admin sees exactly one pending request for the shop');
  r = await call(`/admin/password-requests/${mine[0].id}/resolve`, { method: 'POST', token: a, body: { password: 'Temp12345' } }); ok(r.status === 200, 'admin sets a new password');
  r = await call('/auth/login', { method: 'POST', body: { identifier: phone, password: 'secret123' } }); ok(r.status === 401, 'old password no longer works');
  r = await call('/auth/login', { method: 'POST', body: { identifier: phone, password: 'Temp12345' } }); ok(r.status === 200 && r.data.shop.must_change, 'new password works and forces a change');
  const t3 = r.data.token;
  r = await call('/shop/password', { method: 'POST', token: t3, body: { current: 'Temp12345', password: 'MyOwnPass1' } }); ok(r.status === 200 && !r.data.shop.must_change, 'shop chooses its own password');
  r = await call('/admin/password-requests?status=pending', { token: a }); ok(!r.data.some((x) => x.shop_phone === phone), 'request is closed after the reset');

  await call('/admin/settings', { method: 'PUT', token: a, body: { maintenance_mode: '1' } });
  r = await call('/summary', { token: t }); ok(r.status === 503, 'maintenance mode blocks shops');
  r = await call('/admin/stats', { token: a }); ok(r.status === 200, 'admin keeps working during maintenance');
  await call('/admin/settings', { method: 'PUT', token: a, body: { maintenance_mode: '0' } });
  r = await call('/summary', { token: t }); ok(r.status === 200, 'maintenance off');
  r = await call('/activity', { token: t }); ok(r.data.length >= 8, 'activity history');
  console.log(`\nAll ${pass} checks passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
